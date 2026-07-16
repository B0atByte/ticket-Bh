import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SystemName } from '../systems.js'

export interface Issue {
  id: number
  system: SystemName
  description: string
  page: string | null
  reporterName: string | null
  reporterRole: string | null
  createdAt: string
}

export interface NewIssue {
  system: SystemName
  description: string
  page?: string
  reporterName?: string
  reporterRole?: string
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
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      source_system  TEXT NOT NULL,
      description    TEXT NOT NULL,
      page           TEXT,
      reporter_name  TEXT,
      reporter_role  TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues (created_at DESC)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_issues_source_system ON issues (source_system)`)
  return db
}

export function initDb(): void {
  getDb()
}

export function insertIssue(issue: NewIssue): { id: number; createdAt: string } {
  const result = getDb()
    .prepare(
      `INSERT INTO issues (source_system, description, page, reporter_name, reporter_role)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(issue.system, issue.description, issue.page ?? null, issue.reporterName ?? null, issue.reporterRole ?? null)

  const row = getDb()
    .prepare('SELECT created_at AS createdAt FROM issues WHERE id = ?')
    .get(result.lastInsertRowid) as { createdAt: string }

  return { id: Number(result.lastInsertRowid), createdAt: row.createdAt }
}

export function listIssues(opts: { system?: SystemName; limit: number }): Issue[] {
  const rows = opts.system
    ? getDb()
        .prepare(
          `SELECT id, source_system AS system, description, page, reporter_name AS reporterName,
                  reporter_role AS reporterRole, created_at AS createdAt
           FROM issues WHERE source_system = ? ORDER BY created_at DESC LIMIT ?`
        )
        .all(opts.system, opts.limit)
    : getDb()
        .prepare(
          `SELECT id, source_system AS system, description, page, reporter_name AS reporterName,
                  reporter_role AS reporterRole, created_at AS createdAt
           FROM issues ORDER BY created_at DESC LIMIT ?`
        )
        .all(opts.limit)

  return rows as unknown as Issue[]
}
