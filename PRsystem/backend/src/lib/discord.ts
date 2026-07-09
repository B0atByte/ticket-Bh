interface DiscordField { name: string; value: string; inline?: boolean }
interface DiscordEmbed {
  author?: { name: string; icon_url?: string }
  title: string
  description?: string
  color: number
  fields?: DiscordField[]
  footer?: { text: string }
  timestamp?: string
}

export interface Actor { name: string; role: string }

const DEPT: Record<string, string> = {
  employee: 'พนักงาน',
  purchasing: 'ฝ่ายจัดซื้อ',
  accounting: 'ฝ่ายบัญชี',
  itsupport: 'IT Support',
  owner: 'ผู้ประกอบการ',
}

const fmt = (n: number) => n.toLocaleString('th-TH')
const deptLabel = (role: string) => DEPT[role] || role
const authorText = (actor: Actor) => `${actor.name}  —  ${deptLabel(actor.role)}`

async function send(webhook: string, embed: DiscordEmbed, siteName = 'ระบบขอซื้อสินค้า') {
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: siteName,
        embeds: [{
          ...embed,
          footer: embed.footer ?? { text: siteName },
          timestamp: new Date().toISOString(),
        }],
      }),
    })
    if (!res.ok) console.error('[discord] error:', res.status, await res.text().catch(() => ''))
  } catch (e: any) {
    console.error('[discord] fetch error:', e.message)
  }
}

export function discordNewRequest(webhook: string, r: any, actor: Actor, siteName?: string) {
  return send(webhook, {
    author: { name: authorText(actor) },
    title: 'ใบขอซื้อใหม่ — รอดำเนินการ',
    description: `> **${r.title}**\nพนักงานส่งคำขอเข้ามาแล้ว รอ**ฝ่ายจัดซื้อ**ดำเนินการ`,
    color: 0xf59e0b,
    fields: [
      { name: 'เลขที่', value: `\`${r.reqNo}\``, inline: true },
      { name: 'สาขา', value: r.branch || 'HQ', inline: true },
      { name: 'ยอดเงิน', value: `**฿${fmt(r.totalAmount)}**`, inline: true },
      { name: 'กำหนดชำระ', value: r.dueDate || '—', inline: true },
      { name: 'วิธีชำระ', value: r.paymentMethod === 'cash' ? 'เงินสด' : r.paymentMethod === 'bank' ? 'บัญชีบริษัท' : 'สำรองจ่าย', inline: true },
      { name: 'ผู้ขอ', value: r.createdByName, inline: true },
    ],
    footer: { text: `${siteName || 'ระบบขอซื้อสินค้า'} — ฝ่ายจัดซื้อ: โปรดดำเนินการ` },
  }, siteName)
}

export function discordPurchasing(webhook: string, r: any, actor: Actor, siteName?: string) {
  return send(webhook, {
    author: { name: authorText(actor) },
    title: 'ออก PR/PO เรียบร้อยแล้ว',
    description: `> **${r.title}**\n**ฝ่ายจัดซื้อ**ออกเอกสารแล้ว รอ**ฝ่ายบัญชี**โอนเงิน`,
    color: 0x3b82f6,
    fields: [
      { name: 'เลขที่', value: `\`${r.reqNo}\``, inline: true },
      { name: 'สาขา', value: r.branch || 'HQ', inline: true },
      { name: 'PR', value: `**${r.prNo || '—'}**`, inline: true },
      { name: 'PO', value: `**${r.poNo || '—'}**`, inline: true },
      { name: 'ยอดเงิน', value: `**฿${fmt(r.totalAmount)}**`, inline: true },
      { name: 'ผู้ขอ', value: r.createdByName, inline: true },
    ],
    footer: { text: `${siteName || 'ระบบขอซื้อสินค้า'} — ฝ่ายบัญชี: มีรายการรอโอนเงิน` },
  }, siteName)
}

export function discordAccounting(webhook: string, r: any, actor: Actor, siteName?: string) {
  return send(webhook, {
    author: { name: authorText(actor) },
    title: 'ส่งต่อฝ่ายบัญชีแล้ว — รอโอนเงิน',
    description: `> **${r.title}**\n**ฝ่ายจัดซื้อ**ส่งงานต่อ รอ**ฝ่ายบัญชี**บันทึกการโอนเงิน`,
    color: 0x8b5cf6,
    fields: [
      { name: 'เลขที่', value: `\`${r.reqNo}\``, inline: true },
      { name: 'สาขา', value: r.branch || 'HQ', inline: true },
      { name: 'PR / PO', value: `**${r.prNo || '—'}** / **${r.poNo || '—'}**`, inline: true },
      { name: 'ยอดเงิน', value: `**฿${fmt(r.totalAmount)}**`, inline: true },
      { name: 'ผู้ขอ', value: r.createdByName, inline: true },
      { name: 'กำหนดชำระ', value: r.dueDate || '—', inline: true },
    ],
    footer: { text: `${siteName || 'ระบบขอซื้อสินค้า'} — ฝ่ายบัญชี: โปรดบันทึกการโอนเงิน` },
  }, siteName)
}

