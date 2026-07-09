import nodemailer from 'nodemailer'
import { prisma } from './prisma.js'

const SITE_URL = process.env.SITE_URL || 'http://localhost:5173'

async function getTransporter() {
  const s = await prisma.settings.findUnique({ where: { id: 'singleton' } })

  // ถ้ามี SMTP ตั้งค่าใน DB ใช้ DB ก่อน
  if (s?.smtpHost && s?.smtpUser && s?.smtpPass) {
    return {
      transporter: nodemailer.createTransport({
        host: s.smtpHost,
        port: s.smtpPort || 587,
        secure: s.smtpSecure || false,
        auth: { user: s.smtpUser, pass: s.smtpPass },
      }),
      from: s.smtpFrom || s.smtpUser,
    }
  }

  // fallback ใช้ .env
  return {
    transporter: nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    }),
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  }
}

function fmt(n: number) {
  return n.toLocaleString('th-TH')
}

function loginButton() {
  return `
    <div style="margin-top:20px">
      <a href="${SITE_URL}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600">
        เข้าสู่ระบบ
      </a>
    </div>`
}

function base(title: string, body: string) {
  return `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:24px;border-radius:12px">
    <div style="background:#1d4ed8;padding:20px 24px;border-radius:8px 8px 0 0">
      <h2 style="color:#fff;margin:0;font-size:18px">PR System</h2>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0">
      <h3 style="color:#1e293b;margin-top:0">${title}</h3>
      ${body}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
      <p style="color:#94a3b8;font-size:12px;margin:0">อีเมลนี้ส่งอัตโนมัติจากระบบ PR System — กรุณาอย่าตอบกลับ</p>
    </div>
  </div>`
}

function table(rows: [string, string][]) {
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#64748b;width:140px;vertical-align:top">${label}</td>
          <td style="color:#1e293b">${value}</td>
        </tr>`).join('')}
    </table>`
}

// แจ้งฝ่ายจัดซื้อเมื่อมีใบขอซื้อใหม่
export async function mailNewRequest(to: string[], req: {
  reqNo: string; title: string; totalAmount: number; createdByName: string; category: string;
}) {
  const body = `
    <p style="color:#475569">มีใบขอซื้อใหม่รอการพิจารณาจากฝ่ายจัดซื้อ</p>
    ${table([
      ['เลขที่ใบขอซื้อ', `<strong>${req.reqNo}</strong>`],
      ['รายการ', `<strong>${req.title}</strong>`],
      ['ผู้ขอ', req.createdByName],
      ['หมวดหมู่', req.category],
      ['ยอดรวม', `<strong style="color:#1d4ed8;font-size:16px">฿${fmt(req.totalAmount)}</strong>`],
    ])}
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin-top:16px">
      <p style="color:#1d4ed8;margin:0;font-size:14px">กรุณาเข้าสู่ระบบเพื่อพิจารณาใบขอซื้อ</p>
    </div>
    ${loginButton()}`

  const { transporter, from } = await getTransporter()
  await transporter.sendMail({
    from, to: to.join(','),
    subject: `[PR System] ใบขอซื้อใหม่ — ${req.reqNo} | ${req.title}`,
    html: base('มีใบขอซื้อใหม่รอพิจารณา', body),
  })
}

// แจ้งฝ่ายบัญชีเมื่อมีใบรอโอนเงิน
export async function mailAccountingForward(to: string[], req: {
  reqNo: string; title: string; totalAmount: number; createdByName: string; prNo?: string; poNo?: string;
}) {
  const rows: [string, string][] = [
    ['เลขที่ใบขอซื้อ', `<strong>${req.reqNo}</strong>`],
    ['รายการ', `<strong>${req.title}</strong>`],
    ['ผู้ขอ', req.createdByName],
  ]
  if (req.prNo) rows.push(['PR No.', `<span style="font-family:monospace">${req.prNo}</span>`])
  if (req.poNo) rows.push(['PO No.', `<span style="font-family:monospace">${req.poNo}</span>`])
  rows.push(['ยอดรวม', `<strong style="color:#1d4ed8;font-size:16px">฿${fmt(req.totalAmount)}</strong>`])

  const body = `
    <p style="color:#475569">มีใบขอซื้อถูกส่งมาให้ฝ่ายบัญชีดำเนินการโอนเงิน</p>
    ${table(rows)}
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin-top:16px">
      <p style="color:#1d4ed8;margin:0;font-size:14px">กรุณาเข้าสู่ระบบเพื่อดำเนินการบันทึกการโอนเงิน</p>
    </div>
    ${loginButton()}`

  const { transporter, from } = await getTransporter()
  await transporter.sendMail({
    from, to: to.join(','),
    subject: `[PR System] รอโอนเงิน — ${req.reqNo} | ${req.title}`,
    html: base('มีรายการรอการโอนเงิน', body),
  })
}

// แจ้งผู้ขอเมื่อโอนเงินสำเร็จ
export async function mailTransferred(to: string | string[], req: {
  reqNo: string; title: string; totalAmount: number; transferRef?: string; transferDate?: string;
}) {
  const rows: [string, string][] = [
    ['เลขที่ใบขอซื้อ', `<strong>${req.reqNo}</strong>`],
    ['รายการ', `<strong>${req.title}</strong>`],
    ['ยอดรวม', `<strong style="color:#16a34a;font-size:16px">฿${fmt(req.totalAmount)}</strong>`],
  ]
  if (req.transferRef) rows.push(['เลข Ref.', `<span style="font-family:monospace">${req.transferRef}</span>`])
  if (req.transferDate) rows.push(['วันที่โอน', req.transferDate])

  const body = `
    <p style="color:#475569">ฝ่ายบัญชีได้บันทึกการโอนเงินสำหรับใบขอซื้อของคุณแล้ว</p>
    ${table(rows)}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-top:16px">
      <p style="color:#16a34a;margin:0;font-size:14px">ดำเนินการเสร็จสิ้นแล้ว</p>
    </div>
    ${loginButton()}`

  const { transporter, from } = await getTransporter()
  await transporter.sendMail({
    from, to: Array.isArray(to) ? to.join(',') : to,
    subject: `[PR System] โอนเงินแล้ว — ${req.reqNo} | ${req.title}`,
    html: base('ยืนยันการโอนเงินสำเร็จ', body),
  })
}

// แจ้งผู้ขอเมื่อถูกปฏิเสธ
export async function mailRejected(to: string | string[], req: {
  reqNo: string; title: string; notes?: string;
}) {
  const rows: [string, string][] = [
    ['เลขที่ใบขอซื้อ', `<strong>${req.reqNo}</strong>`],
    ['รายการ', `<strong>${req.title}</strong>`],
  ]
  if (req.notes) rows.push(['เหตุผล', `<span style="color:#dc2626">${req.notes}</span>`])

  const body = `
    <p style="color:#475569">ใบขอซื้อของคุณถูกปฏิเสธ</p>
    ${table(rows)}
    <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:12px 16px;margin-top:16px">
      <p style="color:#dc2626;margin:0;font-size:14px">กรุณาติดต่อฝ่ายจัดซื้อเพื่อข้อมูลเพิ่มเติม</p>
    </div>
    ${loginButton()}`

  const { transporter, from } = await getTransporter()
  await transporter.sendMail({
    from, to: Array.isArray(to) ? to.join(',') : to,
    subject: `[PR System] ปฏิเสธคำขอ — ${req.reqNo} | ${req.title}`,
    html: base('ใบขอซื้อถูกปฏิเสธ', body),
  })
}
