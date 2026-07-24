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

  'maintab.issues': { th: 'รายการแจ้งปัญหา', en: 'Issue List' },
  'maintab.analytics': { th: 'แดชบอร์ดภาพรวม', en: 'Analytics Dashboard' },

  'tab.history': { th: 'ประวัติ', en: 'History' },

  'kpi.total': { th: 'ทั้งหมด', en: 'Total' },

  'analytics.range.7d': { th: '7 วันล่าสุด', en: 'Last 7 days' },
  'analytics.range.30d': { th: '30 วันล่าสุด', en: 'Last 30 days' },
  'analytics.range.90d': { th: '90 วันล่าสุด', en: 'Last 90 days' },
  'analytics.range.all': { th: 'ทั้งหมด', en: 'All time' },

  'analytics.totalTickets': { th: 'จำนวนเรื่องแจ้งทั้งหมด', en: 'Total tickets received' },
  'analytics.resolutionRate': { th: 'อัตราการแก้ปัญหาสำเร็จ', en: 'Resolution rate' },
  'analytics.avgResolutionTime': { th: 'เวลาเฉลี่ยที่ใช้แก้ปัญหา', en: 'Average resolution time' },
  'analytics.na': { th: 'ไม่มีข้อมูล', en: 'N/A' },

  'analytics.issuesBySystem': { th: 'ปัญหาแยกตามระบบ', en: 'Issues by system' },
  'analytics.topPages': { th: 'หน้าที่ถูกแจ้งปัญหาบ่อยที่สุด', en: 'Most reported pages' },
  'analytics.categoryBySystem': { th: 'หมวดหมู่ปัญหาแยกตามระบบ', en: 'Issue categories by system' },
  'analytics.trend': { th: 'แนวโน้มปัญหาที่แจ้งเข้ามา', en: 'Issue trend' },
  'analytics.noData': { th: 'ยังไม่มีข้อมูลในช่วงนี้', en: 'No data in this period' },
  'analytics.loading': { th: 'กำลังโหลดข้อมูลวิเคราะห์...', en: 'Loading analytics...' },

  'duration.minutes': { th: '{n} นาที', en: '{n} min' },
  'duration.hours': { th: '{n} ชม.', en: '{n} hr' },
  'duration.daysHours': { th: '{d} วัน {h} ชม.', en: '{d}d {h}h' },

  'filter.searchPlaceholder': { th: 'ค้นหาปัญหา...', en: 'Search issues...' },
  'filter.allSystems': { th: 'ทุกระบบ', en: 'All systems' },
  'filter.allDates': { th: 'ทุกวันที่', en: 'All dates' },
  'filter.today': { th: 'วันนี้', en: 'Today' },
  'filter.7d': { th: '7 วันล่าสุด', en: 'Last 7 days' },
  'filter.30d': { th: '30 วันล่าสุด', en: 'Last 30 days' },

  'list.loading': { th: 'กำลังโหลด...', en: 'Loading...' },
  'list.empty': { th: 'ไม่มีรายการแจ้งปัญหา', en: 'No issues' },
  'list.loadFail': { th: 'โหลดข้อมูลไม่สำเร็จ', en: 'Failed to load data' },
  'list.serviceDown': {
    th: 'ไม่สามารถโหลดข้อมูลได้ตอนนี้ — เชื่อมต่อ issue-service ไม่ได้ (ไม่ใช่ว่าไม่มีปัญหา)',
    en: 'Unable to load data right now — cannot reach issue-service (this does not mean there are no issues)',
  },

  'card.page': { th: 'หน้า: {page}', en: 'Page: {page}' },
  'card.reporter': { th: 'ผู้แจ้ง: ', en: 'Reporter: ' },
  'card.unknown': { th: 'ไม่ระบุ', en: 'Unknown' },
  'card.statusUpdateFail': { th: 'อัปเดตสถานะไม่สำเร็จ', en: 'Failed to update status' },

  // Admin-facing wording — deliberately different from what the reporter
  // sees for "submitted" (they get 'ส่งเรื่องแล้ว', admins get 'ใหม่').
  'status.submitted': { th: 'ใหม่', en: 'New' },
  'status.acknowledged': { th: 'รับเรื่องแล้ว', en: 'Acknowledged' },
  'status.resolved': { th: 'แก้ไขเสร็จสิ้น', en: 'Resolved' },

  'card.severity': { th: 'ความเร่งด่วน: ', en: 'Severity: ' },
  'severity.critical': { th: 'ด่วนที่สุด', en: 'Critical' },
  'severity.high': { th: 'ด่วน', en: 'High' },
  'severity.normal': { th: 'ทั่วไป', en: 'Normal' },

  'filter.allCategories': { th: 'ทุกหมวดหมู่', en: 'All categories' },
  'category.system_error': { th: 'ระบบขัดข้อง', en: 'System error' },
  'category.payment': { th: 'การชำระเงินผิดพลาด', en: 'Payment issue' },
  'category.account': { th: 'บัญชีผู้ใช้', en: 'Account' },
  'category.feedback': { th: 'ข้อเสนอแนะ', en: 'Feedback' },
  'category.other': { th: 'อื่นๆ', en: 'Other' },

  'detail.subject': { th: 'หัวข้อ', en: 'Subject' },
  'detail.category': { th: 'หมวดหมู่', en: 'Category' },
  'detail.contact': { th: 'ช่องทางติดต่อกลับ', en: 'Contact info' },
  'detail.device': { th: 'อุปกรณ์ / เบราว์เซอร์', en: 'Device / browser' },
  'detail.appVersion': { th: 'เวอร์ชันแอป', en: 'App version' },
  'detail.timeline': { th: 'ไทม์ไลน์', en: 'Timeline' },
  'detail.updateStatus': { th: 'อัปเดตสถานะ', en: 'Update status' },
  'detail.noteLabel': { th: 'หมายเหตุถึงผู้แจ้ง (ไม่บังคับ)', en: "Note to reporter (optional)" },
  'detail.notePlaceholder': { th: 'อธิบายว่าแก้ไขอย่างไร หรือเกิดจากอะไร...', en: 'Explain what was fixed or what happened...' },
  'detail.save': { th: 'บันทึก', en: 'Save' },
  'detail.saving': { th: 'กำลังบันทึก...', en: 'Saving...' },
  'detail.close': { th: 'ปิด', en: 'Close' },
  'detail.comments': { th: 'ความคิดเห็น', en: 'Comments' },
  'detail.noComments': { th: 'ยังไม่มีความคิดเห็น', en: 'No comments yet' },
  'detail.commentPlaceholder': { th: 'พิมพ์ข้อความ...', en: 'Type a message...' },
  'detail.send': { th: 'ส่ง', en: 'Send' },
  'detail.commentFail': { th: 'ส่งความคิดเห็นไม่สำเร็จ', en: 'Failed to send comment' },
  'detail.statusUpdateFail': { th: 'อัปเดตสถานะไม่สำเร็จ', en: 'Failed to update status' },
  'detail.loadFail': { th: 'โหลดรายละเอียดไม่สำเร็จ', en: 'Failed to load detail' },
  'detail.authorReporter': { th: 'ผู้แจ้ง', en: 'Reporter' },
  'detail.authorAdmin': { th: 'แอดมิน', en: 'Admin' },
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
