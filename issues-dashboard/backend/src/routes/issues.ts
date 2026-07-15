import { Hono } from 'hono'
import { z } from 'zod'
import { aggregateIssues } from '../lib/aggregate.js'
import { sources } from '../lib/sources.js'
import { filterByView, mergeStatuses, setStatus } from '../lib/statusDb.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = new Hono()

router.use('*', requireAuth)

function parseLimit(raw: string | undefined): number {
  return Math.min(Math.max(Number(raw) || 100, 1), 500)
}

router.get('/', async (c) => {
  const result = await aggregateIssues(parseLimit(c.req.query('limit')))
  return c.json({ issues: mergeStatuses(result.issues), sources: result.sources })
})

router.get('/active', async (c) => {
  const result = await aggregateIssues(parseLimit(c.req.query('limit')))
  const issues = filterByView(mergeStatuses(result.issues), 'active')
  return c.json({ issues, sources: result.sources })
})

router.get('/history', async (c) => {
  const result = await aggregateIssues(parseLimit(c.req.query('limit')))
  const issues = filterByView(mergeStatuses(result.issues), 'history')
  return c.json({ issues, sources: result.sources })
})

const statusSchema = z.object({ status: z.enum(['New', 'In Progress', 'Resolved']) })
const knownSystems = new Set(sources.map((s) => s.name))

router.patch('/:system/:issueId/status', async (c) => {
  const { system, issueId } = c.req.param()
  if (!knownSystems.has(system)) {
    return c.json({ error: `Unknown system: ${system}` }, 400)
  }

  const body = await c.req.json().catch(() => ({}))
  const result = statusSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: result.error.errors[0].message }, 400)
  }

  return c.json(setStatus(system, issueId, result.data.status))
})

export default router
