import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import { parseBody } from '../lib/validate.js'

const audit = new Hono()
audit.use('*', authMiddleware)

const createAuditSchema = z.object({
  action: z.string().min(1).max(100),
  module: z.string().min(1).max(100),
  detail: z.string().max(1000).default(''),
})

// GET — ดู log (itsupport, owner เท่านั้น)
audit.get('/', async (c) => {
  const user = c.get('user')
  if (!['itsupport', 'owner'].includes(user.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 500,
  })
  return c.json(logs)
})

// POST — บันทึก log (ทุก role)
audit.post('/', async (c) => {
  const user = c.get('user')

  const result = await parseBody(c, createAuditSchema)
  if (!(result as any).data) return result as unknown as Response
  const body = (result as any).data

  const ip = (c.req.header('x-forwarded-for') || '').split(',')[0].trim()
    || c.req.header('x-real-ip')
    || '127.0.0.1'

  const log = await prisma.auditLog.create({
    data: {
      userId: user.id,
      userName: user.name,
      action: body.action,
      module: body.module,
      detail: body.detail,
      ip,
    },
  })
  return c.json(log, 201)
})

export default audit
