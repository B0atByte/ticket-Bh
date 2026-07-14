import { Hono } from 'hono'
import { aggregateIssues } from '../lib/aggregate.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = new Hono()

router.use('*', requireAuth)

router.get('/', async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 100, 1), 500)
  const result = await aggregateIssues(limit)
  return c.json(result)
})

export default router
