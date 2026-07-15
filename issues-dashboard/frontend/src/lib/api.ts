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

export type IssueStatusValue = 'New' | 'In Progress' | 'Resolved'

export interface Issue {
  system: string
  id: string
  description: string
  page: string | null
  reporterName: string | null
  reporterRole: string | null
  createdAt: string
  status: IssueStatusValue
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

export function fetchActiveIssues() {
  return request<{ issues: Issue[]; sources: SourceStatus[] }>('/issues/active')
}

export function fetchHistoryIssues() {
  return request<{ issues: Issue[]; sources: SourceStatus[] }>('/issues/history')
}

export function updateIssueStatus(system: string, id: string, status: IssueStatusValue) {
  return request<{ system: string; issueId: string; status: IssueStatusValue; updatedAt: string }>(
    `/issues/${encodeURIComponent(system)}/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) }
  )
}
