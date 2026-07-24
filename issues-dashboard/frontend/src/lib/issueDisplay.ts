import type { Issue, IssueStatusValue, Severity } from './api'

export const SYSTEM_URLS: Record<string, string> = {
  Bhlogisticssystem: 'http://localhost:5173',
  PRsystem: 'http://localhost:5174',
  'lms-casa': 'http://localhost:5175',
  xBloom: 'http://localhost:5176',
  'QSC-Sytem': 'http://localhost:8083',
}

// Same outline style for every system now — no per-system fill color.
export function badgeClass(_system: string): string {
  return 'border border-sky-300 text-blue-600'
}

export function systemLink(issue: Pick<Issue, 'system' | 'page'>): string | null {
  const base = SYSTEM_URLS[issue.system]
  if (!base) return null
  return issue.page ? `${base}${issue.page}` : base
}

export const STATUS_KEYS: Record<IssueStatusValue, string> = {
  submitted: 'status.submitted',
  acknowledged: 'status.acknowledged',
  resolved: 'status.resolved',
}

export const ALL_STATUSES: IssueStatusValue[] = ['submitted', 'acknowledged', 'resolved']

export const SEVERITY_KEYS: Record<Severity, string> = {
  critical: 'severity.critical',
  high: 'severity.high',
  normal: 'severity.normal',
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  normal: 'bg-green-100 text-green-800',
}

// Categories are an open-ended-ish enum server-side (falls back to 'other'
// for anything unrecognized) — key map mirrors that with a fallback branch
// rather than assuming every value has an entry.
export const CATEGORY_KEYS: Record<string, string> = {
  system_error: 'category.system_error',
  payment: 'category.payment',
  account: 'category.account',
  feedback: 'category.feedback',
  other: 'category.other',
}

export function categoryKey(category: string): string {
  return CATEGORY_KEYS[category] ?? CATEGORY_KEYS.other
}

export function formatTime(iso: string, lang: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(lang === 'en' ? 'en-GB' : 'th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

export function isWithinDays(iso: string, days: number): boolean {
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return false
  return Date.now() - d <= days * 24 * 60 * 60 * 1000
}

export function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}
