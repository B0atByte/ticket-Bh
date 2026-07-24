import { useState } from 'react'
import { TREND_COLOR } from './palette'

export interface PageCount {
  page: string
  count: number
}

// Ranked magnitude, not identity — every bar shares the one sequential hue
// (see dataviz skill: sequential = one hue for a "how much" job). No legend
// needed for a single series; the card title already names what's plotted.
export default function TopPagesChart({ data }: { data: PageCount[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const max = Math.max(1, ...data.map((d) => d.count))

  return (
    <div className="space-y-2.5" role="img">
      {data.map((row) => {
        const pct = (row.count / max) * 100
        const isHovered = hovered === row.page
        return (
          <div
            key={row.page}
            className="group flex items-center gap-3"
            onMouseEnter={() => setHovered(row.page)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(row.page)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
          >
            <span className="w-40 shrink-0 truncate text-xs text-slate-600" title={row.page}>
              {row.page}
            </span>
            <div className="relative h-6 min-w-0 flex-1 rounded-sm bg-slate-50">
              <div
                className="h-6 rounded-r-[4px] transition-[filter]"
                style={{
                  width: `${pct}%`,
                  backgroundColor: TREND_COLOR,
                  filter: isHovered ? 'brightness(0.9)' : undefined,
                }}
              />
              {isHovered && (
                <div className="pointer-events-none absolute -top-8 left-0 z-10 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-lg">
                  {row.page}: {row.count}
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
