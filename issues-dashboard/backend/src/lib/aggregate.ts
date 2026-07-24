import { alertIssueServiceDown, alertIssueServiceSlow, clearOpsAlertState, OPS_SLOW_THRESHOLD_MS } from './discordAlert.js'

// Single source now: the central issue-service (see issue-service's README
// "Frontend wiring checklist" — its GET /api/issues was built specifically
// for this dashboard to pull from). Each of the 5 systems used to run its
// own local issue table that this file fanned out to individually; those
// are dead now that every system's report button posts straight to
// issue-service instead.
export interface NormalizedIssue {
  system: string
  id: string
  description: string
  page: string | null
  severity: 'critical' | 'high' | 'normal'
  status: string
  statusLabel: string
  reporterName: string | null
  reporterRole: string | null
  category: string
  categoryLabel: string
  subject: string
  contactInfo: string | null
  deviceInfo: string | null
  appVersion: string | null
  createdAt: string
  updatedAt: string
}

export interface SourceStatus {
  system: string
  ok: boolean
  error?: string
}

export interface AggregateResult {
  issues: NormalizedIssue[]
  sources: SourceStatus[]
}

const TIMEOUT_MS = 5000

function env(name: string): string {
  return process.env[name] ?? ''
}

export async function aggregateIssues(limit: number): Promise<AggregateResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start = Date.now()

  try {
    const res = await fetch(`${env('ISSUE_SERVICE_URL')}/api/issues?limit=${limit}`, {
      headers: { 'X-Dashboard-Key': env('ISSUE_SERVICE_DASHBOARD_KEY') },
      signal: controller.signal,
    })
    const latencyMs = Date.now() - start

    if (!res.ok) {
      alertIssueServiceDown(`HTTP ${res.status}`)
      return { issues: [], sources: [{ system: 'issue-service', ok: false, error: `HTTP ${res.status}` }] }
    }

    if (latencyMs > OPS_SLOW_THRESHOLD_MS) {
      alertIssueServiceSlow(latencyMs)
    } else {
      clearOpsAlertState()
    }

    const body = (await res.json()) as { issues?: unknown[] }
    const raw = Array.isArray(body.issues) ? body.issues : []

    const issues = raw.map((item): NormalizedIssue => {
      const i = item as Record<string, unknown>
      return {
        system: String(i.system ?? ''),
        id: String(i.id),
        description: String(i.description ?? ''),
        page: (i.page as string) ?? null,
        severity: (i.severity as NormalizedIssue['severity']) ?? 'normal',
        status: String(i.status ?? 'submitted'),
        statusLabel: String(i.statusLabel ?? ''),
        reporterName: (i.reporterName as string) ?? null,
        reporterRole: (i.reporterRole as string) ?? null,
        category: String(i.category ?? 'other'),
        categoryLabel: String(i.categoryLabel ?? ''),
        subject: String(i.subject ?? ''),
        contactInfo: (i.contactInfo as string) ?? null,
        deviceInfo: (i.deviceInfo as string) ?? null,
        appVersion: (i.appVersion as string) ?? null,
        createdAt: String(i.createdAt),
        updatedAt: String(i.updatedAt ?? i.createdAt),
      }
    })

    return { issues, sources: [{ system: 'issue-service', ok: true }] }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fetch failed'
    alertIssueServiceDown(message)
    return {
      issues: [],
      sources: [{ system: 'issue-service', ok: false, error: message }],
    }
  } finally {
    clearTimeout(timeout)
  }
}
