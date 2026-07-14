import { LogOut, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { clearToken, fetchIssues, type Issue, type SourceStatus } from '../lib/api'

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

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function DashboardPage({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [sources, setSources] = useState<SourceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [systemFilter, setSystemFilter] = useState('all')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchIssues()
      setIssues(data.issues)
      setSources(data.sources)
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') {
        onLoggedOut()
        return
      }
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    return issues.filter((issue) => {
      if (systemFilter !== 'all' && issue.system !== systemFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        issue.description.toLowerCase().includes(q) ||
        (issue.page ?? '').toLowerCase().includes(q) ||
        (issue.reporterName ?? '').toLowerCase().includes(q)
      )
    })
  }, [issues, search, systemFilter])

  const systems = useMemo(() => Array.from(new Set(issues.map((i) => i.system))), [issues])

  function handleLogout() {
    clearToken()
    onLoggedOut()
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Issues Dashboard</h1>
            <p className="text-sm text-slate-500">รวมรายการแจ้งปัญหาจากทั้ง 5 ระบบ</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              รีเฟรช
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <LogOut size={14} />
              ออกจากระบบ
            </button>
          </div>
        </div>

        {sources.some((s) => !s.ok) && (
          <div className="mb-4 flex flex-wrap gap-2">
            {sources
              .filter((s) => !s.ok)
              .map((s) => (
                <span key={s.system} className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700">
                  {s.system}: ดึงข้อมูลไม่สำเร็จ{s.error ? ` (${s.error})` : ''}
                </span>
              ))}
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-500"
            />
          </div>
          <select
            value={systemFilter}
            onChange={(e) => setSystemFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            <option value="all">ทุกระบบ</option>
            {systems.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {loading && issues.length === 0 ? (
          <p className="text-sm text-slate-500">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่มีรายการแจ้งปัญหา</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((issue) => (
              <div key={`${issue.system}-${issue.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass(issue.system)}`}>
                    {issue.system}
                  </span>
                  <span className="text-xs text-slate-400">{formatTime(issue.createdAt)}</span>
                </div>
                <p className="mb-2 whitespace-pre-wrap text-sm text-slate-800">{issue.description}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {issue.page && <span>หน้า: {issue.page}</span>}
                  <span>
                    ผู้แจ้ง:{' '}
                    {issue.reporterName
                      ? `${issue.reporterName}${issue.reporterRole ? ` (${issue.reporterRole})` : ''}`
                      : 'ไม่ระบุ'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
