import { Hono } from 'hono'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { parseBody } from '../lib/validate.js'
import { discordPasswordReset } from '../lib/discord.js'

const users = new Hono()
users.use('*', authMiddleware)
users.use('*', requireRole('itsupport'))

const ROLES = ['owner', 'employee', 'purchasing', 'accounting', 'itsupport'] as const

const createUserSchema = z.object({
  username: z.string().min(3, 'ต้องมีอย่างน้อย 3 ตัวอักษร').max(50).regex(/^[a-zA-Z0-9_-]+$/, 'ใช้ได้เฉพาะ a-z, 0-9, _, -'),
  password: z.string().min(6, 'password ต้องมีอย่างน้อย 6 ตัวอักษร'),
  name: z.string().min(1, 'กรุณากรอกชื่อ').max(100),
  email: z.string().email('รูปแบบ email ไม่ถูกต้อง'),
  role: z.enum(ROLES, { message: 'role ไม่ถูกต้อง' }),
  active: z.boolean().optional().default(true),
})

const updateUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(6).optional(),
  name: z.string().min(1).max(100),
  email: z.string().email('รูปแบบ email ไม่ถูกต้อง'),
  role: z.enum(ROLES, { message: 'role ไม่ถูกต้อง' }),
  active: z.boolean().optional(),
})

const safeUser = (u: any) => {
  const { password: _, ...rest } = u
  return rest
}

users.get('/', async (c) => {
  const data = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
  return c.json(data.map(safeUser))
})

users.post('/', async (c) => {
  const result = await parseBody(c, createUserSchema)
  if (!(result as any).data) return result as unknown as Response
  const body = (result as any).data

  const hashed = await bcrypt.hash(body.password, 10)
  try {
    const user = await prisma.user.create({
      data: {
        username: body.username,
        password: hashed,
        name: body.name,
        email: body.email,
        role: body.role,
        active: body.active ?? true,
      },
    })
    return c.json(safeUser(user), 201)
  } catch (err: any) {
    if (err.code === 'P2002') {
      const field = err.meta?.target?.includes('email') ? 'Email' : 'Username'
      return c.json({ error: `${field} นี้ถูกใช้งานแล้ว` }, 400)
    }
    throw err
  }
})

users.put('/:id', async (c) => {
  const { id } = c.req.param()
  const result = await parseBody(c, updateUserSchema)
  if (!(result as any).data) return result as unknown as Response
  const body = (result as any).data

  const data: any = {
    name: body.name,
    username: body.username,
    email: body.email,
    role: body.role,
    ...(body.active !== undefined ? { active: body.active } : {}),
  }
  if (body.password) data.password = await bcrypt.hash(body.password, 10)

  try {
    const user = await prisma.user.update({ where: { id }, data })
    return c.json(safeUser(user))
  } catch (err: any) {
    if (err.code === 'P2025') return c.json({ error: 'ไม่พบผู้ใช้' }, 404)
    if (err.code === 'P2002') {
      const field = err.meta?.target?.includes('email') ? 'Email' : 'Username'
      return c.json({ error: `${field} นี้ถูกใช้งานแล้ว` }, 400)
    }
    throw err
  }
})

users.delete('/:id', async (c) => {
  const caller = c.get('user')
  const { id } = c.req.param()
  if (id === caller.id) return c.json({ error: 'ไม่สามารถลบบัญชีของตัวเองได้' }, 400)
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  if (!target) return c.json({ error: 'ไม่พบผู้ใช้' }, 404)
  if (target.role === 'itsupport') {
    const count = await prisma.user.count({ where: { role: 'itsupport', active: true } })
    if (count <= 1) return c.json({ error: 'ไม่สามารถลบ IT Support คนสุดท้ายได้' }, 400)
  }
  await prisma.user.delete({ where: { id } })
  return c.json({ ok: true })
})

users.post('/:id/reset-password', async (c) => {
  const admin = c.get('user')
  const { id } = c.req.param()
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const newPass = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const hashed = await bcrypt.hash(newPass, 10)
  const target = await prisma.user.update({ where: { id }, data: { password: hashed }, select: { name: true, username: true } })

  // Discord notification
  prisma.settings.findUnique({ where: { id: 'singleton' }, select: { discordWebhook: true, discordSecurityWebhook: true, discordOnPasswordReset: true, siteName: true } })
    .then(s => {
      const wh = s?.discordSecurityWebhook || s?.discordWebhook
      if (wh && s?.discordOnPasswordReset)
        discordPasswordReset(wh, target, { name: admin.name }, s.siteName).catch(console.error)
    }).catch(console.error)

  return c.json({ ok: true, newPassword: newPass })
})

export default users
