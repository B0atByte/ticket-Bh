// Urgency the reporter picks on the form — forces an explicit choice instead
// of free text, so admins can triage at a glance. Order matters: most severe
// first, used wherever severities are listed for a picker UI.
export const SEVERITIES = ['critical', 'high', 'normal'] as const
export type Severity = (typeof SEVERITIES)[number]

export const SEVERITY_META: Record<Severity, { label: string; color: number }> = {
  critical: { label: 'ด่วนที่สุด', color: 0xdc2626 },
  high: { label: 'ด่วน', color: 0xf59e0b },
  normal: { label: 'ทั่วไป', color: 0x22c55e },
}

// Lifecycle of a single issue. Set on creation (submitted) and only ever
// changed by an admin via PATCH /:id/status — each change is appended to
// issue_status_history so the reporter can see a timeline, not just the
// current state. Labels here are the reporter-facing wording — Issue
// Management shows its own admin-facing wording for the same values
// (see issues-dashboard/frontend/src/lib/i18n.tsx).
export const STATUSES = ['submitted', 'acknowledged', 'resolved'] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_META: Record<Status, { label: string }> = {
  submitted: { label: 'ส่งเรื่องแล้ว' },
  acknowledged: { label: 'รับเรื่องแล้ว' },
  resolved: { label: 'แก้ไขเสร็จสิ้น' },
}
