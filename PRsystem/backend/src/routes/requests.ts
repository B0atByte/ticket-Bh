import { Hono } from 'hono'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { mailNewRequest, mailAccountingForward, mailTransferred, mailRejected } from '../lib/mailer.js'
import { discordNewRequest, discordPurchasing, discordAccounting, discordTransferred, discordRejected, discordReceived, type Actor } from '../lib/discord.js'
import { parseBody } from '../lib/validate.js'
import type { RequestStatus } from '@prisma/client'

const requests = new Hono()
requests.use('*', authMiddleware)

const itemSchema = z.object({
  code: z.string().max(50).default(''),
  name: z.string().max(200).default(''),
  qty: z.number().positive('จำนวนต้องมากกว่า 0').default(1),
  unit: z.string().max(50).default(''),
  price: z.number().nonnegative('ราคาต้องไม่ติดลบ').default(0),
  itemNote: z.string().max(500).optional().default(''),
  externalLink: z.string().max(2000).optional().default(''),
})

const createRequestSchema = z.object({
  title: z.string().min(1, 'กรุณากรอกชื่อใบขอซื้อ').max(200),
  reason: z.string().max(1000).optional().default(''),
  category: z.string().max(100).default(''),
  categories: z.array(z.string()).optional().default([]),
  totalAmount: z.number().nonnegative('ยอดรวมต้องไม่ติดลบ'),
  vatAmount: z.number().nonnegative().optional().default(0),
  supplierName: z.string().max(200).default(''),
  supplierName2: z.string().max(200).optional().default(''),
  paymentMethod: z.enum(['bank', 'cash', 'transfer'], { message: 'กรุณาเลือกช่องทางการชำระเงิน' }),
  paymentTiming: z.enum(['before', 'after'], { message: 'กรุณาเลือกกำหนดจ่าย' }),
  orderDate: z.string().optional().default(''),
  deliveryDate: z.string().optional().default(''),
  dueDate: z.string().optional().default(''),
  contactName: z.string().max(200).optional().default(''),
  signedDate: z.string().optional().default(''),
  requestFile: z.string().optional(),
  branch: z.string().max(100).default('HQ'),
  requestPhotos: z.string().optional(),
  items: z.array(itemSchema).optional().default([]),
})

const STATUS_VALUES = ['purchasing', 'accounting', 'transferred', 'received', 'rejected'] as const

const updateStatusSchema = z.object({
  status: z.enum(STATUS_VALUES, { message: 'status ไม่ถูกต้อง' }),
  prNo: z.string().max(100).optional(),
  poNo: z.string().max(100).optional(),
  prFile: z.string().optional(),
  poFile: z.string().optional(),
  transferRef: z.string().max(200).optional(),
  transferDate: z.string().optional(),
  transferFile: z.string().optional(),
  deliveryNote: z.string().optional(),
  taxInvoice: z.string().optional(),
  receivedAt: z.string().optional(),
  productPhotos: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

const formatRequest = (r: any) => ({
  ...r,
  categories: JSON.parse(r.categories || '[]'),
  createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString().slice(0, 10) : r.createdAt,
  updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString().slice(0, 10) : r.updatedAt,
})

// GET /api/requests
requests.get('/', async (c) => {
  const user = c.get('user')
  const where = user.role === 'owner' ? {} : { createdBy: user.id }
  const data = await prisma.purchaseRequest.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  })
  return c.json(data.map(formatRequest))
})

// GET /api/requests/all
requests.get('/all', async (c) => {
  const user = c.get('user')
  const allowed = ['owner', 'purchasing', 'accounting', 'itsupport']
  if (!allowed.includes(user.role)) return c.json({ error: 'Forbidden' }, 403)
  const data = await prisma.purchaseRequest.findMany({
    orderBy: { updatedAt: 'desc' },
  })
  return c.json(data.map(formatRequest))
})