export function discordTransferred(webhook: string, r: any, actor: Actor, siteName?: string) {
  return send(webhook, {
    author: { name: authorText(actor) },
    title: 'โอนเงินสำเร็จแล้ว',
    description: `> **${r.title}**\n**ฝ่ายบัญชี**บันทึกการโอนเงินเรียบร้อย รอพนักงานยืนยันรับสินค้า`,
    color: 0x10b981,
    fields: [
      { name: 'เลขที่', value: `\`${r.reqNo}\``, inline: true },
      { name: 'สาขา', value: r.branch || 'HQ', inline: true },
      { name: 'Ref โอนเงิน', value: `**${r.transferRef || '—'}**`, inline: true },
      { name: 'วันที่โอน', value: r.transferDate || '—', inline: true },
      { name: 'ยอดเงิน', value: `**฿${fmt(r.totalAmount)}**`, inline: true },
      { name: 'ผู้ขอ', value: r.createdByName, inline: true },
    ],
    footer: { text: `${siteName || 'ระบบขอซื้อสินค้า'} — พนักงาน: โปรดตรวจรับสินค้า แล้วกดยืนยัน` },
  }, siteName)
}

export function discordRejected(webhook: string, r: any, actor: Actor, siteName?: string) {
  return send(webhook, {
    author: { name: authorText(actor) },
    title: 'ปฏิเสธใบขอซื้อ',
    description: `> **${r.title}**\n**${deptLabel(actor.role)}**ปฏิเสธคำขอนี้แล้ว`,
    color: 0xef4444,
    fields: [
      { name: 'เลขที่', value: `\`${r.reqNo}\``, inline: true },
      { name: 'สาขา', value: r.branch || 'HQ', inline: true },
      { name: 'ผู้ขอ', value: r.createdByName, inline: true },
      { name: 'ยอดเงิน', value: `฿${fmt(r.totalAmount)}`, inline: true },
      { name: 'เหตุผล', value: r.notes ? `> ${r.notes}` : '—' },
    ],
    footer: { text: `${siteName || 'ระบบขอซื้อสินค้า'} — พนักงาน: ติดต่อผู้ดูแลเพื่อสอบถามเพิ่มเติม` },
  }, siteName)
}

export function discordReceived(webhook: string, r: any, actor: Actor, siteName?: string) {
  return send(webhook, {
    author: { name: authorText(actor) },
    title: 'ยืนยันรับสินค้าแล้ว — เสร็จสิ้น',
    description: `> **${r.title}**\nพนักงานยืนยันรับสินค้าเรียบร้อย กระบวนการ**เสร็จสิ้น**ทั้งหมด`,
    color: 0x22c55e,
    fields: [
      { name: 'เลขที่', value: `\`${r.reqNo}\``, inline: true },
      { name: 'สาขา', value: r.branch || 'HQ', inline: true },
      { name: 'ผู้รับ', value: `**${actor.name}**`, inline: true },
      { name: 'ยอดเงิน', value: `฿${fmt(r.totalAmount)}`, inline: true },
      { name: 'วันที่รับ', value: r.receivedAt || '—', inline: true },
    ],
    footer: { text: `${siteName || 'ระบบขอซื้อสินค้า'} — เสร็จสิ้น` },
  }, siteName)
}

export function discordLogin(webhook: string, user: { name: string; role: string; username: string }, ip: string, siteName?: string) {
  return send(webhook, {
    title: 'เข้าสู่ระบบ',
    description: `**${user.name}** (${deptLabel(user.role)}) เข้าสู่ระบบแล้ว`,
    color: 0x6366f1,
    fields: [
      { name: 'ผู้ใช้', value: `\`${user.username}\``, inline: true },
      { name: 'ตำแหน่ง', value: deptLabel(user.role), inline: true },
      { name: 'IP', value: `\`${ip}\``, inline: true },
    ],
    footer: { text: siteName || 'ระบบขอซื้อสินค้า' },
  }, siteName)
}

