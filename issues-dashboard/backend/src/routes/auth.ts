import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import { z } from 'zod'
import { signDashboardToken } from '../lib/jwt.js'

const router = new Hono()

const loginSchema = z.object({ password: z.string().min(1) })

router.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = loginSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'กรุณากรอกรหัสผ่าน' }, 400)
  }

  const hash = process.env.ADMIN_PASSWORD_HASH
  if (!hash) {
    return c.json({ error: 'Admin password not configured' }, 503)
  }

  const valid = await bcrypt.compare(result.data.password, hash)
  if (!valid) {
    return c.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401)
  }

  return c.json({ token: signDashboardToken() })
})

export default router