// GET /api/requests/export — ต้องอยู่ก่อน /:id เพราะ Hono จะ match /export เป็น id ถ้าอยู่หลัง
requests.get('/export', async (c) => {
  const user = c.get('user')
  const statusFilter = c.req.query('status') || ''
  const allowed = ['owner', 'purchasing', 'accounting', 'itsupport']

  const where: any = {}
  if (!allowed.includes(user.role)) where.createdBy = user.id
  if (statusFilter) where.status = statusFilter

  const data = await prisma.purchaseRequest.findMany({ where, orderBy: { createdAt: 'desc' } })
  const rows = data.map(formatRequest)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Casa Lapin PR System'; wb.created = new Date()

  const STATUS_TH: Record<string, string> = { pending: 'รอฝ่ายจัดซื้อ', purchasing: 'ออก PR/PO', accounting: 'รอโอนเงิน', transferred: 'รอรับสินค้า', received: 'รับสินค้าแล้ว', rejected: 'ปฏิเสธ' }
  const STATUS_COLOR: Record<string, string> = { pending: 'FFF59E0B', purchasing: 'FF3B82F6', accounting: 'FF8B5CF6', transferred: 'FFF97316', received: 'FF22C55E', rejected: 'FFEF4444' }
  const STATUS_TEXT: Record<string, string> = { pending: 'FF92400E', purchasing: 'FF1E3A8A', accounting: 'FF4C1D95', transferred: 'FF7C2D12', received: 'FF14532D', rejected: 'FF7F1D1D' }
  const PM_TH: Record<string, string> = { bank: 'โอนผ่านธนาคาร', cash: 'เงินสด', transfer: 'โอนเงิน' }

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  const siteName = settings?.siteName || 'Casa Lapin'

  // ─── Sheet 1: สรุปภาพรวม ────────────────────────────────────────
  const ws1 = wb.addWorksheet('สรุปภาพรวม')
  ws1.columns = [{ width: 28 }, { width: 18 }, { width: 22 }, { width: 18 }]

  ws1.mergeCells('A1:D1')
  Object.assign(ws1.getCell('A1'), {
    value: `${siteName} — รายงานใบขอซื้อ`,
    font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  ws1.getRow(1).height = 36

  ws1.mergeCells('A2:D2')
  Object.assign(ws1.getCell('A2'), {
    value: `สร้างเมื่อ: ${new Date().toLocaleString('th-TH')}${statusFilter ? `  |  กรองสถานะ: ${STATUS_TH[statusFilter] || statusFilter}` : ''}`,
    font: { italic: true, color: { argb: 'FF64748B' } },
    alignment: { horizontal: 'center' },
  })
  ws1.getRow(2).height = 20; ws1.getRow(3).height = 8

  const hdrStyle = (row: ExcelJS.Row, texts: string[]) => {
    row.height = 22
    texts.forEach((t, i) => Object.assign(row.getCell(i + 1), {
      value: t, font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } },
      alignment: { horizontal: 'center' },
      border: { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } },
    }))
  }
  hdrStyle(ws1.getRow(4), ['สถานะ', 'จำนวน (รายการ)', 'ยอดรวม (บาท)', 'สัดส่วน'])

  const totalAmt = rows.reduce((s, r) => s + r.totalAmount, 0)
  let ri = 5
  for (const [k, label] of Object.entries(STATUS_TH)) {
    const list = rows.filter(r => r.status === k)
    if (!statusFilter && list.length === 0) continue
    const amt = list.reduce((s, r) => s + r.totalAmount, 0)
    const row = ws1.getRow(ri++); row.height = 20
    ;[label, list.length, amt, totalAmt ? `${Math.round(amt / totalAmt * 100)}%` : '0%'].forEach((v, i) => {
      const cell = row.getCell(i + 1)
      Object.assign(cell, { value: v, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_COLOR[k] || 'FFFFFFFF' } }, font: { color: { argb: STATUS_TEXT[k] || 'FF000000' }, bold: i === 0 }, alignment: { horizontal: i === 0 ? 'left' : 'center' }, border: { bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } } } })
      if (i === 2) { cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'right' } }
      if (i === 0) cell.alignment = { horizontal: 'left', indent: 1 }
    })
  }
  const tr = ws1.getRow(ri); tr.height = 22
  ;['รวมทั้งหมด', rows.length, totalAmt, '100%'].forEach((v, i) => {
    const cell = tr.getCell(i + 1)
    Object.assign(cell, { value: v, font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }, alignment: { horizontal: i === 0 ? 'left' : 'center' }, border: { top: { style: 'medium', color: { argb: 'FF94A3B8' } } } })
    if (i === 2) { cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'right' } }
  })

  // ─── Sheet 2: รายละเอียด ─────────────────────────────────────────
  const ws2 = wb.addWorksheet('รายละเอียด')
  ws2.columns = [
    { header: 'เลขที่', key: 'reqNo', width: 16 }, { header: 'ชื่อรายการ', key: 'title', width: 36 },
    { header: 'หมวด', key: 'category', width: 16 }, { header: 'ผู้ขอ', key: 'createdByName', width: 20 },
    { header: 'สถานะ', key: 'status', width: 18 }, { header: 'ยอดเงิน', key: 'totalAmount', width: 14 },
    { header: 'วิธีชำระ', key: 'paymentMethod', width: 16 }, { header: 'กำหนดชำระ', key: 'dueDate', width: 14 },
    { header: 'PR No.', key: 'prNo', width: 12 }, { header: 'PO No.', key: 'poNo', width: 12 },
    { header: 'Ref โอนเงิน', key: 'transferRef', width: 16 }, { header: 'วันที่โอน', key: 'transferDate', width: 14 },
    { header: 'วันที่สร้าง', key: 'createdAt', width: 14 },
  ]
  const hRow = ws2.getRow(1); hRow.height = 24
  hRow.eachCell(cell => Object.assign(cell, {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: { bottom: { style: 'medium', color: { argb: 'FF93C5FD' } } },
  }))

  rows.forEach((r, idx) => {
    const row = ws2.addRow({
      reqNo: r.reqNo, title: r.title, category: r.category, createdByName: r.createdByName,
      status: STATUS_TH[r.status] || r.status, totalAmount: r.totalAmount,
      paymentMethod: PM_TH[r.paymentMethod] || r.paymentMethod, dueDate: r.dueDate || '—',
      prNo: r.prNo || '—', poNo: r.poNo || '—', transferRef: r.transferRef || '—',
      transferDate: r.transferDate || '—', createdAt: r.createdAt,
    })
    row.height = 19
    row.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' } }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } }
      cell.alignment = { vertical: 'middle' }
      if (col === 6) { cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'right', vertical: 'middle' } }
    })
    const sc = row.getCell(5)
    Object.assign(sc, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_COLOR[r.status] || 'FFSLATE' } }, font: { bold: true, color: { argb: STATUS_TEXT[r.status] || 'FF000000' } }, alignment: { horizontal: 'center', vertical: 'middle' } })
  })
  ws2.views = [{ state: 'frozen', ySplit: 1 }]

  const buf = await wb.xlsx.writeBuffer()
  return new Response(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="purchase-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
})

