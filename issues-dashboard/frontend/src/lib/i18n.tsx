import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'th' | 'en'
const STORAGE_KEY = 'issues_dashboard_lang'

type Entry = { th: string; en: string }

// Flat dictionary. Keys are dotted by area. Add new strings here only.
const DICT: Record<string, Entry> = {
  'app.subtitle': { th: 'รวมรายการแจ้งปัญหาจากทั้ง 5 ระบบ', en: 'Combined issue reports from all 5 systems' },

  'login.passwordLabel': { th: 'รหัสผ่าน Admin', en: 'Admin password' },
  'login.submit': { th: 'เข้าสู่ระบบ', en: 'Log in' },
  'login.submitting': { th: 'กำลังเข้าสู่ระบบ...', en: 'Logging in...' },
  'login.fail': { th: 'เข้าสู่ระบบไม่สำเร็จ', en: 'Login failed' },

  'header.refresh': { th: 'รีเฟรช', en: 'Refresh' },
  'header.logout': { th: 'ออกจากระบบ', en: 'Log out' },

  'conn.good': { th: 'เชื่อมต่อปกติ {ok}/{total} ระบบ', en: 'Connected {ok}/{total} systems' },
  'conn.partial': { th: 'เชื่อมต่อได้บางส่วน {ok}/{total} ระบบ', en: 'Partially connected {ok}/{total} systems' },
  'conn.failed': { th: 'ดึงข้อมูลไม่สำเร็จ', en: 'failed to fetch' },

  'tab.active': { th: 'ใหม่ / กำลังดำเนินการ', en: 'New / In Progress' },
  'tab.history': { th: 'ประวัติ', en: 'History' },

  'kpi.total': { th: 'ทั้งหมด', en: 'Total' },

  'filter.searchPlaceholder': { th: 'ค้นหาปัญหา...', en: 'Search issues...' },
  'filter.allSystems': { th: 'ทุกระบบ', en: 'All systems' },
  'filter.allDates': { th: 'ทุกวันที่', en: 'All dates' },
  'filter.today': { th: 'วันนี้', en: 'Today' },
  'filter.7d': { th: '7 วันล่าสุด', en: 'Last 7 days' },
  'filter.30d': { th: '30 วันล่าสุด', en: 'Last 30 days' },

  'list.loading': { th: 'กำลังโหลด...', en: 'Loading...' },
  'list.empty': { th: 'ไม่มีรายการแจ้งปัญหา', en: 'No issues' },
  'list.loadFail': { th: 'โหลดข้อมูลไม่สำเร็จ', en: 'Failed to load data' },

  'card.page': { th: 'หน้า: {page}', en: 'Page: {page}' },
  'card.reporter': { th: 'ผู้แจ้ง: ', en: 'Reporter: ' },
  'card.unknown': { th: 'ไม่ระบุ', en: 'Unknown' },
  'card.statusUpdateFail': { th: 'อัปเดตสถานะไม่สำเร็จ', en: 'Failed to update status' },

  'status.New': { th: 'ใหม่', en: 'New' },
  'status.InProgress': { th: 'กำลังดำเนินการ', en: 'In Progress' },
  'status.Resolved': { th: 'แก้ไขแล้ว', en: 'Resolved' },
}

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as Lang | null
    return saved === 'en' || saved === 'th' ? saved : 'th'
  })

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const entry = DICT[key]
      let s = entry ? entry[lang] : key
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
      return s
    },
    [lang]
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
