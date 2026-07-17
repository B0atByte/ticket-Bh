import { Hono } from 'hono'
import { z } from 'zod'
import { STATUS_META, SEVERITIES, STATUSES, type Status } from '../constants.js'
import {
  getAttachmentInfo,
  getIssueById,
  getStatusHistory,
  insertIssue,
  listIssues,
  listMyIssues,
  updateIssueStatus,
  type Issue,
  type StatusHistoryEntry,
} from '../db/client.js'
import { notifyDiscord } from '../lib/discord.js'
import { readAttachment, saveAttachment } from '../lib/storage.js'
import { requireDashboardKey } from '../middleware/dashboardAuth.js'
import { SYSTEMS, type SystemName } from '../systems.js'

const issueRoutes = new Hono()

// created_at/updated_at are naive UTC "YYYY-MM-DD HH:MM:SS" (SQLite
// datetime('now')) — tag explicitly so consumers don't misread as local time.
function toUtcIso(sqliteDatetime: string): string {
  return `${sqliteDatetime.replace(' ', 'T')}Z`
}

function serializeIssue(issue: Issue) {
  return {
    id: String(issue.id),
    system: issue.system,
    description: issue.description,
    page: issue.page,
    severity: issue.severity,
    status: issue.status,
    statusLabel: STATUS_META[issue.status].label,
    statusEmoji: STATUS_META[issue.status].emoji,
    reporterId: issue.reporterId,
    reporterName: issue.reporterName,
    reporterRole: issue.reporterRole,
    hasAttachment: issue.attachmentName !== null,
    attachmentUrl: issue.attachmentName ? `/api/issues/${issue.id}/attachment` : null,
    createdAt: toUtcIso(issue.createdAt),
    updatedAt: toUtcIso(issue.updatedAt),
  }
}

function serializeHistory(entries: StatusHistoryEntry[]) {
  return entries.map((h) => ({
    status: h.status,
    label: STATUS_META[h.status].label,
    emoji: STATUS_META[h.status].emoji,
    note: h.note,
    createdAt: toUtcIso(h.createdAt),
  }))
}

const createIssueSchema = z.object({
  system: z.enum(SYSTEMS, { errorMap: () => ({ message: `system ต้องเป็นหนึ่งใน: ${SYSTEMS.join(', ')}` }) }),
  description: z.string().min(5, 'กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร').max(2000),
  page: z.string().max(500).optional(),
  severity: z.enum(SEVERITIES, { errorMap: () => ({ message: `severity ต้องเป็นหนึ่งใน: ${SEVERITIES.join(', ')}` }) }),
  // Required now — the button lives behind login in every system, so the
  // caller always has an identity to attach. reporterId is an opaque string
  // controlled entirely by the calling system (its own user id/email/etc.);
  // this service just uses it as an opaque key to scope GET /mine, it is
  // NOT a verified/trusted identity (same tier as `system` — see README).
  reporterId: z.string().min(1, 'reporterId จำเป็นต้องส่งมา (ผู้แจ้งต้อง login ก่อน)').max(200),
  reporterName: z.string().min(1, 'reporterName จำเป็นต้องส่งมา').max(200),
  reporterRole: z.string().max(100).optional(),
})

// POST /  — every system's report-issue form posts here (multipart/form-data
// so the optional screenshot/file travels in the same request). Auth-wise
// this is intentionally NOT behind X-Dashboard-Key: it's meant to be called
// directly from a browser that's already authenticated with ITS OWN system
// (that system's frontend is responsible for gating the button behind its
// own login and passing the logged-in user's id/name/role — this service
// has no way to verify any of that itself).
issueRoutes.post('/', async (c) => {
  const body = await c.req.parseBody().catch(() => null)
  if (!body) {
    return c.json({ error: 'ต้องส่งเป็น multipart/form-data' }, 400)
  }
  const { attachment, ...fields } = body as Record<string, unknown>

  const parsed = createIssueSchema.safeParse(fields)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, 400)
  }

  let storedAttachment = null
  if (attachment instanceof File && attachment.size > 0) {
    const result = await saveAttachment(attachment)
    if (!result.ok) return c.json({ error: result.error }, 400)
    storedAttachment = result.value
  }

  const { system, description, page, severity, reporterId, reporterName, reporterRole } = parsed.data
  const issue = insertIssue({ system, description, page, severity, reporterId, reporterName, reporterRole, attachment: storedAttachment })

  await notifyDiscord({
    system,
    description,
    page: page ?? null,
    severity,
    reporterName,
    reporterRole: reporterRole ?? null,
    hasAttachment: storedAttachment !== null,
  })

  return c.json(serializeIssue(issue), 201)
})