export function discordLogout(webhook: string, user: { name: string; role: string; username: string }, siteName?: string) {
  return send(webhook, {
    title: 'ออกจากระบบ',
    description: `**${user.name}** (${deptLabel(user.role)}) ออกจากระบบแล้ว`,
    color: 0x94a3b8,
    fields: [
      { name: 'ผู้ใช้', value: `\`${user.username}\``, inline: true },
      { name: 'ตำแหน่ง', value: deptLabel(user.role), inline: true },
    ],
    footer: { text: siteName || 'ระบบขอซื้อสินค้า' },
  }, siteName)
}

export function discordPasswordReset(
  webhook: string,
  target: { name: string; username: string },
  admin: { name: string },
  siteName?: string,
) {
  return send(webhook, {
    title: 'Reset Password',
    description: `**${admin.name}** ทำการ Reset Password ให้ **${target.name}**`,
    color: 0xf59e0b,
    fields: [
      { name: 'ผู้ถูก Reset', value: `\`${target.username}\`  (${target.name})`, inline: false },
      { name: 'ดำเนินการโดย', value: admin.name, inline: true },
    ],
    footer: { text: `${siteName || 'ระบบขอซื้อสินค้า'} — โปรดแจ้งรหัสผ่านใหม่ให้ผู้ใช้ทราบ` },
  }, siteName)
}

export interface ReportData {
  siteName: string
  total: number
  pending: number
  purchasing: number
  accounting: number
  transferred: number
  received: number
  rejected: number
  totalAmount: number
  transferredAmount: number
  inProgressAmount: number
  overdueCount: number
}

export function discordDailyReport(webhook: string, d: ReportData) {
  const todayStr = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  const inProgress = d.pending + d.purchasing + d.accounting + d.transferred

  return send(webhook, {
    title: `รายงานสรุป — ${d.siteName}`,
    description: `**${todayStr}** เวลา ${timeStr} น.`,
    color: 0x6366f1,
    fields: [
      {
        name: 'ภาพรวมใบขอซื้อ',
        value: [
          `รวมทั้งหมด: **${d.total}** รายการ`,
          `รับสินค้าแล้ว: **${d.received}** รายการ`,
          `กำลังดำเนินการ: **${inProgress}** รายการ`,
          `ถูกปฏิเสธ: **${d.rejected}** รายการ`,
        ].join('\n'),
        inline: false,
      },
      {
        name: 'รอดำเนินการแยกตามขั้นตอน',
        value: [
          `รอฝ่ายจัดซื้อ: **${d.pending}** รายการ`,
          `ออก PR/PO แล้ว: **${d.purchasing}** รายการ`,
          `รอโอนเงิน: **${d.accounting}** รายการ`,
          `รอรับสินค้า: **${d.transferred}** รายการ`,
        ].join('\n'),
        inline: false,
      },
      {
        name: 'ยอดเงิน',
        value: [
          `รวมทั้งหมด: **฿${fmt(d.totalAmount)}**`,
          `โอนสำเร็จแล้ว: **฿${fmt(d.transferredAmount)}**`,
          `ค้างดำเนินการ: **฿${fmt(d.inProgressAmount)}**`,
        ].join('\n'),
        inline: false,
      },
      ...(d.overdueCount > 0 ? [{
        name: 'เกินกำหนดชำระ — ต้องดำเนินการด่วน',
        value: `มี **${d.overdueCount}** รายการที่เกินกำหนดชำระแล้ว`,
        inline: false,
      }] : []),
    ],
    footer: { text: `${d.siteName} — รายงานอัตโนมัติ` },
  }, d.siteName)
}

export function discordTest(webhook: string, siteName?: string) {
  return send(webhook, {
    author: { name: 'IT Support — ทดสอบระบบ' },
    title: 'ทดสอบการแจ้งเตือน Discord',
    description: '**ระบบแจ้งเตือนเชื่อมต่อสำเร็จ**\nข้อความนี้ถูกส่งจากหน้าตั้งค่า Discord ของระบบขอซื้อสินค้า',
    color: 0x6366f1,
    fields: [
      { name: 'ใบขอซื้อใหม่', value: 'แจ้งเมื่อมีคำขอใหม่', inline: true },
      { name: 'PR/PO', value: 'แจ้งเมื่อออกเอกสาร', inline: true },
      { name: 'โอนเงิน', value: 'แจ้งเมื่อโอนเงินสำเร็จ', inline: true },
    ],
    footer: { text: siteName || 'ระบบขอซื้อสินค้า' },
  }, siteName)
}
