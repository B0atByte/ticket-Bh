import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'

interface Props {
  placeholder?: string
  onSearch: (value: string) => void
  debounceMs?: number
}

export function SearchInput({ placeholder = 'ค้นหา...', onSearch, debounceMs = 350 }: Props) {
  const [value, setValue] = useState('')

  useEffect(() => {
    const t = setTimeout(() => onSearch(value.trim()), debounceMs)
    return () => clearTimeout(t)
  }, [value, onSearch, debounceMs])

  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {value && (
        <button onClick={() => setValue('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
