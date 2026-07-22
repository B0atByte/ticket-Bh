// Client for the central issue-service — deliberately separate from ./api.ts.
// That module attaches this app's own Bearer token to every request; reusing
// it here would leak this system's session token to a different origin.
export type Severity = 'critical' | 'high' | 'normal';

export interface SubmitIssueInput {
  description: string;
  severity: Severity;
  reporterId: string;
  reporterName: string;
  reporterRole?: string;
  page?: string;
  attachment?: File | null;
}

const BASE_URL = import.meta.env.VITE_ISSUE_SERVICE_URL as string;

export async function submitIssueReport(input: SubmitIssueInput): Promise<{ id: string }> {
  const fd = new FormData();
  fd.set('system', 'PRsystem');
  fd.set('description', input.description);
  fd.set('severity', input.severity);
  fd.set('reporterId', input.reporterId);
  fd.set('reporterName', input.reporterName);
  if (input.reporterRole) fd.set('reporterRole', input.reporterRole);
  if (input.page) fd.set('page', input.page);
  if (input.attachment) fd.set('attachment', input.attachment);

  const res = await fetch(`${BASE_URL}/api/issues`, { method: 'POST', body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'ส่งแจ้งปัญหาไม่สำเร็จ กรุณาลองใหม่');
  return body;
}

// Status lifecycle from issue-service (src/constants.ts) — set on creation
// (submitted) and only ever advanced by an admin, in this order.
export type IssueStatus = 'submitted' | 'acknowledged' | 'pending_user' | 'resolved';

export interface IssueHistoryEntry {
  status: IssueStatus;
  label: string;
  note: string | null;
  createdAt: string;
}

export interface MyIssue {
  id: string;
  description: string;
  severity: Severity;
  status: IssueStatus;
  statusLabel: string;
  createdAt: string;
  page: string | null;
  hasAttachment: boolean;
  attachmentUrl: string | null;
  history: IssueHistoryEntry[];
}

export async function fetchMyIssues(reporterId: string): Promise<MyIssue[]> {
  const params = new URLSearchParams({ system: 'PRsystem', reporterId });
  const res = await fetch(`${BASE_URL}/api/issues/mine?${params.toString()}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'โหลดประวัติการแจ้งปัญหาไม่สำเร็จ');
  return body.issues;
}

// issue-service gates the raw attachment behind ?system=&reporterId= (same
// soft-trust tier as GET /mine) — build the authenticated download link here
// so callers don't have to know the query-param contract.
export function getAttachmentDownloadUrl(issue: MyIssue, reporterId: string): string | null {
  if (!issue.attachmentUrl) return null;
  const params = new URLSearchParams({ system: 'PRsystem', reporterId });
  return `${BASE_URL}${issue.attachmentUrl}?${params.toString()}`;
}
