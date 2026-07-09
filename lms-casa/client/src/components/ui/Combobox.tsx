import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Input } from './input';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  /** Label for the "no selection" entry; omit to hide the clear option. */
  clearLabel?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Lightweight searchable select. Stores `value` (an id) but lets the user
 * type to filter by label — keeps long lists (e.g. many branches) usable.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  emptyText = 'ไม่พบรายการ',
  clearLabel,
  disabled,
  id,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="relative" ref={wrapRef}>
      <Input
        id={id}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        placeholder={placeholder}
        className="pr-9"
        value={open ? query : selected?.label ?? ''}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[0]) select(filtered[0].value);
          } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
          }
        }}
      />
      <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-md"
        >
          {clearLabel !== undefined && (
            <li>
              <button
                type="button"
                onClick={() => select('')}
                className="flex w-full items-center px-3 py-2 text-left hover:bg-accent"
              >
                <span className="text-muted-foreground">{clearLabel}</span>
              </button>
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">{emptyText}</li>
          ) : (
            filtered.map((o) => (
              <li key={o.value} role="option" aria-selected={o.value === value}>
                <button
                  type="button"
                  onClick={() => select(o.value)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent"
                >
                  <span>{o.label}</span>
                  {o.value === value && <Check className="h-4 w-4 text-primary" />}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
