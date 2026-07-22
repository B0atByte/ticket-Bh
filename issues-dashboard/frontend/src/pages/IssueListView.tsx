import { ExternalLink, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  fetchActiveIssues,
  fetchHistoryIssues,
  updateIssueStatus,
  type Issue,
  type IssueStatusValue,
  type Severity,
  type SourceStatus,
} from '../lib/api'
import { useI18n } from '../lib/i18n'

const SYSTEM_COLORS: Record<string, string> = {
  Bhlogisticssystem: 'bg-blue-100 text-blue-800',
  PRsystem: 'bg-purple-100 text-purple-800',
  'lms-casa': 'bg-emerald-100 text-emerald-800',
  xBloom: 'bg-pink-100 text-pink-800',
  'QSC-Sytem': 'bg-amber-100 text-amber-800',
}

const SYSTEM_URLS: Record<string, string> = {
  Bhlogisticssystem: 'http://localhost:5173',
  PRsystem: 'http://localhost:5174',
  'lms-casa': 'http://localhost:5175',
  xBloom: 'http://localhost:5176',
  'QSC-Sytem': 'http://localhost:8083',
}

function badgeClass(system: string): string {
  return SYSTEM_COLORS[system] ?? 'bg-slate-100 text-slate-800'
}

function systemLink(issue: Pick<Issue, 'system' | 'page'>): string | null {
  const base = SYSTEM_URLS[issue.system]
  if (!base) return null
  return issue.page ? `${base}${issue.page}` : base
}

const STATUS_KEYS: Record<IssueStatusValue, string> = {
  submitted: 'status.submitted',
  acknowledged: 'status.acknowledged',
  resolved: 'status.resolved',
}

const ALL_STATUSES: IssueStatusValue[] = ['submitted', 'acknowledged', 'resolved']

const SEVERITY_KEYS: Record<Severity, string> = {
  critical: 'severity.critical',
  high: 'severity.high',
  normal: 'severity.normal',
}

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-amber-100 text-amber-800',
  normal: 'bg-slate-100 text-slate-800',
}

function formatTime(iso: string, lang: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(lang === 'en' ? 'en-GB' : 'th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

function isWithinDays(iso: string, days: number): boolean {
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return false
  return Date.now() - d <= days * 24 * 60 * 60 * 1000
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

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
  const [search, setSearch] = useState('')
  const [systemFilter, setSystemFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = tab === 'active' ? await fetchActiveIssues() : await fetchHistoryIssues()
      setIssues(data.issues)
      onSourcesChange?.(data.sources)
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') {
        onLoggedOut()
        return
      }
      setError(err instanceof Error ? err.message : t('list.loadFail'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function handleStatusChange(issue: Issue, status: IssueStatusValue) {
    try {
      await updateIssueStatus(issue.system, issue.id, status)
      load()
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') {
        onLoggedOut()
        return
      }
      setError(err instanceof Error ? err.message : t('card.statusUpdateFail'))
    }
  }

  const filtered = useMemo(() => {
    return issues.filter((issue) => {
      if (systemFilter !== 'all' && issue.system !== systemFilter) return false
      if (dateFilter === 'today' && !isToday(issue.createdAt)) return false
      if (dateFilter === '7d' && !isWithinDays(issue.createdAt, 7)) return false
      if (dateFilter === '30d' && !isWithinDays(issue.createdAt, 30)) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        issue.description.toLowerCase().includes(q) ||
        (issue.page ?? '').toLowerCase().includes(q) ||
        (issue.reporterName ?? '').toLowerCase().includes(q)
      )
    })
  }, [issues, search, systemFilter, dateFilter])

  const systems = useMemo(() => Array.from(new Set(issues.map((i) => i.system))), [issues])

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
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">{t('list.empty')}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((issue) => (
            <div key={`${issue.system}-${issue.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {systemLink(issue) ? (
                  <a
                    href={systemLink(issue)!}
                    target="_blank"
                    rel="noopener noreferrer"
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
                <span className="ml-auto text-xs text-slate-400">{formatTime(issue.createdAt, lang)}</span>
              </div>
              <p className="mb-2 whitespace-pre-wrap text-sm text-slate-800">{issue.description}</p>
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
                <select
                  value={issue.status}
                  onChange={(e) => handleStatusChange(issue, e.target.value as IssueStatusValue)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-slate-500"
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(STATUS_KEYS[s])}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
