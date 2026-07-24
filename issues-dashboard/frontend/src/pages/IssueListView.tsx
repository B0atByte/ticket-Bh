import { ExternalLink, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fetchActiveIssues, fetchHistoryIssues, type Issue, type SourceStatus } from '../lib/api'
import IssueDetailPanel from '../components/IssueDetailPanel'
import { useI18n } from '../lib/i18n'
import {
  SEVERITY_COLORS,
  SEVERITY_KEYS,
  STATUS_KEYS,
  badgeClass,
  categoryKey,
  formatTime,
  isToday,
  isWithinDays,
  systemLink,
} from '../lib/issueDisplay'

type DateFilter = 'all' | 'today' | '7d' | '30d'
export type Tab = 'active' | 'history'

export default function IssueListView({
  tab,
  onLoggedOut,
  onSourcesChange,
}: {
  tab: Tab
  onLoggedOut: () => void
  onSourcesChange?: (sources: SourceStatus[]) => void
}) {
  const { t, lang } = useI18n()
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [serviceDown, setServiceDown] = useState(false)
  const [search, setSearch] = useState('')
  const [systemFilter, setSystemFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = tab === 'active' ? await fetchActiveIssues() : await fetchHistoryIssues()
      setIssues(data.issues)
      setServiceDown(data.sources.some((s) => !s.ok))
      onSourcesChange?.(data.sources)
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') {
        onLoggedOut()
        return
      }
      setServiceDown(false)
      setError(err instanceof Error ? err.message : t('list.loadFail'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const filtered = useMemo(() => {
    return issues.filter((issue) => {
      if (systemFilter !== 'all' && issue.system !== systemFilter) return false
      if (categoryFilter !== 'all' && issue.category !== categoryFilter) return false
      if (dateFilter === 'today' && !isToday(issue.createdAt)) return false
      if (dateFilter === '7d' && !isWithinDays(issue.createdAt, 7)) return false
      if (dateFilter === '30d' && !isWithinDays(issue.createdAt, 30)) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        issue.subject.toLowerCase().includes(q) ||
        issue.description.toLowerCase().includes(q) ||
        (issue.page ?? '').toLowerCase().includes(q) ||
        (issue.reporterName ?? '').toLowerCase().includes(q)
      )
    })
  }, [issues, search, systemFilter, categoryFilter, dateFilter])

  const systems = useMemo(() => Array.from(new Set(issues.map((i) => i.system))), [issues])
  const categories = useMemo(() => Array.from(new Set(issues.map((i) => i.category))), [issues])

  const stats = useMemo(() => ({ total: issues.length }), [issues])

  return (
    <div>
      {/* KPI tile + refresh */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <p className="text-xs text-slate-500">{t('kpi.total')}</p>
          <p className="text-xl font-semibold text-slate-900">{stats.total}</p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {t('header.refresh')}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filter.searchPlaceholder')}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-500"
          />
        </div>
        <select
          value={systemFilter}
          onChange={(e) => setSystemFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
        >
          <option value="all">{t('filter.allSystems')}</option>
          {systems.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
        >
          <option value="all">{t('filter.allCategories')}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {t(categoryKey(c))}
            </option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
        >
          <option value="all">{t('filter.allDates')}</option>
          <option value="today">{t('filter.today')}</option>
          <option value="7d">{t('filter.7d')}</option>
          <option value="30d">{t('filter.30d')}</option>
        </select>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading && issues.length === 0 ? (
        <p className="text-sm text-slate-500">{t('list.loading')}</p>
      ) : serviceDown ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {t('list.serviceDown')}
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">{t('list.empty')}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((issue) => (
            <button
              type="button"
              key={`${issue.system}-${issue.id}`}
              onClick={() => setSelectedIssueId(issue.id)}
              className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {systemLink(issue) ? (
                  <a
                    href={systemLink(issue)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition hover:opacity-80 ${badgeClass(issue.system)}`}
                  >
                    {issue.system}
                    <ExternalLink size={11} className="shrink-0" />
                  </a>
                ) : (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass(issue.system)}`}>
                    {issue.system}
                  </span>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_COLORS[issue.severity]}`}>
                  {t(SEVERITY_KEYS[issue.severity])}
                </span>
                <span className="text-xs font-medium text-slate-500">#{t(categoryKey(issue.category))}</span>
                <span className="ml-auto text-xs text-slate-400">{formatTime(issue.createdAt, lang)}</span>
              </div>
              <p className="mb-1 text-sm font-semibold text-slate-900">{issue.subject || issue.description}</p>
              {issue.subject && <p className="mb-2 line-clamp-2 whitespace-pre-wrap text-sm text-slate-600">{issue.description}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {issue.page && <span>{t('card.page', { page: issue.page })}</span>}
                  <span>
                    {t('card.reporter')}
                    {issue.reporterName
                      ? `${issue.reporterName}${issue.reporterRole ? ` (${issue.reporterRole})` : ''}`
                      : t('card.unknown')}
                  </span>
                </div>
                <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {t(STATUS_KEYS[issue.status])}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedIssueId && (
        <IssueDetailPanel
          issueId={selectedIssueId}
          onClose={() => setSelectedIssueId(null)}
          onChanged={load}
          onLoggedOut={onLoggedOut}
        />
      )}
    </div>
  )
}
