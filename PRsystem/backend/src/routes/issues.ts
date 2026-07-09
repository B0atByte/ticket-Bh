import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import { parseBody } from '../lib/validate.js'
import { discordReportIssue } from '../lib/discord.js'

const issues = new Hono()
issues.use('*', authMiddleware)

const createIssueSchema = z.object({
  description: z.string().min(5, 'กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร').max(2000),
  page: z.string().max(500).optional(),
})

issues.post('/', async (c) => {
  const user = c.get('user')

  const result = await parseBody(c, createIssueSchema)
  if (!(result as any).data) return result as unknown as Response
  const { description, page } = (result as any).data

  const issue = await prisma.issue.create({
    data: {
      description,
      page: page ?? null,
      reporterName: user.name,
      reporterRole: user.role,
    },
  })

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  if (settings?.discordWebhook) {
    discordReportIssue(settings.discordWebhook, issue, settings.siteName)
  }

  return c.json(issue, 201)
})

export default issues
