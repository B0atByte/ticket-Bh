import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { authRateLimit, type JWTPayload } from '../middleware/auth.js'
import { createIssueSchema } from '../schemas/index.js'

function getOptionalUser(authorization: string | undefined): JWTPayload | null {
  if (!authorization?.startsWith('Bearer ')) return null
  try {
    return jwt.verify(authorization.slice(7), process.env.JWT_SECRET!) as JWTPayload
  } catch {
    return null
  }
}

async function notifyDiscord(issue: {
  systemName: string
  description: string
  page: string | null
  reporterName: string | null
  reporterRole: string | null
  createdAt: Date
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: issue.systemName,
        embeds: [
          {
            title: `🐞 แจ้งปัญหาใหม่ - ${issue.systemName}`,
            description: issue.description,
            color: 0xef4444,
            fields: [
              {
                name: 'ผู้แจ้ง',
                value: issue.reporterName
                  ? `${issue.reporterName} (${issue.reporterRole})`
                  : 'ไม่ระบุ (ยังไม่ได้ login)',
                inline: true,
              },
              { name: 'หน้า', value: issue.page ?? '-', inline: true },
            ],
            timestamp: issue.createdAt.toISOString(),
          },
        ],
      }),
    })
  } catch (err) {
    console.error('Discord webhook failed:', err)
  }
}

function checkDashboardKey(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const configured = process.env.DASHBOARD_API_KEY
  if (!configured) return false
  return c.req.header('X-Dashboard-Key') === configured
}

const router = new Hono()

router.get('/', async (c) => {
  if (!checkDashboardKey(c)) {
    throw new HTTPException(process.env.DASHBOARD_API_KEY ? 401 : 503, {
      message: process.env.DASHBOARD_API_KEY ? 'Unauthorized' : 'Dashboard API not configured',
    })
  }

  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 100, 1), 500)
  const issues = await prisma.issue.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return c.json({ system: 'Bhlogisticssystem', issues })
})

router.post('/', authRateLimit, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = createIssueSchema.safeParse(body)
  if (!result.success) {
    throw new HTTPException(400, { message: result.error.errors[0].message })
  }

  const user = getOptionalUser(c.req.header('Authorization'))
  const { description, page } = result.data

  const issue = await prisma.issue.create({
    data: {
      systemName: process.env.SYSTEM_NAME ?? 'Bhlogisticssystem',
      description,
      page: page ?? null,
      reporterName: user?.name ?? null,
      reporterRole: user?.role ?? null,
    },
  })

  await notifyDiscord(issue)

  return c.json(issue, 201)
})

export default router
