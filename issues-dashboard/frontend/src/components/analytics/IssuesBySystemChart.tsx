import { useState } from 'react'
import { systemColor } from './palette'

export interface SystemCount {
  system: string
  count: number
}

// Horizontal bar chart — each bar carries its own category label directly
// (system name + value at the tip), so no separate legend box is needed.
// Contrast WARN on 3/5 slots (see palette validation) is mitigated by these
// always-visible text labels, never color alone.
export default function IssuesBySystemChart({ data }: { data: SystemCount[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const max = Math.max(1, ...data.map((d) => d.count))

  return (
    <div className="space-y-2.5" role="img">
      {data.map((row) => {
        const pct = (row.count / max) * 100
        const isHovered = hovered === row.system
        return (
          <div
            key={row.system}
            className="group flex items-center gap-3"
            onMouseEnter={() => setHovered(row.system)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(row.system)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
          >
            <span className="w-32 shrink-0 truncate text-xs text-slate-600" title={row.system}>
              {row.system}
            </span>
            <div className="relative h-6 min-w-0 flex-1 rounded-sm bg-slate-50">
              <div
                className="h-6 rounded-r-[4px] transition-[filter]"
                style={{
                  width: `${pct}%`,
                  backgroundColor: systemColor(row.system),
                  filter: isHovered ? 'brightness(0.9)' : undefined,
                }}
              />
              {isHovered && (
                <div className="pointer-events-none absolute -top-8 left-0 z-10 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-lg">
                  {row.system}: {row.count}
                </div>
              )}
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-medium text-slate-900">{row.count}</span>
          </div>
        )
      })}
    </div>
  )
}