// GET /api/requests/:id
requests.get('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const data = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!data) return c.json({ error: 'Not found' }, 404)
  // ถ้าไม่ใช่ owner และไม่ใช่ผู้สร้าง ต้องเป็น role ที่ดำเนินการ
  const isOwnerOfReq = data.createdBy === user.id
  const isProcessor = ['owner', 'purchasing', 'accounting', 'itsupport'].includes(user.role)
  if (!isOwnerOfReq && !isProcessor) return c.json({ error: 'Forbidden' }, 403)
  return c.json(formatRequest(data))
})

// PUT /api/requests/:id — แก้ไขใบขอซื้อ (เฉพาะผู้สร้าง + status pending เท่านั้น)
requests.put('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()

  const existing = await prisma.purchaseRequest.findUnique({ where: { id } })
  if (!existing) return c.json({ error: 'Not found' }, 404)
  if (existing.createdBy !== user.id && user.role !== 'owner') return c.json({ error: 'Forbidden' }, 403)
  if (existing.status !== 'pending') return c.json({ error: 'ไม่สามารถแก้ไขใบขอซื้อที่ส่งดำเนินการแล้ว' }, 400)

  const result = await parseBody(c, createRequestSchema)
  if (!(result as any).data) return result as unknown as Response
  const body = (result as any).data

  const wrapFile = (url?: string) =>
    url ? JSON.stringify({ url, by: user.name, byRole: user.role, at: new Date().toISOString() }) : undefined

  const updated = await prisma.purchaseRequest.update({
    where: { id },
    data: {
      title: body.title,
      reason: body.reason || '',
      category: body.category,
      categories: JSON.stringify(body.categories || []),
      totalAmount: body.totalAmount,
      vatAmount: body.vatAmount ?? 0,
      supplierName: body.supplierName,
      supplierName2: body.supplierName2 || '',
      paymentMethod: body.paymentMethod,
      paymentTiming: body.paymentTiming,
      orderDate: body.orderDate,
      deliveryDate: body.deliveryDate,
      dueDate: body.dueDate,
      contactName: body.contactName,
      signedDate: body.signedDate,
      requestFile: body.requestFile ? wrapFile(body.requestFile) : existing.requestFile,
      branch: body.branch || 'HQ',
      requestPhotos: body.requestPhotos ?? undefined,
      items: { deleteMany: {}, create: body.items },
    },
    include: { items: true },
  })

  return c.json(formatRequest(updated))
})

