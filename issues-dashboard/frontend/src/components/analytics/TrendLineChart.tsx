import { useMemo, useRef, useState } from 'react'
import { CHROME, TREND_COLOR } from './palette'

export interface DayCount {
  date: string // YYYY-MM-DD
  count: number
}

const WIDTH = 720
const HEIGHT = 220
const PAD = { top: 16, right: 12, bottom: 28, left: 32 }

function niceMax(max: number): number {
  if (max <= 5) return 5
  const magnitude = 10 ** Math.floor(Math.log10(max))
  const step = magnitude / 2
  return Math.ceil(max / step) * step
}

// Single-series line + area (see dataviz skill — trend-over-time job, one
// series needs no legend box; the card title already names what's plotted).
// Mouse/touch crosshair snaps to the nearest day and shows date+value.
export default function TrendLineChart({ data, lang }: { data: DayCount[]; lang: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const maxCount = useMemo(() => niceMax(Math.max(1, ...data.map((d) => d.count))), [data])

  const points = useMemo(
    () =>
      data.map((d, i) => ({
        x: PAD.left + (data.length <= 1 ? 0 : (i / (data.length - 1)) * plotW),
        y: PAD.top + plotH - (d.count / maxCount) * plotH,
        ...d,
      })),
    [data, maxCount, plotW, plotH]
  )

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x.toFixed(2)},${PAD.top + plotH} L${points[0].x.toFixed(2)},${PAD.top + plotH} Z`
      : ''

  const yTicks = [0, 0.5, 1].map((t) => Math.round(maxCount * t))

  // Show ~6 evenly-spaced x-axis date labels, never one per day (clutter).
  const xTickEvery = Math.max(1, Math.ceil(data.length / 6))

  function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short' })
  }

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg || points.length === 0) return
    const rect = svg.getBoundingClientRect()
    const scaleX = WIDTH / rect.width
    const localX = (e.clientX - rect.left) * scaleX
    let nearest = 0
    let best = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(p.x - localX)
      if (d < best) {
        best = d
        nearest = i
      }
    })
    setHoverIdx(nearest)
  }

  const hovered = hoverIdx !== null ? points[hoverIdx] : null
  const lastPoint = points[points.length - 1]

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIdx(null)}
        role="img"
      >
        {/* gridlines */}
        {yTicks.map((t) => {
          const y = PAD.top + plotH - (t / maxCount) * plotH
          return (
            <g key={t}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} stroke={CHROME.gridline} strokeWidth={1} />
              <text x={PAD.left - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={CHROME.textMuted}>
                {t.toLocaleString()}
              </text>
            </g>
          )
        })}

        {/* baseline */}
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke={CHROME.baseline}
          strokeWidth={1}
        />

        {/* x-axis labels */}
        {points.map((p, i) =>
          i % xTickEvery === 0 || i === points.length - 1 ? (
            <text key={p.date} x={p.x} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill={CHROME.textMuted}>
              {formatDate(p.date)}
            </text>
          ) : null
        )}

        {/* area + line */}
        {areaPath && <path d={areaPath} fill={TREND_COLOR} opacity={0.1} />}
        {linePath && <path d={linePath} fill="none" stroke={TREND_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

        {/* end value label — "lines carry value at the end" */}
        {lastPoint && (
          <g>
            <circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={TREND_COLOR} stroke={CHROME.surface} strokeWidth={2} />
            <text x={lastPoint.x - 6} y={lastPoint.y - 10} textAnchor="end" fontSize={11} fontWeight={600} fill={CHROME.textPrimary}>
              {lastPoint.count}
            </text>
          </g>
        )}

        {/* crosshair */}
        {hovered && (
          <g>
            <line x1={hovered.x} x2={hovered.x} y1={PAD.top} y2={PAD.top + plotH} stroke={CHROME.baseline} strokeWidth={1} />
            <circle cx={hovered.x} cy={hovered.y} r={4} fill={TREND_COLOR} stroke={CHROME.surface} strokeWidth={2} />
          </g>
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100}%` }}
        >
          <div className="font-semibold">{hovered.count}</div>
          <div className="text-slate-300">{formatDate(hovered.date)}</div>
        </div>
      )}
    </div>
  )
}
