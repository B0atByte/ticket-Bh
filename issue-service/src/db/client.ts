import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Severity, Status } from '../constants.js'
import type { StoredAttachment } from '../lib/storage.js'
import type { SystemName } from '../systems.js'

export interface Issue {
  id: number
  system: SystemName
  description: string
  page: string | null
  severity: Severity
  status: Status
  reporterId: string
  reporterName: string
  reporterRole: string | null
  attachmentName: string | null // original filename, for display — null if no attachment
  attachmentMime: string | null
  createdAt: string
  updatedAt: string
}

export interface StatusHistoryEntry {
  status: Status
  note: string | null
  createdAt: string
}

export interface NewIssue {
  system: SystemName
  description: string
  page?: string
  severity: Severity
  reporterId: string
  reporterName: string
  reporterRole?: string
  attachment?: StoredAttachment | null
}

// Resolves to issue-service/data/issues.sqlite regardless of dev (tsx, src/db/)
// vs prod (compiled, dist/db/) — same relative depth from either location.
const DB_PATH = fileURLToPath(new URL('../../data/issues.sqlite', import.meta.url))

let db: DatabaseSync | null = null

function getDb(): DatabaseSync {
  if (db) return db
  mkdirSync(dirname(DB_PATH), { recursive: true })
  db = new DatabaseSync(DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS issues (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      source_system       TEXT NOT NULL,
      description         TEXT NOT NULL,
      page                TEXT,
      severity            TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'submitted',
      reporter_id         TEXT NOT NULL,
      reporter_name       TEXT NOT NULL,
      reporter_role       TEXT,
      attachment_stored   TEXT,
      attachment_name     TEXT,
      attachment_mime     TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS issue_status_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id   INTEGER NOT NULL REFERENCES issues(id),
      status     TEXT NOT NULL,
      note       TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues (created_at DESC)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_issues_source_system ON issues (source_system)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_issues_status ON issues (status)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_issues_reporter ON issues (source_system, reporter_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_history_issue ON issue_status_history (issue_id)`)
  return db
}

export function initDb(): void {
  getDb()
}

const ISSUE_COLUMNS = `
  id, source_system AS system, description, page, severity, status,
  reporter_id AS reporterId, reporter_name AS reporterName, reporter_role AS reporterRole,
  attachment_name AS attachmentName, attachment_mime AS attachmentMime,
  created_at AS createdAt, updated_at AS updatedAt
`

function rowToIssue(row: unknown): Issue {
  const r = row as Issue
  return { ...r, id: Number(r.id) }
}

export function insertIssue(issue: NewIssue): Issue {
  const result = getDb()
    .prepare(
      `INSERT INTO issues (source_system, description, page, severity, reporter_id, reporter_name, reporter_role, attachment_stored, attachment_name, attachment_mime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      issue.system,
      issue.description,
      issue.page ?? null,
      issue.severity,
      issue.reporterId,
      issue.reporterName,
      issue.reporterRole ?? null,
      issue.attachment?.storedName ?? null,
      issue.attachment?.originalName ?? null,
      issue.attachment?.mime ?? null
    )

  const id = Number(result.lastInsertRowid)
  appendStatusHistory(id, 'submitted', null)

  return getIssueById(id)!
}

export function getIssueById(id: number): Issue | null {
  const row = getDb().prepare(`SELECT ${ISSUE_COLUMNS} FROM issues WHERE id = ?`).get(id)
  return row ? rowToIssue(row) : null
}

export function getAttachmentInfo(id: number): { storedName: string; mime: string; system: SystemName; reporterId: string } | null {
  const row = getDb()
    .prepare(
      `SELECT attachment_stored AS storedName, attachment_mime AS mime, source_system AS system, reporter_id AS reporterId
       FROM issues WHERE id = ?`
    )
    .get(id) as { storedName: string | null; mime: string | null; system: SystemName; reporterId: string } | undefined
  if (!row || !row.storedName || !row.mime) return null
  return { storedName: row.storedName, mime: row.mime, system: row.system, reporterId: row.reporterId }
}

export function listIssues(opts: { system?: SystemName; status?: Status; limit: number }): Issue[] {
  const conditions: string[] = []
  const params: (string | number)[] = []
  if (opts.system) {
    conditions.push('source_system = ?')
    params.push(opts.system)
  }
  if (opts.status) {
    conditions.push('status = ?')
    params.push(opts.status)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(opts.limit)

  const rows = getDb()
    .prepare(`SELECT ${ISSUE_COLUMNS} FROM issues ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params)

  return rows.map(rowToIssue)
}

export function listMyIssues(system: SystemName, reporterId: string): Issue[] {
  const rows = getDb()
    .prepare(`SELECT ${ISSUE_COLUMNS} FROM issues WHERE source_system = ? AND reporter_id = ? ORDER BY created_at DESC`)
    .all(system, reporterId)

  return rows.map(rowToIssue)
}

export function getStatusHistory(issueId: number): StatusHistoryEntry[] {
  const rows = getDb()
    .prepare(`SELECT status, note, created_at AS createdAt FROM issue_status_history WHERE issue_id = ? ORDER BY created_at ASC, id ASC`)
    .all(issueId)
  return rows as unknown as StatusHistoryEntry[]
}

function appendStatusHistory(issueId: number, status: Status, note: string | null): void {
  getDb()
    .prepare(`INSERT INTO issue_status_history (issue_id, status, note) VALUES (?, ?, ?)`)
    .run(issueId, status, note)
}

export function updateIssueStatus(id: number, status: Status, note: string | null): Issue | null {
  const existing = getIssueById(id)
  if (!existing) return null

  getDb()
    .prepare(`UPDATE issues SET status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(status, id)
  appendStatusHistory(id, status, note)

  return getIssueById(id)
}
