import { Hono } from 'hono'
import { z } from 'zod'
import { aggregateIssues } from '../lib/aggregate.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = new Hono()

router.use('*', requireAuth)

function parseLimit(raw: string | undefined): number {
  return Math.min(Math.max(Number(raw) || 100, 1), 500)
}

// issue-service's real lifecycle (submitted → acknowledged → resolved) —
// "history" is just the resolved tail of it.
const ACTIVE_STATUSES = ['submitted', 'acknowledged']
const HISTORY_STATUSES = ['resolved']

router.get('/', async (c) => {
  const result = await aggregateIssues(parseLimit(c.req.query('limit')))
  return c.json(result)
})

router.get('/active', async (c) => {
  const result = await aggregateIssues(parseLimit(c.req.query('limit')))
  return c.json({ issues: result.issues.filter((i) => ACTIVE_STATUSES.includes(i.status)), sources: result.sources })
})

router.get('/history', async (c) => {
  const result = await aggregateIssues(parseLimit(c.req.query('limit')))
  return c.json({ issues: result.issues.filter((i) => HISTORY_STATUSES.includes(i.status)), sources: result.sources })
})

const statusSchema = z.object({
  status: z.enum(['submitted', 'acknowledged', 'resolved']),
  note: z.string().max(1000).optional(),
})

// :system is kept in the URL for frontend-call compatibility but unused —
// issue-service's PATCH /:id/status is keyed by its own numeric id only.
router.patch('/:system/:issueId/status', async (c) => {
  const { issueId } = c.req.param()
  const body = await c.req.json().catch(() => ({}))
  const result = statusSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: result.error.errors[0].message }, 400)
  }

  const res = await fetch(`${process.env.ISSUE_SERVICE_URL}/api/issues/${issueId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Dashboard-Key': process.env.ISSUE_SERVICE_DASHBOARD_KEY ?? '' },
    body: JSON.stringify({ status: result.data.status, note: result.data.note }),
  })
  const updated = await res.json().catch(() => ({}))
  if (!res.ok) {
    return c.json({ error: updated.error ?? 'Update failed' }, res.status === 404 ? 404 : 400)
  }

  return c.json({ issueId: String(updated.id), status: updated.status, statusLabel: updated.statusLabel, updatedAt: updated.updatedAt })
})

// GET /:issueId — full detail for the admin detail panel (history + comment
// thread). Registered after the literal /active, /history routes above so
// those still win; Hono's router prioritizes static segments over params
// regardless of order, but keeping it below documents the intent.
router.get('/:issueId', async (c) => {
  const { issueId } = c.req.param()
  const res = await fetch(`${process.env.ISSUE_SERVICE_URL}/api/issues/${issueId}`, {
    headers: { 'X-Dashboard-Key': process.env.ISSUE_SERVICE_DASHBOARD_KEY ?? '' },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    return c.json({ error: body.error ?? 'Load failed' }, res.status === 404 ? 404 : 400)
  }
  return c.json(body)
})

// GET /:issueId/attachment — streams the attachment through with the
// dashboard's X-Dashboard-Key attached server-side. Needed because a plain
// <a href> from the browser can't carry either that key or this dashboard's
// own Bearer token, and issue-service's attachment endpoint requires one.
router.get('/:issueId/attachment', async (c) => {
  const { issueId } = c.req.param()
  const res = await fetch(`${process.env.ISSUE_SERVICE_URL}/api/issues/${issueId}/attachment`, {
    headers: { 'X-Dashboard-Key': process.env.ISSUE_SERVICE_DASHBOARD_KEY ?? '' },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return c.json({ error: body.error ?? 'Not found' }, res.status === 404 ? 404 : 400)
  }
  const contentType = res.headers.get('Content-Type') ?? 'application/octet-stream'
  const buffer = await res.arrayBuffer()
  return c.body(buffer, 200, { 'Content-Type': contentType })
})

const createCommentSchema = z.object({
  message: z.string().min(1, 'กรุณาพิมพ์ข้อความ').max(2000),
})

// POST /:issueId/comments — admin's reply on the comment thread. Always goes
// through as 'admin' (X-Dashboard-Key) — this dashboard has one shared admin
// password, no per-admin identity to attach as authorName (issue-service
// assigns a fixed label server-side).
router.post('/:issueId/comments', async (c) => {
  const { issueId } = c.req.param()
  const body = await c.req.json().catch(() => ({}))
  const result = createCommentSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: result.error.errors[0].message }, 400)
  }

  const res = await fetch(`${process.env.ISSUE_SERVICE_URL}/api/issues/${issueId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Dashboard-Key': process.env.ISSUE_SERVICE_DASHBOARD_KEY ?? '' },
    body: JSON.stringify({ message: result.data.message }),
  })
  const updated = await res.json().catch(() => ({}))
  if (!res.ok) {
    return c.json({ error: updated.error ?? 'Failed' }, res.status === 404 ? 404 : 400)
  }

  return c.json(updated, 201)
})

export default router
