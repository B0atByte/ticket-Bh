import { Hono } from 'hono'
import { z } from 'zod'
import { insertIssue, listIssues } from '../db/client.js'
import { notifyDiscord } from '../lib/discord.js'
import { requireDashboardKey } from '../middleware/dashboardAuth.js'
import { SYSTEMS } from '../systems.js'

const issueRoutes = new Hono()

const createIssueSchema = z.object({
  system: z.enum(SYSTEMS, { errorMap: () => ({ message: `system ต้องเป็นหนึ่งใน: ${SYSTEMS.join(', ')}` }) }),
  description: z.string().min(5, 'กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร').max(2000),
  page: z.string().max(500).optional(),
  reporterName: z.string().max(200).optional(),
  reporterRole: z.string().max(100).optional(),
})

// POST /  — every system's report-issue button/partial posts here directly
// from the browser. Intentionally unauthenticated: this mirrors every
// system's own existing report-issue endpoint today (no login required, so
// anonymous users can still flag a problem). The `system` field just tags
// which app the report came from; it is not a trust boundary.
issueRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createIssueSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, 400)
  }

  const { system, description, page, reporterName, reporterRole } = parsed.data
  const { id, createdAt } = insertIssue({ system, description, page, reporterName, reporterRole })

  await notifyDiscord({
    system,
    description,
    page: page ?? null,
    reporterName: reporterName ?? null,
    reporterRole: reporterRole ?? null,
  })

  return c.json({ id, createdAt: `${createdAt.replace(' ', 'T')}Z` }, 201)
})

// GET /  — issues-dashboard pulls the merged feed from here (one call instead
// of fanning out to 5 systems). Optional ?system= to scope to one source,
// mainly useful for debugging a single system's feed.
issueRoutes.get('/', requireDashboardKey, (c) => {
  const systemParam = c.req.query('system')
  if (systemParam && !(SYSTEMS as readonly string[]).includes(systemParam)) {
    return c.json({ error: `unknown system "${systemParam}"` }, 400)
  }

  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 100, 1), 500)
  const rows = listIssues({ system: systemParam as (typeof SYSTEMS)[number] | undefined, limit })

  // created_at is naive UTC "YYYY-MM-DD HH:MM:SS" (SQLite datetime('now')) —
  // tag it explicitly so consumers don't misread it as their own local time.
  const issues = rows.map((r) => ({
    ...r,
    id: String(r.id),
    createdAt: `${r.createdAt.replace(' ', 'T')}Z`,
  }))

  return c.json({ issues })
})

export default issueRoutes
