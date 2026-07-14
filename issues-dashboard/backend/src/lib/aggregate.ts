import { sources } from './sources.js'

export interface NormalizedIssue {
  system: string
  id: string
  description: string
  page: string | null
  reporterName: string | null
  reporterRole: string | null
  createdAt: string
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

async function fetchSource(
  source: (typeof sources)[number],
  limit: number
): Promise<{ status: SourceStatus; issues: NormalizedIssue[] }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${source.url}?limit=${limit}`, {
      headers: { 'X-Dashboard-Key': source.apiKey },
      signal: controller.signal,
    })

    if (!res.ok) {
      return { status: { system: source.name, ok: false, error: `HTTP ${res.status}` }, issues: [] }
    }

    const body = (await res.json()) as { issues?: unknown[] }
    const raw = Array.isArray(body.issues) ? body.issues : []

    const issues = raw.map((item): NormalizedIssue => {
      const i = item as Record<string, unknown>
      return {
        system: source.name,
        id: String(i.id),
        description: String(i.description ?? ''),
        page: (i.page as string) ?? null,
        reporterName: (i.reporterName as string) ?? null,
        reporterRole: (i.reporterRole as string) ?? null,
        createdAt: String(i.createdAt),
      }
    })

    return { status: { system: source.name, ok: true }, issues }
  } catch (err) {
    return {
      status: { system: source.name, ok: false, error: err instanceof Error ? err.message : 'fetch failed' },
      issues: [],
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function aggregateIssues(limit: number): Promise<AggregateResult> {
  const results = await Promise.all(sources.map((s) => fetchSource(s, limit)))

  const issues = results
    .flatMap((r) => r.issues)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return { issues, sources: results.map((r) => r.status) }
}
