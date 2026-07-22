import { Hono } from 'hono'
import { z } from 'zod'
import { aggregateIssues } from '../lib/aggregate.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = new Hono()

router.use('*', requireAuth)

function parseLimit(raw: string | undefined): number {
  return Math.min(Math.max(Number(raw) || 100, 1), 500)
}

// issue-service's real lifecycle (submitted → acknowledged → pending_user →
// resolved) — "history" is just the resolved tail of it.
const ACTIVE_STATUSES = ['submitted', 'acknowledged', 'pending_user']
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
  status: z.enum(['submitted', 'acknowledged', 'pending_user', 'resolved']),
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
    body: JSON.stringify({ status: result.data.status }),
  })
  const updated = await res.json().catch(() => ({}))
  if (!res.ok) {
    return c.json({ error: updated.error ?? 'Update failed' }, res.status === 404 ? 404 : 400)
  }

  return c.json({ issueId: String(updated.id), status: updated.status, statusLabel: updated.statusLabel, updatedAt: updated.updatedAt })
})

export default router
