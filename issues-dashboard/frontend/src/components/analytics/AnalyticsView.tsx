import { BarChart3, FileText, Layers, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fetchAllIssues, type Issue } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { categoryKey } from '../../lib/issueDisplay'
import CategoryBySystemChart, { type LegendEntry, type SystemCategoryRow } from './CategoryBySystemChart'
import IssuesBySystemChart, { type SystemCount } from './IssuesBySystemChart'
import { CATEGORY_ORDER, SYSTEM_ORDER, categoryColor } from './palette'
import StatTile from './StatTile'
import TopPagesChart, { type PageCount } from './TopPagesChart'
import TrendLineChart, { type DayCount } from './TrendLineChart'

const TOP_PAGES_LIMIT = 8

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
  const [serviceDown, setServiceDown] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchAllIssues()
      .then((data) => {
        if (cancelled) return
        setIssues(data.issues)
        setServiceDown(data.sources.some((s) => !s.ok))
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof Error && err.message === 'Unauthorized') {
          onLoggedOut()
          return
        }
        setServiceDown(false)
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

  const resolved = useMemo(() => filtered.filter((i) => i.status === 'resolved'), [filtered])

  const resolutionRate = filtered.length > 0 ? (resolved.length / filtered.length) * 100 : 0

  const avgResolutionMs = useMemo(() => {
    const durations = resolved
      .map((i) => new Date(i.updatedAt).getTime() - new Date(i.createdAt).getTime())
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

  // Which page/feature gets reported the most — points straight at the
  // broken spot instead of just "which system." Issues without a page
  // (nothing to point at) are excluded rather than bucketed as "unknown."
  const topPages: PageCount[] = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of filtered) {
      if (!i.page) continue
      counts.set(i.page, (counts.get(i.page) ?? 0) + 1)
    }
    return Array.from(counts, ([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_PAGES_LIMIT)
  }, [filtered])

  const categoryLegend: LegendEntry[] = useMemo(
    () => CATEGORY_ORDER.map((c) => ({ key: c, label: t(categoryKey(c)), color: categoryColor(c) })),
    [t]
  )

  const categoryBySystem: SystemCategoryRow[] = useMemo(() => {
    const bySys = new Map<string, Map<string, number>>(SYSTEM_ORDER.map((s) => [s, new Map()]))
    for (const i of filtered) {
      const bySysCat = bySys.get(i.system)
      if (!bySysCat) continue
      bySysCat.set(i.category, (bySysCat.get(i.category) ?? 0) + 1)
    }
    return Array.from(bySys, ([system, catCounts]) => {
      const segments = categoryLegend.map((entry) => ({
        key: entry.key,
        label: entry.label,
        count: catCounts.get(entry.key) ?? 0,
        color: entry.color,
      }))
      return { system, total: segments.reduce((sum, s) => sum + s.count, 0), segments }
    }).sort((a, b) => b.total - a.total)
  }, [filtered, categoryLegend])

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
      ) : serviceDown ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {t('list.serviceDown')}
        </p>
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

          {/* Category breakdown by system */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Layers size={16} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">{t('analytics.categoryBySystem')}</h2>
            </div>
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t('analytics.noData')}</p>
            ) : (
              <CategoryBySystemChart data={categoryBySystem} legend={categoryLegend} />
            )}
          </div>

          {/* Top reported pages */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FileText size={16} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">{t('analytics.topPages')}</h2>
            </div>
            {topPages.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t('analytics.noData')}</p>
            ) : (
              <TopPagesChart data={topPages} />
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
