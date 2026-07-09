import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { parseBody } from '../lib/validate.js'
import nodemailer from 'nodemailer'
import { discordTest, discordDailyReport, type ReportData } from '../lib/discord.js'
import { startBot, sendReportToChannel, isBotOnline, stopBot } from '../lib/bot.js'

const router = new Hono()

const updateSettingsSchema = z.object({
  siteName: z.string().min(1, 'กรุณากรอกชื่อเว็บไซต์').max(200).optional(),
  siteSubtitle: z.string().max(500).optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  discordWebhook: z.string().max(500).nullable().optional(),
  discordOnNewRequest: z.boolean().optional(),
  discordOnPurchasing: z.boolean().optional(),
  discordOnAccounting: z.boolean().optional(),
  discordOnTransferred: z.boolean().optional(),
  discordOnRejected: z.boolean().optional(),
  discordOnReceived: z.boolean().optional(),
  discordOnLogin: z.boolean().optional(),
  discordOnLogout: z.boolean().optional(),
  discordOnPasswordReset: z.boolean().optional(),
  discordSecurityWebhook: z.string().max(500).nullable().optional(),
  discordSecurityChannelId: z.string().max(30).nullable().optional(),
  discordReportEnabled: z.boolean().optional(),
  discordReportTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  discordBotToken: z.string().max(100).nullable().optional(),
  discordChannelId: z.string().max(30).nullable().optional(),
  discordRolePerms: z.string().nullable().optional(),
  smtpHost: z.string().max(200).nullable().optional(),
  smtpPort: z.number().int().min(1).max(65535).nullable().optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().max(200).nullable().optional(),
  smtpPass: z.string().max(500).nullable().optional(),
  smtpFrom: z.string().max(300).nullable().optional(),
  branches: z.array(z.string().max(100)).optional(),
})

const ensureSettings = () =>
  prisma.settings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })

// GET /api/settings — public (ใช้ก่อน login เพื่อโหลด branding เท่านั้น)
// คืนเฉพาะ 3 fields ที่จำเป็นสำหรับแสดงหน้า login
router.get('/', async (c) => {
  const s = await ensureSettings()
  return c.json({
    siteName: s.siteName,
    siteSubtitle: s.siteSubtitle,
    logoUrl: s.logoUrl,
    branches: JSON.parse(s.branches || '["HQ"]'),
  })
})

// GET /api/settings/secure — itsupport เท่านั้น (ข้อมูลครบรวม webhook/token)
router.get('/secure', authMiddleware, requireRole('itsupport'), async (c) => {
  const s = await ensureSettings()
  return c.json({
    ...s,
    branches: JSON.parse(s.branches || '["HQ"]'),
  })
})

