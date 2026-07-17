import { AlertTriangle, ChevronDown, History, ListChecks, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  fetchActiveIssues,
  fetchHistoryIssues,
  updateIssueStatus,
  type Issue,
  type IssueStatusValue,
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

function badgeClass(system: string): string {
  return SYSTEM_COLORS[system] ?? 'bg-slate-100 text-slate-800'
}

const STATUS_KEYS: Record<IssueStatusValue, string> = {
  New: 'status.New',
  'In Progress': 'status.InProgress',
  Resolved: 'status.Resolved',
}

const ALL_STATUSES: IssueStatusValue[] = ['New', 'In Progress', 'Resolved']

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
type Tab = 'active' | 'history'

export default function IssueListView({ onLoggedOut }: { onLoggedOut: () => void }) {
  const { t, lang } = useI18n()
  const [tab, setTab] = useState<Tab>('active')
  const [issues, setIssues] = useState<Issue[]>([])
  const [sources, setSources] = useState<SourceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [systemFilter, setSystemFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [statusExpanded, setStatusExpanded] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = tab === 'active' ? await fetchActiveIssues() : await fetchHistoryIssues()
      setIssues(data.issues)
      setSources(data.sources)
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

  const okCount = sources.filter((s) => s.ok).length
  const totalSources = sources.length
  const failedSources = sources.filter((s) => !s.ok)
  const connectionTone =
    totalSources === 0 || okCount === totalSources
      ? 'good'
      : okCount === 0
        ? 'critical'
        : 'warning'
  const connectionStyles: Record<string, string> = {
    good: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    critical: 'bg-red-50 text-red-800 border-red-200',
  }
  const connectionDot: Record<string, string> = {
    good: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  }

  return (
    <div>
      {/* Connection status */}
      <div
        className={`mb-4 rounded-xl border px-4 py-2.5 text-sm ${connectionStyles[connectionTone]}`}
      >
        <button
          onClick={() => setStatusExpanded((v) => !v)}
          disabled={failedSources.length === 0}
          className="flex w-full items-center gap-2 text-left disabled:cursor-default"
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${connectionDot[connectionTone]}`} />
          <span className="font-medium">
            {connectionTone === 'good'
              ? t('conn.good', { ok: okCount, total: totalSources })
              : t('conn.partial', { ok: okCount, total: totalSources })}
          </span>
          {failedSources.length > 0 && (
            <ChevronDown
              size={14}
              className={`ml-auto shrink-0 transition-transform ${statusExpanded ? 'rotate-180' : ''}`}
            />
          )}
        </button>
        {statusExpanded && failedSources.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-current/20 pt-2">
            {failedSources.map((s) => (
              <li key={s.system} className="flex items-center gap-1.5 text-xs">
                <AlertTriangle size={12} className="shrink-0" />
                {s.system}: {t('conn.failed')}
                {s.error ? ` (${s.error})` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tabs + KPI tile + refresh */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setTab('active')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === 'active' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ListChecks size={14} />
            {t('tab.active')}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === 'history' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History size={14} />
            {t('tab.history')}
          </button>
        </div>

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
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass(issue.system)}`}>
                  {issue.system}
                </span>
                <span className="text-xs text-slate-400">{formatTime(issue.createdAt, lang)}</span>
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