// POST /api/requests — employee และ owner
requests.post('/', requireRole('employee', 'owner'), async (c) => {
  const user = c.get('user')
  const result = await parseBody(c, createRequestSchema)
  if (!(result as any).data) return result as unknown as Response
  const body = (result as any).data

  const year = new Date().getFullYear() + 543
  const prefix = `PR-${year}-`
  const last = await prisma.purchaseRequest.findFirst({
    where: { reqNo: { startsWith: prefix } },
    orderBy: { reqNo: 'desc' },
    select: { reqNo: true },
  })
  const lastNum = last ? parseInt(last.reqNo.replace(prefix, ''), 10) : 0
  const reqNo = `${prefix}${String(lastNum + 1).padStart(3, '0')}`

  const wrapFileCreate = (url?: string) =>
    url ? JSON.stringify({ url, by: user.name, byRole: user.role, at: new Date().toISOString() }) : undefined

  const data = await prisma.purchaseRequest.create({
    data: {
      reqNo,
      title: body.title,
      reason: body.reason || '',
      category: body.category,
      categories: JSON.stringify(body.categories || []),
      totalAmount: body.totalAmount,
      vatAmount: body.vatAmount ?? 0,
      supplierName: body.supplierName,
      supplierName2: body.supplierName2 || '',
      paymentMethod: body.paymentMethod,
      paymentTiming: body.paymentTiming,
      orderDate: body.orderDate,
      deliveryDate: body.deliveryDate,
      dueDate: body.dueDate,
      contactName: body.contactName,
      signedDate: body.signedDate,
      requestFile: wrapFileCreate(body.requestFile),
      branch: body.branch || 'HQ',
      requestPhotos: body.requestPhotos ?? undefined,
      createdBy: user.id,
      createdByName: user.name,
      items: { create: body.items },
    },
    include: { items: true },
  })

  const r = formatRequest(data)
  Promise.all([
    prisma.user.findMany({ where: { role: 'purchasing', active: true }, select: { email: true } }),
    prisma.user.findMany({ where: { role: 'owner', active: true }, select: { email: true } }),
  ]).then(([purchasing, owners]) => {
    const emails = [...purchasing, ...owners].map(u => u.email).filter(Boolean) as string[]
    if (emails.length) mailNewRequest(emails, r)
      .then(() => console.log('[mail] new request sent OK'))
      .catch(e => console.error('[mail] new request error:', e.message))
  }).catch(e => console.error('[mail] find users error:', e.message))

  // Discord notification — new request
  const actor: Actor = { name: user.name, role: user.role }
  prisma.settings.findUnique({ where: { id: 'singleton' } }).then(s => {
    if (s?.discordWebhook && s.discordOnNewRequest) discordNewRequest(s.discordWebhook, r, actor, s.siteName).catch(console.error)
  }).catch(console.error)

  return c.json(r, 201)
})

