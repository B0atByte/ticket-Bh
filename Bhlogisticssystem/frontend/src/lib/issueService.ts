// Client for the central issue-service — deliberately separate from ./api.ts.
// That module attaches this app's own Bearer token to every request; reusing
// it here would leak this system's session token to a different origin.
export type Severity = 'critical' | 'high' | 'normal'

export interface SubmitIssueInput {
  description: string
  severity: Severity
  reporterId: string
  reporterName: string
  reporterRole?: string
  page?: string
  attachment?: File | null
}

const BASE_URL = import.meta.env.VITE_ISSUE_SERVICE_URL as string

export async function submitIssueReport(input: SubmitIssueInput): Promise<{ id: string }> {
  const fd = new FormData()
  fd.set('system', 'Bhlogisticssystem')
  fd.set('description', input.description)
  fd.set('severity', input.severity)
  fd.set('reporterId', input.reporterId)
  fd.set('reporterName', input.reporterName)
  if (input.reporterRole) fd.set('reporterRole', input.reporterRole)
  if (input.page) fd.set('page', input.page)
  if (input.attachment) fd.set('attachment', input.attachment)

  const res = await fetch(`${BASE_URL}/api/issues`, { method: 'POST', body: fd })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'ส่งแจ้งปัญหาไม่สำเร็จ กรุณาลองใหม่')
  return body
}
