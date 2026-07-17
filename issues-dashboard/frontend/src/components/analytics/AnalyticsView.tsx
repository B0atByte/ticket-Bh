import { BarChart3, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fetchAllIssues, type Issue } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import IssuesBySystemChart, { type SystemCount } from './IssuesBySystemChart'
import { SYSTEM_ORDER } from './palette'
import StatTile from './StatTile'
import TrendLineChart, { type DayCount } from './TrendLineChart'

type Range = '7d' | '30d' | '90d' | 'all'
const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 }

function isWithinDays(iso: string, days: number): boolean {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t <= days * 24 * 60 * 60 * 1000
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildTrend(issues: Issue[], days: number): DayCount[] {
  const counts = new Map<string, number>()
  for (const i of issues) counts.set(dayKey(i.createdAt), (counts.get(dayKey(i.createdAt)) ?? 0) + 1)
  const result: DayCount[] = []
  const today = new Date()
  for (let offset = days - 1; offset >= 0; offset--) {
    const d = new Date(today)
    d.setDate(d.getDate() - offset)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    result.push({ date: key, count: counts.get(key) ?? 0 })
  }
  return result
}

export default function AnalyticsView({ onLoggedOut }: { onLoggedOut: () => void }) {
  const { t, lang } = useI18n()
  const [range, setRange] = useState<Range>('30d')
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchAllIssues()
      .then((data) => {
        if (!cancelled) setIssues(data.issues)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof Error && err.message === 'Unauthorized') {
          onLoggedOut()
          return
        }
        setError(err instanceof Error ? err.message : t('list.loadFail'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    if (range === 'all') return issues
    return issues.filter((i) => isWithinDays(i.createdAt, RANGE_DAYS[range]))
  }, [issues, range])

  const resolved = useMemo(() => filtered.filter((i) => i.status === 'Resolved'), [filtered])

  const resolutionRate = filtered.length > 0 ? (resolved.length / filtered.length) * 100 : 0

  const avgResolutionMs = useMemo(() => {
    const durations = resolved
      .filter((i) => i.statusUpdatedAt)
      .map((i) => new Date(i.statusUpdatedAt as string).getTime() - new Date(i.createdAt).getTime())
      .filter((ms) => Number.isFinite(ms) && ms >= 0)
    if (durations.length === 0) return null
    return durations.reduce((a, b) => a + b, 0) / durations.length
  }, [resolved])

  function formatDuration(ms: number): string {
    const hour = 60 * 60 * 1000
    const day = 24 * hour
    if (ms < hour) return t('duration.minutes', { n: Math.max(1, Math.round(ms / 60000)) })
    if (ms < day) return t('duration.hours', { n: Math.round((ms / hour) * 10) / 10 })
    return t('duration.daysHours', { d: Math.floor(ms / day), h: Math.round((ms % day) / hour) })
  }

  const bySystem: SystemCount[] = useMemo(() => {
    const counts = new Map<string, number>(SYSTEM_ORDER.map((s) => [s, 0]))
    for (const i of filtered) counts.set(i.system, (counts.get(i.system) ?? 0) + 1)
    return Array.from(counts, ([system, count]) => ({ system, count })).sort((a, b) => b.count - a.count)
  }, [filtered])

  const trendDays = useMemo(() => {
    if (range !== 'all') return RANGE_DAYS[range]
    if (issues.length === 0) return 30
    const oldest = Math.min(...issues.map((i) => new Date(i.createdAt).getTime()))
    return Math.max(1, Math.ceil((Date.now() - oldest) / (24 * 60 * 60 * 1000)) + 1)
  }, [range, issues])

  const trend = useMemo(() => buildTrend(filtered, trendDays), [filtered, trendDays])

  const rangeOptions: { key: Range; label: string }[] = [
    { key: '7d', label: t('analytics.range.7d') },
    { key: '30d', label: t('analytics.range.30d') },
    { key: '90d', label: t('analytics.range.90d') },
    { key: 'all', label: t('analytics.range.all') },
  ]

  return (
    <div>
      {/* Date range — one row, above everything it scopes (dataviz: filters & time ranges) */}
      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {rangeOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setRange(opt.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              range === opt.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading && issues.length === 0 ? (
        <p className="text-sm text-slate-500">{t('analytics.loading')}</p>
      ) : (
        <div className="space-y-4" style={{ opacity: loading ? 0.6 : 1 }}>
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label={t('analytics.totalTickets')} value={filtered.length.toLocaleString()} />
            <StatTile label={t('analytics.resolutionRate')} value={`${resolutionRate.toFixed(0)}%`} sub={`${resolved.length}/${filtered.length}`} />
            <StatTile
              label={t('analytics.avgResolutionTime')}
              value={avgResolutionMs !== null ? formatDuration(avgResolutionMs) : t('analytics.na')}
            />
          </div>

          {/* Issues by system */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">{t('analytics.issuesBySystem')}</h2>
            </div>
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t('analytics.noData')}</p>
            ) : (
              <IssuesBySystemChart data={bySystem} />
            )}
          </div>

          {/* Trend */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">{t('analytics.trend')}</h2>
            </div>
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t('analytics.noData')}</p>
            ) : (
              <TrendLineChart data={trend} lang={lang} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
