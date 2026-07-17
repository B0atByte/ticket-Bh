import { useState } from 'react'
import { ExternalLink, Grid2x2 } from 'lucide-react'
import { otherSystems } from '../lib/quickAccess'

export function QuickAccessMenu() {
  const [open, setOpen] = useState(false)
  const systems = otherSystems('bhlogistics')

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group relative"
      >
        <Grid2x2 size={20} className="shrink-0" />
        <span className="hidden md:block text-sm font-medium">ระบบอื่น</span>
        <div className="md:hidden absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
          ไปยังระบบอื่น
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-40 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1.5">
            <p className="px-2.5 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">ไปยังระบบอื่น</p>
            {systems.map((s) => (
              <a
                key={s.key}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="truncate">{s.label}</span>
                <ExternalLink size={13} className="shrink-0 text-slate-400" />
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
