import type { Issue, IssueStatusValue, Severity } from './api'

export const SYSTEM_COLORS: Record<string, string> = {
  Bhlogisticssystem: 'bg-blue-100 text-blue-800',
  PRsystem: 'bg-purple-100 text-purple-800',
  'lms-casa': 'bg-emerald-100 text-emerald-800',
  xBloom: 'bg-pink-100 text-pink-800',
  'QSC-Sytem': 'bg-amber-100 text-amber-800',
}

export const SYSTEM_URLS: Record<string, string> = {
  Bhlogisticssystem: 'http://localhost:5173',
  PRsystem: 'http://localhost:5174',
  'lms-casa': 'http://localhost:5175',
  xBloom: 'http://localhost:5176',
  'QSC-Sytem': 'http://localhost:8083',
}

export function badgeClass(system: string): string {
  return SYSTEM_COLORS[system] ?? 'bg-slate-100 text-slate-800'
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
  high: 'bg-amber-100 text-amber-800',
  normal: 'bg-slate-100 text-slate-800',
}

// Categories are an open-ended-ish enum server-side (falls back to 'other'
// for anything unrecognized) — key/color maps here mirror that with a
// fallback branch rather than assuming every value has an entry.
export const CATEGORY_KEYS: Record<string, string> = {
  system_error: 'category.system_error',
  payment: 'category.payment',
  account: 'category.account',
  feedback: 'category.feedback',
  other: 'category.other',
}

export const CATEGORY_COLORS: Record<string, string> = {
  system_error: 'bg-rose-100 text-rose-800',
  payment: 'bg-indigo-100 text-indigo-800',
  account: 'bg-cyan-100 text-cyan-800',
  feedback: 'bg-lime-100 text-lime-800',
  other: 'bg-slate-100 text-slate-800',
}

export function categoryKey(category: string): string {
  return CATEGORY_KEYS[category] ?? CATEGORY_KEYS.other
}

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other
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
