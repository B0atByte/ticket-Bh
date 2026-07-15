import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NormalizedIssue } from './aggregate.js'

export type IssueStatusValue = 'New' | 'In Progress' | 'Resolved'
export const ALL_STATUSES: IssueStatusValue[] = ['New', 'In Progress', 'Resolved']
const ACTIVE_STATUSES: IssueStatusValue[] = ['New', 'In Progress']
const HISTORY_STATUSES: IssueStatusValue[] = ['Resolved']

export interface IssueWithStatus extends NormalizedIssue {
  status: IssueStatusValue
}

export interface StatusRecord {
  system: string
  issueId: string
  status: IssueStatusValue
  updatedAt: string
}

// Resolves to backend/data/status.sqlite regardless of dev (tsx, src/lib/) vs
// prod (compiled, dist/lib/) — same relative depth from either location.
const DB_PATH = fileURLToPath(new URL('../../data/status.sqlite', import.meta.url))

let db: DatabaseSync | null = null

function getDb(): DatabaseSync {
  if (db) return db
  mkdirSync(dirname(DB_PATH), { recursive: true })
  db = new DatabaseSync(DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS issue_status (
      system     TEXT NOT NULL,
      issue_id   TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'New',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (system, issue_id)
    )
  `)
  return db
}

export function initStatusDb(): void {
  getDb()
}

export function setStatus(system: string, issueId: string, status: IssueStatusValue): StatusRecord {
  const updatedAt = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO issue_status (system, issue_id, status, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(system, issue_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`
    )
    .run(system, issueId, status, updatedAt)

  return { system, issueId, status, updatedAt }
}

export function mergeStatuses(issues: NormalizedIssue[]): IssueWithStatus[] {
  const rows = getDb()
    .prepare('SELECT system, issue_id AS issueId, status FROM issue_status')
    .all() as { system: string; issueId: string; status: IssueStatusValue }[]

  const statusMap = new Map(rows.map((r) => [`${r.system}::${r.issueId}`, r.status]))

  return issues.map((issue) => ({
    ...issue,
    status: statusMap.get(`${issue.system}::${issue.id}`) ?? 'New',
  }))
}

export function filterByView(issues: IssueWithStatus[], view: 'active' | 'history'): IssueWithStatus[] {
  const allowed = view === 'active' ? ACTIVE_STATUSES : HISTORY_STATUSES
  return issues.filter((issue) => allowed.includes(issue.status))
}
