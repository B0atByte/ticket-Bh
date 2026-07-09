import { useEffect, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { LogOut, Sun, Moon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { applyDocumentBranding, loadSettings, SETTINGS_EVENT } from '../lib/settings'

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  badge?: number
}

interface Props {
  navItems: NavItem[]
  activeTab: string
  onTabChange: (id: string) => void
  roleIcon: LucideIcon
  roleColor: string
  children: ReactNode
}

export function AppLayout({ navItems, activeTab, onTabChange, roleIcon: RoleIcon, roleColor, children }: Props) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    const refresh = () => setSettings(loadSettings())
    window.addEventListener(SETTINGS_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(SETTINGS_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    applyDocumentBranding(settings)
  }, [settings])

  return (
    <div className="flex min-h-screen bg-white dark:bg-slate-950">
      {/* ── Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-20 flex flex-col w-14 md:w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 shrink-0">

        {/* Brand */}
        <div className="flex items-center gap-2 px-3 md:px-4 h-16 border-b border-slate-100 dark:border-slate-800">
          <div className={`w-8 h-8 rounded-lg ${settings.logoDataUrl ? 'bg-white border border-slate-200 dark:border-slate-700' : roleColor} flex items-center justify-center shrink-0 overflow-hidden`}>
            {settings.logoDataUrl
              ? <img src={settings.logoDataUrl} alt={settings.systemName} className="h-full w-full object-contain p-1" />
              : <RoleIcon size={18} className="text-white" />
            }
          </div>
          <div className="hidden md:block min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
              {settings.systemName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight truncate">{user?.name.split(' ')[0]}</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-1 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group relative ${
                  active
                    ? 'bg-blue-600 text-white dark:bg-blue-600'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="relative shrink-0">
                  <Icon size={20} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="hidden md:block text-sm font-medium truncate">{item.label}</span>

                {/* Tooltip on mobile */}
                <div className="md:hidden absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                  {item.label}
                </div>
              </button>
            )
          })}
        </nav>

        {/* Bottom: theme toggle + logout */}
        <div className="border-t border-slate-100 dark:border-slate-800 p-2 space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group relative"
          >
            {theme === 'dark'
              ? <Sun size={20} className="shrink-0" />
              : <Moon size={20} className="shrink-0" />
            }
            <span className="hidden md:block text-sm font-medium">
              {theme === 'dark' ? 'Light' : 'Dark'}
            </span>
            <div className="md:hidden absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </div>
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors group relative"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="hidden md:block text-sm font-medium">ออก</span>
            <div className="md:hidden absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
              ออกจากระบบ
            </div>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 ml-14 md:ml-56 min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
        {children}
      </main>
    </div>
  )
}

// Shared top bar for content area
export function ContentHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  )
}
