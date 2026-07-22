const TOKEN_KEY = 'issues_dashboard_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// issue-service's real lifecycle (submitted → acknowledged → pending_user →
// resolved) — this dashboard used to track its own separate New/In
// Progress/Resolved status disconnected from what the reporter sees; now it
// reads and writes issue-service's status directly so both sides agree.
export type IssueStatusValue = 'submitted' | 'acknowledged' | 'pending_user' | 'resolved'
export type Severity = 'critical' | 'high' | 'normal'

export interface Issue {
  system: string
  id: string
  description: string
  page: string | null
  severity: Severity
  reporterName: string | null
  reporterRole: string | null
  createdAt: string
  updatedAt: string
  status: IssueStatusValue
  statusLabel: string
}

export interface SourceStatus {
  system: string
  ok: boolean
  error?: string
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const body = await res.json().catch(() => ({}))

  if (res.status === 401) {
    clearToken()
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return body as T
}

export function login(password: string) {
  return request<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function fetchAllIssues() {
  return request<{ issues: Issue[]; sources: SourceStatus[] }>('/issues')
}

export function fetchActiveIssues() {
  return request<{ issues: Issue[]; sources: SourceStatus[] }>('/issues/active')
}

export function fetchHistoryIssues() {
  return request<{ issues: Issue[]; sources: SourceStatus[] }>('/issues/history')
}

export function updateIssueStatus(system: string, id: string, status: IssueStatusValue) {
  return request<{ issueId: string; status: IssueStatusValue; statusLabel: string; updatedAt: string }>(
    `/issues/${encodeURIComponent(system)}/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) }
  )
}
