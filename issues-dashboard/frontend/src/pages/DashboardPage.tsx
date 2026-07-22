import { BarChart3, History, LayoutDashboard, ListChecks, LogOut } from 'lucide-react'
import { useState } from 'react'
import AnalyticsView from '../components/analytics/AnalyticsView'
import LangToggle from '../components/LangToggle'
import { clearToken, type SourceStatus } from '../lib/api'
import { useI18n } from '../lib/i18n'
import IssueListView from './IssueListView'

type MainTab = 'issues' | 'history' | 'analytics'

export default function DashboardPage({ onLoggedOut }: { onLoggedOut: () => void }) {
  const { t } = useI18n()
  const [mainTab, setMainTab] = useState<MainTab>('issues')
  const [sources, setSources] = useState<SourceStatus[]>([])

  function handleLogout() {
    clearToken()
    onLoggedOut()
  }

  const okCount = sources.filter((s) => s.ok).length
  const totalSources = sources.length

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <LayoutDashboard size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-slate-900">Issue Management</h1>
                {totalSources > 0 && (
                  <span className="text-xs text-slate-400">
                    {okCount === totalSources
                      ? t('conn.good', { ok: okCount, total: totalSources })
                      : t('conn.partial', { ok: okCount, total: totalSources })}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">{t('app.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <LogOut size={14} />
              {t('header.logout')}
            </button>
          </div>
        </div>

        {/* Main tabs */}
        <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setMainTab('issues')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              mainTab === 'issues' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ListChecks size={14} />
            {t('maintab.issues')}
          </button>
          <button
            onClick={() => setMainTab('history')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              mainTab === 'history' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History size={14} />
            {t('tab.history')}
          </button>
          <button
            onClick={() => setMainTab('analytics')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              mainTab === 'analytics' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 size={14} />
            {t('maintab.analytics')}
          </button>
        </div>

        {mainTab === 'issues' ? (
          <IssueListView tab="active" onLoggedOut={onLoggedOut} onSourcesChange={setSources} />
        ) : mainTab === 'history' ? (
          <IssueListView tab="history" onLoggedOut={onLoggedOut} onSourcesChange={setSources} />
        ) : (
          <AnalyticsView onLoggedOut={onLoggedOut} />
        )}
      </div>
    </div>
  )
}