// PATCH /api/requests/:id/status
requests.patch('/:id/status', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()

  const result = await parseBody(c, updateStatusSchema)
  if (!(result as any).data) return result as unknown as Response
  const body = (result as any).data

  // ตรวจ role + current status transition ที่ถูกต้อง
  const allowedActions: Record<string, string[]> = {
    purchasing: ['purchasing', 'owner'],
    accounting: ['purchasing', 'owner'],
    transferred: ['accounting', 'owner'],
    received: ['employee', 'owner'],
    rejected: ['purchasing', 'accounting', 'owner'],
  }

  // กำหนด current status ที่ถูกต้องสำหรับแต่ละ transition
  const requiredCurrentStatus: Record<string, string[]> = {
    purchasing: ['pending'],
    accounting: ['purchasing'],
    transferred: ['accounting'],
    received: ['transferred'],
    rejected: ['pending', 'purchasing', 'accounting'],
  }

  const allowed = allowedActions[body.status]
  if (!allowed || !allowed.includes(user.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // ตรวจสอบ current status ก่อน transition
  const existing = await prisma.purchaseRequest.findUnique({ where: { id }, select: { createdBy: true, status: true } })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const validFrom = requiredCurrentStatus[body.status]
  if (validFrom && !validFrom.includes(existing.status)) {
    return c.json({ error: `ไม่สามารถเปลี่ยนสถานะได้ (ต้องเป็น ${validFrom.join(' หรือ ')} ก่อน)` }, 400)
  }

  // received — ต้องเป็นเจ้าของใบขอซื้อ หรือ owner ที่มีสิทธิ์ทุกอย่าง
  if (body.status === 'received' && user.role !== 'owner') {
    if (existing.createdBy !== user.id) return c.json({ error: 'Forbidden' }, 403)
  }

  const wrapFile = (url?: string) =>
    url ? JSON.stringify({ url, by: user.name, byRole: user.role, at: new Date().toISOString() }) : undefined

  const updated = await prisma.purchaseRequest.update({
    where: { id },
    data: {
      status: body.status as RequestStatus,
      prNo: body.prNo,
      poNo: body.poNo,
      prFile: body.prFile ? wrapFile(body.prFile) : undefined,
      poFile: body.poFile ? wrapFile(body.poFile) : undefined,
      transferRef: body.transferRef,
      transferDate: body.transferDate,
      transferFile: body.transferFile ? wrapFile(body.transferFile) : undefined,
      deliveryNote: body.deliveryNote ? wrapFile(body.deliveryNote) : undefined,
      taxInvoice: body.taxInvoice ? wrapFile(body.taxInvoice) : undefined,
      receivedAt: body.receivedAt,
      productPhotos: body.productPhotos ?? undefined,
      notes: body.notes,
    },
    include: { items: true },
  })

  const r = formatRequest(updated)
  const getOwnerEmails = () => prisma.user.findMany({ where: { role: 'owner', active: true }, select: { email: true } })
    .then(users => users.map(u => u.email).filter(Boolean) as string[])

  if (body.status === 'accounting') {
    Promise.all([
      prisma.user.findMany({ where: { role: 'accounting', active: true }, select: { email: true } }),
      getOwnerEmails(),
    ]).then(([accounting, owners]) => {
      const emails = [...accounting.map(u => u.email), ...owners].filter(Boolean) as string[]
      if (emails.length) mailAccountingForward(emails, r).catch(console.error)
    }).catch(console.error)
  } else if (body.status === 'transferred') {
    Promise.all([
      prisma.user.findUnique({ where: { id: updated.createdBy }, select: { email: true } }),
      getOwnerEmails(),
    ]).then(([creator, owners]) => {
      const emails = [creator?.email, ...owners].filter(Boolean) as string[]
      if (emails.length) mailTransferred(emails, r).catch(console.error)
    }).catch(console.error)
  } else if (body.status === 'rejected') {
    Promise.all([
      prisma.user.findUnique({ where: { id: updated.createdBy }, select: { email: true } }),
      getOwnerEmails(),
    ]).then(([creator, owners]) => {
      const emails = [creator?.email, ...owners].filter(Boolean) as string[]
      if (emails.length) mailRejected(emails, { ...r, notes: body.notes }).catch(console.error)
    }).catch(console.error)
  } else if (body.status === 'received') {
    getOwnerEmails().then(owners => {
      if (owners.length) mailTransferred(owners, r).catch(console.error)
    }).catch(console.error)
  }

  // Discord notifications per status
  const statusActor: Actor = { name: user.name, role: user.role }
  prisma.settings.findUnique({ where: { id: 'singleton' } }).then(s => {
    if (!s?.discordWebhook) return
    const wh = s.discordWebhook
    const sn = s.siteName
    if (body.status === 'purchasing' && s.discordOnPurchasing) discordPurchasing(wh, r, statusActor, sn).catch(console.error)
    else if (body.status === 'accounting' && s.discordOnAccounting) discordAccounting(wh, r, statusActor, sn).catch(console.error)
    else if (body.status === 'transferred' && s.discordOnTransferred) discordTransferred(wh, r, statusActor, sn).catch(console.error)
    else if (body.status === 'rejected' && s.discordOnRejected) discordRejected(wh, { ...r, notes: body.notes }, statusActor, sn).catch(console.error)
    else if (body.status === 'received' && s.discordOnReceived) discordReceived(wh, r, statusActor, sn).catch(console.error)
  }).catch(console.error)

  return c.json(r)
})

export default requests