// GET /  — issues-dashboard / an admin tool pulls the merged feed from here.
// Optional ?system=, ?status= to narrow down; ?limit= (default 100, max 500).
issueRoutes.get('/', requireDashboardKey, (c) => {
  const systemParam = c.req.query('system')
  if (systemParam && !(SYSTEMS as readonly string[]).includes(systemParam)) {
    return c.json({ error: `unknown system "${systemParam}"` }, 400)
  }
  const statusParam = c.req.query('status')
  if (statusParam && !(STATUSES as readonly string[]).includes(statusParam)) {
    return c.json({ error: `unknown status "${statusParam}"` }, 400)
  }

  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 100, 1), 500)
  const rows = listIssues({
    system: systemParam as SystemName | undefined,
    status: statusParam as Status | undefined,
    limit,
  })

  return c.json({ issues: rows.map(serializeIssue) })
})

// GET /mine?system=&reporterId=  — the reporter's own "my reports" list,
// each with its full status timeline. Same trust tier as POST: no
// X-Dashboard-Key, the calling system vouches for reporterId being the
// currently-logged-in user (see the note on `reporterId` above).
issueRoutes.get('/mine', (c) => {
  const system = c.req.query('system')
  const reporterId = c.req.query('reporterId')
  if (!system || !(SYSTEMS as readonly string[]).includes(system)) {
    return c.json({ error: `?system= ต้องเป็นหนึ่งใน: ${SYSTEMS.join(', ')}` }, 400)
  }
  if (!reporterId) {
    return c.json({ error: '?reporterId= จำเป็นต้องส่งมา' }, 400)
  }

  const rows = listMyIssues(system as SystemName, reporterId)
  const issues = rows.map((issue) => ({
    ...serializeIssue(issue),
    history: serializeHistory(getStatusHistory(issue.id)),
  }))

  return c.json({ issues })
})

// GET /:id  — admin detail view (full status timeline included).
issueRoutes.get('/:id', requireDashboardKey, (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'invalid id' }, 400)

  const issue = getIssueById(id)
  if (!issue) return c.json({ error: 'not found' }, 404)

  return c.json({ ...serializeIssue(issue), history: serializeHistory(getStatusHistory(id)) })
})

const updateStatusSchema = z.object({
  status: z.enum(STATUSES, { errorMap: () => ({ message: `status ต้องเป็นหนึ่งใน: ${STATUSES.join(', ')}` }) }),
  note: z.string().max(1000).optional(),
})

// PATCH /:id/status  — admin moves an issue through the timeline
// (submitted → acknowledged → pending_user → resolved, any direction).
issueRoutes.patch('/:id/status', requireDashboardKey, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'invalid id' }, 400)

  const body = await c.req.json().catch(() => null)
  const parsed = updateStatusSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, 400)
  }

  const updated = updateIssueStatus(id, parsed.data.status, parsed.data.note ?? null)
  if (!updated) return c.json({ error: 'not found' }, 404)

  return c.json({ ...serializeIssue(updated), history: serializeHistory(getStatusHistory(id)) })
})

// GET /:id/attachment  — serves the uploaded screenshot/file. Two ways in:
// an admin with X-Dashboard-Key, or the original reporter proving they know
// their own system+reporterId (same soft-trust tier as GET /mine).
issueRoutes.get('/:id/attachment', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) return c.json({ error: 'invalid id' }, 400)

  const info = getAttachmentInfo(id)
  if (!info) return c.json({ error: 'not found' }, 404)

  const isDashboard = c.req.header('X-Dashboard-Key') === process.env.DASHBOARD_API_KEY && !!process.env.DASHBOARD_API_KEY
  const isOwner = c.req.query('system') === info.system && c.req.query('reporterId') === info.reporterId
  if (!isDashboard && !isOwner) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const buffer = readAttachment(info.storedName)
  return c.body(new Uint8Array(buffer), 200, { 'Content-Type': info.mime })
})

export default issueRoutes
