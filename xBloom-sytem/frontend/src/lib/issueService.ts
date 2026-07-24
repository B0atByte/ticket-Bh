// Client for the central issue-service — deliberately separate from ./api.ts's
// req()/headers(), which attach this app's own Bearer token to every request.
// Reusing it here would leak this system's session token to a different origin.
export type Severity = "critical" | "high" | "normal";
export type Category = "system_error" | "payment" | "account" | "feedback" | "other";

export interface SubmitIssueInput {
  description: string;
  severity: Severity;
  reporterId: string;
  reporterName: string;
  reporterRole?: string;
  page?: string;
  category: Category;
  subject: string;
  contactInfo?: string;
}

const BASE_URL = import.meta.env.VITE_ISSUE_SERVICE_URL as string;

function captureDeviceInfo(): string {
  return JSON.stringify({
    ua: navigator.userAgent,
    screen: `${screen.width}x${screen.height}`,
    lang: navigator.language,
  });
}

export async function submitIssueReport(input: SubmitIssueInput): Promise<{ id: string }> {
  const fd = new FormData();
  fd.set("system", "xBloom");
  fd.set("description", input.description);
  fd.set("severity", input.severity);
  fd.set("reporterId", input.reporterId);
  fd.set("reporterName", input.reporterName);
  if (input.reporterRole) fd.set("reporterRole", input.reporterRole);
  if (input.page) fd.set("page", input.page);
  fd.set("category", input.category);
  fd.set("subject", input.subject);
  if (input.contactInfo) fd.set("contactInfo", input.contactInfo);
  fd.set("deviceInfo", captureDeviceInfo());
  const appVersion = import.meta.env.VITE_APP_VERSION as string | undefined;
  if (appVersion) fd.set("appVersion", appVersion);

  const res = await fetch(`${BASE_URL}/api/issues`, { method: "POST", body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "ส่งแจ้งปัญหาไม่สำเร็จ กรุณาลองใหม่");
  return body;
}

// Status lifecycle from issue-service (src/constants.ts) — set on creation
// (submitted) and only ever advanced by an admin, in this order.
export type IssueStatus = "submitted" | "acknowledged" | "resolved";

export interface IssueHistoryEntry {
  status: IssueStatus;
  label: string;
  note: string | null;
  createdAt: string;
}

export type CommentAuthorType = "reporter" | "admin";

export interface IssueComment {
  id: string;
  authorType: CommentAuthorType;
  authorName: string;
  message: string;
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
  category: Category;
  categoryLabel: string;
  subject: string;
  contactInfo: string | null;
  comments: IssueComment[];
}

export async function fetchMyIssues(reporterId: string): Promise<MyIssue[]> {
  const params = new URLSearchParams({ system: "xBloom", reporterId });
  const res = await fetch(`${BASE_URL}/api/issues/mine?${params.toString()}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "โหลดประวัติการแจ้งปัญหาไม่สำเร็จ");
  return body.issues;
}

// issue-service gates the raw attachment behind ?system=&reporterId= (same
// soft-trust tier as GET /mine) — build the authenticated download link here
// so callers don't have to know the query-param contract.
export function getAttachmentDownloadUrl(issue: MyIssue, reporterId: string): string | null {
  if (!issue.attachmentUrl) return null;
  const params = new URLSearchParams({ system: "xBloom", reporterId });
  return `${BASE_URL}${issue.attachmentUrl}?${params.toString()}`;
}

export async function postIssueComment(issueId: string, reporterId: string, message: string): Promise<IssueComment[]> {
  const res = await fetch(`${BASE_URL}/api/issues/${issueId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, system: "xBloom", reporterId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "ส่งข้อความไม่สำเร็จ");
  return body.comments;
}