// PUT /api/settings — itsupport เท่านั้น
router.put('/', authMiddleware, requireRole('itsupport'), async (c) => {
  const user = c.get('user')

  const result = await parseBody(c, updateSettingsSchema)
  if (!(result as any).data) return result as unknown as Response
  const body = (result as any).data

  const s = await prisma.settings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      siteName: body.siteName || 'ระบบขอซื้อสินค้า',
      siteSubtitle: body.siteSubtitle || 'ระบบขอซื้อสินค้า',
      logoUrl: body.logoUrl || null,
      updatedBy: user.id,
      updatedByName: user.name,
    },
    update: {
      siteName: body.siteName || undefined,
      siteSubtitle: body.siteSubtitle || undefined,
      logoUrl: body.logoUrl ?? undefined,
      discordWebhook: body.discordWebhook ?? undefined,
      discordOnNewRequest: body.discordOnNewRequest ?? undefined,
      discordOnPurchasing: body.discordOnPurchasing ?? undefined,
      discordOnAccounting: body.discordOnAccounting ?? undefined,
      discordOnTransferred: body.discordOnTransferred ?? undefined,
      discordOnRejected: body.discordOnRejected ?? undefined,
      discordOnReceived: body.discordOnReceived ?? undefined,
      discordOnLogin: body.discordOnLogin ?? undefined,
      discordOnLogout: body.discordOnLogout ?? undefined,
      discordOnPasswordReset: body.discordOnPasswordReset ?? undefined,
      discordSecurityWebhook: body.discordSecurityWebhook ?? undefined,
      discordSecurityChannelId: body.discordSecurityChannelId ?? undefined,
      discordReportEnabled: body.discordReportEnabled ?? undefined,
      discordReportTime: body.discordReportTime ?? undefined,
      discordBotToken: body.discordBotToken ?? undefined,
      discordChannelId: body.discordChannelId ?? undefined,
      discordRolePerms: body.discordRolePerms ?? undefined,
      smtpHost: body.smtpHost ?? undefined,
      smtpPort: body.smtpPort ?? undefined,
      smtpSecure: body.smtpSecure ?? undefined,
      smtpUser: body.smtpUser ?? undefined,
      smtpPass: body.smtpPass ?? undefined,
      smtpFrom: body.smtpFrom ?? undefined,
      branches: body.branches ? JSON.stringify(body.branches) : undefined,
      updatedBy: user.id,
      updatedByName: user.name,
    },
  })

  return c.json({
    ...s,
    branches: JSON.parse(s.branches || '["HQ"]'),
  })
})

