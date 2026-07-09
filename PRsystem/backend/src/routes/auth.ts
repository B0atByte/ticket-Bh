import { Hono } from 'hono'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { prisma } from '../lib/prisma.js'
import { signToken } from '../lib/jwt.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { parseBody } from '../lib/validate.js'
import { getClientIp, isLocked, recordFailure, recordSuccess, unlockIp, getLockedIps } from '../lib/rateLimiter.js'
import { addToBlacklist } from '../lib/tokenBlacklist.js'
import { discordLogin, discordLogout } from '../lib/discord.js'

const auth = new Hono()

const loginSchema = z.object({
  username: z.string().min(1, 'กรุณากรอก username'),
  password: z.string().min(1, 'กรุณากรอก password'),
  rememberMe: z.boolean().optional().default(false),
})

auth.post('/login', async (c) => {
  const ip = getClientIp(c)

  const result = await parseBody(c, loginSchema)
  if (!(result as any).data) return result as unknown as Response
  const body = (result as any).data
  const { username, password, rememberMe } = body

  const user = await prisma.user.findUnique({ where: { username } })

  // itsupport ข้าม IP lock ได้ — เพื่อให้ปลดล็อก IP ที่ถูกบล็อกได้เสมอ
  const isItsupport = user?.role === 'itsupport' && user?.active

  if (!isItsupport && isLocked(ip)) {
    return c.json({ error: 'IP นี้ถูกล็อกชั่วคราว เนื่องจากพยายาม login ผิดเกินกำหนด กรุณาติดต่อ IT Support' }, 429)
  }

  if (!user || !user.active) {
    const { locked, remaining } = recordFailure(ip)
    const msg = locked
      ? 'IP ถูกล็อกแล้ว เนื่องจากพยายาม login ผิดเกินกำหนด กรุณาติดต่อ IT Support'
      : `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (เหลืออีก ${remaining} ครั้ง)`
    return c.json({ error: msg }, locked ? 429 : 401)
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    if (!isItsupport) {
      const { locked, remaining } = recordFailure(ip)
      const msg = locked
        ? 'IP ถูกล็อกแล้ว เนื่องจากพยายาม login ผิดเกินกำหนด กรุณาติดต่อ IT Support'
        : `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (เหลืออีก ${remaining} ครั้ง)`
      return c.json({ error: msg }, locked ? 429 : 401)
    }
    return c.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, 401)
  }

  if (!isItsupport) recordSuccess(ip)
  const token = signToken({ id: user.id, role: user.role, name: user.name }, rememberMe)

  // Discord login notification
  prisma.settings.findUnique({ where: { id: 'singleton' }, select: { discordWebhook: true, discordSecurityWebhook: true, discordOnLogin: true, siteName: true } })
    .then(s => {
      const wh = s?.discordSecurityWebhook || s?.discordWebhook
      if (wh && s?.discordOnLogin)
        discordLogin(wh, { name: user.name, role: user.role, username: user.username }, ip, s.siteName).catch(console.error)
    }).catch(console.error)

  return c.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      active: user.active,
    },
  })
})

// POST /api/auth/logout — เพิ่ม token เข้า blacklist ทันที
auth.post('/logout', authMiddleware, async (c) => {
  const token = c.req.header('Authorization')?.slice(7) || ''
  const payload = c.get('user') as any
  const exp = payload?.exp || Math.floor(Date.now() / 1000) + 8 * 3600
  if (token) addToBlacklist(token, exp)

  // Discord logout notification
  if (payload?.id) {
    prisma.user.findUnique({ where: { id: payload.id }, select: { name: true, role: true, username: true } })
      .then(u => {
        if (!u) return
        return prisma.settings.findUnique({ where: { id: 'singleton' }, select: { discordWebhook: true, discordSecurityWebhook: true, discordOnLogout: true, siteName: true } })
          .then(s => {
            const wh = s?.discordSecurityWebhook || s?.discordWebhook
            if (wh && s?.discordOnLogout)
              discordLogout(wh, u, s.siteName).catch(console.error)
          })
      }).catch(console.error)
  }

  return c.json({ ok: true })
})

