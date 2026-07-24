import { useState } from 'react'

export interface CategorySegment {
  key: string
  label: string
  count: number
  color: string
}

export interface SystemCategoryRow {
  system: string
  total: number
  segments: CategorySegment[]
}

export interface LegendEntry {
  key: string
  label: string
  color: string
}

// Composition-by-group job (see dataviz skill: stacked bar, categorical
// color per segment). Bar length still encodes each system's total (scaled
// to the shared max) so this reads alongside "issues by system" above it;
// segment proportions carry the category mix. Legend is mandatory here (5
// series) — never make the reader color-match unaided.
export default function CategoryBySystemChart({ data, legend }: { data: SystemCategoryRow[]; legend: LegendEntry[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const max = Math.max(1, ...data.map((d) => d.total))

  return (
    <div>
      <div className="space-y-2.5" role="img">
        {data.map((row) => {
          const outerPct = (row.total / max) * 100
          const visible = row.segments.filter((s) => s.count > 0)
          return (
            <div key={row.system} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-xs text-slate-600" title={row.system}>
                {row.system}
              </span>
              <div className="relative h-6 min-w-0 flex-1 rounded-sm bg-slate-50">
                <div className="flex h-6" style={{ width: `${outerPct}%` }}>
                  {visible.map((seg, i) => {
                    const hoverKey = `${row.system}-${seg.key}`
                    const isLast = i === visible.length - 1
                    return (
                      <div
                        key={seg.key}
                        className={`relative h-6 transition-[filter] ${isLast ? 'rounded-r-[4px]' : ''}`}
                        style={{
                          width: `${(seg.count / row.total) * 100}%`,
                          backgroundColor: seg.color,
                          marginRight: isLast ? 0 : 2,
                          filter: hovered === hoverKey ? 'brightness(0.9)' : undefined,
                        }}
                        onMouseEnter={() => setHovered(hoverKey)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered(hoverKey)}
                        onBlur={() => setHovered(null)}
                        tabIndex={0}
                      >
                        {hovered === hoverKey && (
                          <div className="pointer-events-none absolute -top-8 left-0 z-10 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-lg">
                            {seg.label}: {seg.count}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-medium text-slate-900">{row.total}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3">
        {legend.map((entry) => (
          <div key={entry.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-slate-600">{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