// POST /api/settings/test-email — itsupport ทดสอบส่งอีเมล
router.post('/test-email', authMiddleware, requireRole('itsupport'), async (c) => {
  const { id, name, role } = c.get('user')

  try {
    const [settings, dbUser] = await Promise.all([
      ensureSettings(),
      prisma.user.findUnique({ where: { id }, select: { email: true } }),
    ])

    // เลือก SMTP: DB ก่อน → .env fallback
    const useDbSmtp = !!(settings.smtpHost && settings.smtpUser && settings.smtpPass)
    if (!useDbSmtp && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
      return c.json({ error: 'ยังไม่ได้ตั้งค่า SMTP — กรุณาตั้งค่าในหน้า Site Settings หรือ .env' }, 400)
    }

    const transporter = useDbSmtp
      ? nodemailer.createTransport({
          host: settings.smtpHost!,
          port: settings.smtpPort || 587,
          secure: settings.smtpSecure || false,
          auth: { user: settings.smtpUser!, pass: settings.smtpPass! },
        })
      : nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        })

    const fromAddr = useDbSmtp
      ? (settings.smtpFrom || settings.smtpUser!)
      : (process.env.SMTP_FROM || process.env.SMTP_USER || '')

    const siteName = settings.siteName || 'ระบบขอซื้อสินค้า'
    const toEmail = dbUser?.email || (useDbSmtp ? settings.smtpUser! : process.env.SMTP_USER!)

    await transporter.sendMail({
      from: fromAddr,
      to: toEmail,
      subject: `[${siteName}] ทดสอบระบบอีเมลแจ้งเตือน`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
          <div style="background:#1d4ed8;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="color:#fff;margin:0">${siteName} — ทดสอบระบบอีเมล</h2>
          </div>
          <div style="background:#fff;padding:20px;border:1px solid #e2e8f0;border-radius:0 0 8px 8px">
            <p>ระบบอีเมลแจ้งเตือนของ <strong>${siteName}</strong> พร้อมใช้งานแล้ว</p>
            <p style="color:#64748b;font-size:14px">ทดสอบโดย: ${name} (${role})<br/>
            SMTP: ${useDbSmtp ? settings.smtpHost : 'Gmail (.env)'}<br/>
            เวลา: ${new Date().toLocaleString('th-TH')}</p>
          </div>
        </div>`,
    })

    return c.json({ ok: true, sentTo: toEmail, smtpSource: useDbSmtp ? 'database' : 'env' })
  } catch (err: any) {
    return c.json({ error: err.message || 'ส่งอีเมลไม่สำเร็จ' }, 500)
  }
})

// helper — build report data from DB
export async function buildReportData(siteName: string): Promise<ReportData> {
  const requests = await prisma.purchaseRequest.findMany({ select: { status: true, totalAmount: true, dueDate: true } })
  const today = new Date().toISOString().slice(0, 10)
  const count = (s: string) => requests.filter(r => r.status === s).length
  const sum = (s: string) => requests.filter(r => r.status === s).reduce((a, r) => a + r.totalAmount, 0)
  const inProg = ['pending', 'purchasing', 'accounting', 'transferred']
  return {
    siteName,
    total: requests.length,
    pending: count('pending'), purchasing: count('purchasing'),
    accounting: count('accounting'), transferred: count('transferred'),
    received: count('received'), rejected: count('rejected'),
    totalAmount: requests.reduce((a, r) => a + r.totalAmount, 0),
    transferredAmount: sum('transferred') + sum('received'),
    inProgressAmount: inProg.reduce((a, s) => a + sum(s), 0),
    overdueCount: requests.filter(r => inProg.includes(r.status) && r.dueDate && r.dueDate < today).length,
  }
}

// GET /api/settings/bot-status
router.get('/bot-status', authMiddleware, requireRole('itsupport'), (c) => {
  return c.json({ online: isBotOnline() })
})

// POST /api/settings/bot-start — (re)start bot with current token
router.post('/bot-start', authMiddleware, requireRole('itsupport'), async (c) => {
  const s = await ensureSettings()
  if (!s.discordBotToken) return c.json({ error: 'ยังไม่ได้ตั้งค่า Bot Token' }, 400)
  try {
    await startBot(s.discordBotToken)
    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ error: e.message || 'เชื่อมต่อ Bot ไม่สำเร็จ — ตรวจสอบ Token อีกครั้ง' }, 500)
  }
})

// POST /api/settings/bot-stop
router.post('/bot-stop', authMiddleware, requireRole('itsupport'), async (c) => {
  await stopBot()
  return c.json({ ok: true })
})

// POST /api/settings/bot-report — ส่งรายงานพร้อมปุ่มผ่าน Bot
router.post('/bot-report', authMiddleware, requireRole('itsupport'), async (c) => {
  const s = await ensureSettings()
  if (!s.discordBotToken) return c.json({ error: 'ยังไม่ได้ตั้งค่า Bot Token' }, 400)
  if (!s.discordChannelId) return c.json({ error: 'ยังไม่ได้ตั้งค่า Channel ID' }, 400)
  try {
    const data = await buildReportData(s.siteName)
    await sendReportToChannel(s.discordChannelId, data)
    return c.json({ ok: true })
  } catch (e: any) {
    console.error('[bot-report] error:', e.message, e.code ?? '')
    return c.json({ error: e.message || 'ส่งรายงานไม่สำเร็จ' }, 500)
  }
})

// POST /api/settings/discord-report — ส่งรายงานสรุปไป Discord ทันที
router.post('/discord-report', authMiddleware, requireRole('itsupport'), async (c) => {
  const s = await ensureSettings()
  if (!s.discordWebhook) return c.json({ error: 'ยังไม่ได้ตั้งค่า Discord Webhook URL' }, 400)
  try {
    const data = await buildReportData(s.siteName)
    await discordDailyReport(s.discordWebhook, data)
    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ error: e.message || 'ส่งรายงานไม่สำเร็จ' }, 500)
  }
})

// POST /api/settings/test-discord — itsupport ทดสอบส่ง Discord webhook
router.post('/test-discord', authMiddleware, requireRole('itsupport'), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const webhook = body.webhook || (await ensureSettings()).discordWebhook
  if (!webhook) return c.json({ error: 'ยังไม่ได้ตั้งค่า Discord Webhook URL' }, 400)
  try {
    await discordTest(webhook)
    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ error: e.message || 'ส่ง Discord ไม่สำเร็จ' }, 500)
  }
})

export default router