// POST /api/auth/forgot-password — ขอ reset link
auth.post('/forgot-password', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const email = body.email?.trim()
  if (!email) return c.json({ error: 'กรุณากรอก email' }, 400)

  const user = await prisma.user.findFirst({ where: { email, active: true } })
  // ตอบ ok เสมอ ป้องกัน email enumeration
  if (!user) return c.json({ ok: true, message: 'ถ้า email นี้มีในระบบ จะได้รับลิงก์ทาง email' })

  const token = crypto.randomBytes(32).toString('hex')
  const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 ชั่วโมง

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  })

  const s = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  const siteUrl = process.env.SITE_URL || 'http://localhost:3456'
  const siteName = s?.siteName || 'ระบบขอซื้อสินค้า'
  const resetUrl = `${siteUrl}/reset-password?token=${token}`

  try {
    const useDb = !!(s?.smtpHost && s?.smtpUser && s?.smtpPass)
    const transporter = useDb
      ? nodemailer.createTransport({ host: s!.smtpHost!, port: s!.smtpPort || 587, secure: s!.smtpSecure || false, auth: { user: s!.smtpUser!, pass: s!.smtpPass! } })
      : nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
    const from = useDb ? (s!.smtpFrom || s!.smtpUser!) : (process.env.SMTP_FROM || process.env.SMTP_USER || '')

    await transporter.sendMail({
      from, to: email,
      subject: `[${siteName}] รีเซ็ตรหัสผ่าน`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
          <div style="background:#1d4ed8;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="color:#fff;margin:0">${siteName} — รีเซ็ตรหัสผ่าน</h2>
          </div>
          <div style="background:#fff;padding:20px;border:1px solid #e2e8f0;border-radius:0 0 8px 8px">
            <p>สวัสดีคุณ <strong>${user.name}</strong></p>
            <p>กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้ใช้ได้ภายใน <strong>1 ชั่วโมง</strong></p>
            <div style="margin:24px 0">
              <a href="${resetUrl}" style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">ตั้งรหัสผ่านใหม่</a>
            </div>
            <p style="color:#94a3b8;font-size:12px">ถ้าไม่ได้ขอรีเซ็ต ไม่ต้องทำอะไรครับ</p>
          </div>
        </div>`,
    })
  } catch (e: any) {
    console.error('[forgot-password] email error:', e.message)
  }

  return c.json({ ok: true, message: 'ถ้า email นี้มีในระบบ จะได้รับลิงก์ทาง email' })
})

// POST /api/auth/reset-password — ตั้งรหัสผ่านใหม่
auth.post('/reset-password', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { token, password } = body
  if (!token || !password) return c.json({ error: 'ข้อมูลไม่ครบ' }, 400)
  if (password.length < 6) return c.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, 400)

  const user = await prisma.user.findUnique({ where: { resetToken: token } })
  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return c.json({ error: 'ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว' }, 400)
  }

  const hashed = await bcrypt.hash(password, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, resetToken: null, resetTokenExpiry: null },
  })

  return c.json({ ok: true, message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณา login อีกครั้ง' })
})

// GET /api/auth/locked-ips — itsupport ดู IP ที่ถูกล็อก
auth.get('/locked-ips', authMiddleware, requireRole('itsupport'), (c) => {
  return c.json(getLockedIps())
})

// DELETE /api/auth/locked-ips/:ip — itsupport ปลดล็อก IP
auth.delete('/locked-ips/:ip', authMiddleware, requireRole('itsupport'), (c) => {
  const ip = decodeURIComponent(c.req.param('ip'))
  const ok = unlockIp(ip)
  if (!ok) return c.json({ error: 'ไม่พบ IP นี้ในรายการล็อก' }, 404)
  return c.json({ ok: true, message: `ปลดล็อก ${ip} แล้ว` })
})

auth.get('/me', authMiddleware, async (c) => {
  const { id } = c.get('user')
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, name: true, email: true, role: true, active: true, createdAt: true },
  })
  if (!user) return c.json({ error: 'User not found' }, 404)
  return c.json(user)
})

export default auth
