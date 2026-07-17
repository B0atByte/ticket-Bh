// Urgency the reporter picks on the form — forces an explicit choice instead
// of free text, so admins can triage at a glance. Order matters: most severe
// first, used wherever severities are listed for a picker UI.
export const SEVERITIES = ['critical', 'high', 'normal'] as const
export type Severity = (typeof SEVERITIES)[number]

export const SEVERITY_META: Record<Severity, { emoji: string; label: string; color: number }> = {
  critical: { emoji: '🔴', label: 'ด่วนที่สุด', color: 0xdc2626 },
  high: { emoji: '🟡', label: 'ด่วน', color: 0xf59e0b },
  normal: { emoji: '🟢', label: 'ทั่วไป', color: 0x22c55e },
}

// Lifecycle of a single issue. Set on creation (submitted) and only ever
// changed by an admin via PATCH /:id/status — each change is appended to
// issue_status_history so the reporter can see a timeline, not just the
// current state.
export const STATUSES = ['submitted', 'acknowledged', 'pending_user', 'resolved'] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_META: Record<Status, { emoji: string; label: string }> = {
  submitted: { emoji: '⚪', label: 'ส่งเรื่องแล้ว' },
  acknowledged: { emoji: '🔵', label: 'รับเรื่องแล้ว' },
  pending_user: { emoji: '🟡', label: 'รอข้อมูลเพิ่มเติม' },
  resolved: { emoji: '🟢', label: 'แก้ไขเรียบร้อย' },
}
