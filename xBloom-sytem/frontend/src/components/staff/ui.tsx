import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { useI18n } from "../../lib/i18n";

/** Minimal icon-only row action. The label becomes the tooltip + aria-label. */
export function IconAction({
  name,
  label,
  onClick,
  tone = "default",
}: {
  name: IconName;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-md p-1.5 text-muted transition hover:bg-card2 ${
        tone === "danger" ? "hover:text-red" : "hover:text-ink"
      }`}
    >
      <Icon name={name} size={16} />
    </button>
  );
}

/** Row-action cell wrapper: right-aligned, no-wrap, tight gap. */
export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">{children}</div>;
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "Search…"}
      className="rounded-xl2 border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brown"
    />
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:bg-card"
      }`}
    >
      {children}
    </button>
  );
}

export function MiniButton({ children, onClick, tone = "default" }: { children: ReactNode; onClick: () => void; tone?: "default" | "danger" }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl2 border px-3 py-2 text-xs transition ${
        tone === "danger" ? "border-red text-red hover:bg-red-tint" : "border-line bg-white text-ink hover:bg-card"
      }`}
    >
      {children}
    </button>
  );
}

export function StatCard({ label, value, tone = "grey" }: { label: string; value: number; tone?: "brown" | "green" | "red" | "grey" }) {
  const dot = { brown: "bg-brown", green: "bg-green2", red: "bg-red", grey: "bg-grey" }[tone];
  return (
    <div className="rounded-xl2 border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <div className="mt-2 font-serif text-4xl font-light text-ink">{value}</div>
    </div>
  );
}

// A column definition. `w` is a CSS width (e.g. "12%") applied via <colgroup>.
// `sortKey` makes the header clickable to sort by that field.
export type Col = { label: string; w?: string; className?: string; sortKey?: string };
export type SortState = { key: string; dir: "asc" | "desc" } | null;

/**
 * Full-width, fixed-layout table. `table-fixed` + a <colgroup> means columns
 * honour the given widths and fill the container instead of growing with their
 * content, so wide tables no longer overflow on desktop. `minWidth` only kicks
 * in on narrow (mobile) screens, where horizontal scrolling is expected.
 */
export function TableWrap({
  cols,
  minWidth = "min-w-[720px]",
  sort,
  onSort,
  children,
}: {
  cols: Col[];
  minWidth?: string;
  sort?: SortState;
  onSort?: (key: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="w-full overflow-x-auto rounded-xl2 border border-line">
      <table className={`w-full ${minWidth} table-fixed text-left text-sm`}>
        <colgroup>
          {cols.map((c, i) => (
            <col key={i} style={c.w ? { width: c.w } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-line bg-card2 text-xs uppercase tracking-wide text-muted">
            {cols.map((c, i) => {
              const sortable = !!(c.sortKey && onSort);
              const active = sortable && sort?.key === c.sortKey;
              const right = c.className?.includes("text-right");
              return (
                <th key={`${c.label}-${i}`} className={`px-3 py-3 font-medium ${c.className ?? ""}`}>
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort!(c.sortKey!)}
                      className={`group inline-flex max-w-full items-center gap-1 hover:text-ink ${right ? "justify-end" : ""}`}
                    >
                      <span className="truncate">{c.label}</span>
                      <Icon
                        name="arrowDown"
                        size={12}
                        className={`shrink-0 transition ${
                          active ? `text-ink ${sort!.dir === "asc" ? "rotate-180" : ""}` : "opacity-25 group-hover:opacity-60"
                        }`}
                      />
                    </button>
                  ) : (
                    <span className="block truncate">{c.label}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-card/50">{children}</tbody>
      </table>
    </div>
  );
}

export function Pager({
  page,
  pageCount,
  pageSize,
  total,
  start,
  count,
  onPage,
  onPageSize,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  start: number;
  count: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <span>{total === 0 ? t("pager.noResults") : t("pager.showing", { from: start + 1, to: start + count, total })}</span>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5">
          {t("common.rows")}
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="rounded-xl2 border border-line bg-white px-2 py-1 text-ink outline-none focus:border-brown"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value={0}>All</option>
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="flex items-center rounded-xl2 border border-line px-2 py-1.5 text-ink disabled:opacity-30"
            aria-label="Previous page"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <span className="text-ink">
            {page} / {pageCount}
          </span>
          <button
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
            className="flex items-center rounded-xl2 border border-line px-2 py-1.5 text-ink disabled:opacity-30"
            aria-label="Next page"
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl2 border border-dashed border-line p-8 text-center text-sm text-muted">{children}</div>;
}
