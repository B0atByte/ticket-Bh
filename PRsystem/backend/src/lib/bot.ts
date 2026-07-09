import {
  Client, GatewayIntentBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  type ButtonInteraction,
} from 'discord.js'
import { prisma } from './prisma.js'
import { buildReportData } from '../routes/settings.js'
import type { ReportData } from './discord.js'

let client: Client | null = null
let botReady = false

const STATUS_TH: Record<string, string> = {
  pending: 'รอฝ่ายจัดซื้อ', purchasing: 'ออก PR/PO แล้ว',
  accounting: 'รอโอนเงิน', transferred: 'รอรับสินค้า',
  received: 'รับสินค้าแล้ว', rejected: 'ปฏิเสธ',
}

const fmtTHB = (n: number) => `฿${n.toLocaleString('th-TH')}`

function buildReportEmbed(d: ReportData): EmbedBuilder {
  const todayStr = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const timeStr = new Date().toLocaleTimeString('th-TH', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
  })
  const inProgress = d.pending + d.purchasing + d.accounting + d.transferred

  return new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle(`รายงานสรุป — ${d.siteName}`)
    .setDescription(`**${todayStr}** เวลา ${timeStr} น.`)
    .addFields(
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
          `ออก PR/PO: **${d.purchasing}** รายการ`,
          `รอโอนเงิน: **${d.accounting}** รายการ`,
          `รอรับสินค้า: **${d.transferred}** รายการ`,
        ].join('\n'),
        inline: false,
      },
      {
        name: 'ยอดเงิน',
        value: [
          `ยอดรวมทั้งหมด: **${fmtTHB(d.totalAmount)}**`,
          `โอนสำเร็จ: **${fmtTHB(d.transferredAmount)}**`,
          `ค้างดำเนินการ: **${fmtTHB(d.inProgressAmount)}**`,
        ].join('\n'),
        inline: false,
      },
      ...(d.overdueCount > 0 ? [{
        name: 'เกินกำหนดชำระ — ต้องดำเนินการด่วน',
        value: `มี **${d.overdueCount}** รายการที่เกินกำหนดชำระแล้ว`,
        inline: false,
      }] : []),
    )
    .setFooter({ text: 'คลิกปุ่มด้านล่างเพื่อดูรายละเอียดเพิ่มเติม' })
    .setTimestamp()
}

function buildButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('report_refresh').setLabel('รีเฟรช').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('report_daily').setLabel('ยอดวันนี้').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('report_monthly').setLabel('ยอดเดือนนี้').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('report_pending').setLabel('รายการค้าง').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('report_overdue').setLabel('เกินกำหนด').setStyle(ButtonStyle.Danger),
  )
}

const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const STATUS_LABEL: Record<string, string> = {
  pending: 'รอฝ่ายจัดซื้อ', purchasing: 'ออก PR/PO', accounting: 'รอโอนเงิน',
  transferred: 'รอรับสินค้า', received: 'รับสินค้าแล้ว', rejected: 'ปฏิเสธ',
}

async function handleDaily(interaction: ButtonInteraction) {
  await interaction.deferReply({ ephemeral: true })
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const rows = await prisma.purchaseRequest.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: { status: true, totalAmount: true, category: true },
  })

  const total = rows.reduce((s, r) => s + r.totalAmount, 0)
  const dateLabel = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

  if (rows.length === 0) {
    await interaction.editReply({ content: `ยังไม่มีใบขอซื้อวันนี้ (${dateLabel})` })
    return
  }

  const byStatus = Object.entries(STATUS_LABEL)
    .map(([k, label]) => {
      const list = rows.filter(r => r.status === k)
      return list.length ? `${label}: **${list.length}** รายการ (฿${fmtTHB(list.reduce((s, r) => s + r.totalAmount, 0)).slice(1)})` : null
    }).filter(Boolean).join('\n')

  const byCat = [...new Set(rows.map(r => r.category))]
    .map(cat => {
      const list = rows.filter(r => r.category === cat)
      return `${cat}: **${list.length}** รายการ · ${fmtTHB(list.reduce((s, r) => s + r.totalAmount, 0))}`
    }).join('\n')

  const embed = new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle(`ยอดวันนี้ — ${dateLabel}`)
    .setDescription(`รวม **${rows.length}** รายการ · ยอดรวม **${fmtTHB(total)}**`)
    .addFields(
      { name: 'แยกตามสถานะ', value: byStatus || '—', inline: false },
      { name: 'แยกตามหมวด', value: byCat || '—', inline: false },
    )
    .setTimestamp()
  await interaction.editReply({ embeds: [embed] })
}

async function handleMonthly(interaction: ButtonInteraction) {
  await interaction.deferReply({ ephemeral: true })
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const rows = await prisma.purchaseRequest.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: { status: true, totalAmount: true, category: true, createdAt: true },
  })

  const total = rows.reduce((s, r) => s + r.totalAmount, 0)
  const monthLabel = `${MONTH_TH[now.getMonth()]} ${now.getFullYear() + 543}`

  if (rows.length === 0) {
    await interaction.editReply({ content: `ยังไม่มีใบขอซื้อเดือน ${monthLabel}` })
    return
  }

  // สรุปรายสัปดาห์
  const weeks = [
    { label: 'สัปดาห์ที่ 1 (1–7)', from: 1, to: 7 },
    { label: 'สัปดาห์ที่ 2 (8–14)', from: 8, to: 14 },
    { label: 'สัปดาห์ที่ 3 (15–21)', from: 15, to: 21 },
    { label: 'สัปดาห์ที่ 4 (22–31)', from: 22, to: 31 },
  ]
  const weekSummary = weeks.map(w => {
    const list = rows.filter(r => { const d = new Date(r.createdAt).getDate(); return d >= w.from && d <= w.to })
    return list.length ? `${w.label}: **${list.length}** รายการ · ${fmtTHB(list.reduce((s, r) => s + r.totalAmount, 0))}` : null
  }).filter(Boolean).join('\n')

  const byStatus = Object.entries(STATUS_LABEL)
    .map(([k, label]) => {
      const list = rows.filter(r => r.status === k)
      return list.length ? `${label}: **${list.length}** รายการ (฿${fmtTHB(list.reduce((s, r) => s + r.totalAmount, 0)).slice(1)})` : null
    }).filter(Boolean).join('\n')

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle(`ยอดเดือน ${monthLabel}`)
    .setDescription(`รวม **${rows.length}** รายการ · ยอดรวม **${fmtTHB(total)}**`)
    .addFields(
      { name: 'รายสัปดาห์', value: weekSummary || '—', inline: false },
      { name: 'แยกตามสถานะ', value: byStatus || '—', inline: false },
    )
    .setTimestamp()
  await interaction.editReply({ embeds: [embed] })
}

async function handleRefresh(interaction: ButtonInteraction) {
  await interaction.deferUpdate()
  const s = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  if (!s) return
  const data = await buildReportData(s.siteName)
  await interaction.editReply({ embeds: [buildReportEmbed(data)], components: [buildButtons()] })
}

async function handlePending(interaction: ButtonInteraction) {
  await interaction.deferReply({ ephemeral: true })
  const requests = await prisma.purchaseRequest.findMany({
    where: { status: { in: ['pending', 'purchasing', 'accounting', 'transferred'] } },
    orderBy: { updatedAt: 'desc' },
    take: 15,
    select: { reqNo: true, title: true, totalAmount: true, status: true, createdByName: true, dueDate: true },
  })
  if (requests.length === 0) {
    await interaction.editReply({ content: 'ไม่มีรายการค้างดำเนินการ' })
    return
  }
  const today = new Date().toISOString().slice(0, 10)
  const lines = requests.map(r => {
    const overdue = r.dueDate && r.dueDate < today ? ' [เกินกำหนด]' : ''
    return `• \`${r.reqNo}\` **${r.title.slice(0, 30)}${r.title.length > 30 ? '...' : ''}**${overdue}\n  ${STATUS_TH[r.status]} · ${fmtTHB(r.totalAmount)} · ${r.createdByName}`
  })
  let desc = lines.join('\n\n')
  if (desc.length > 3900) desc = desc.slice(0, 3900) + '\n...(แสดงบางส่วน)'
  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`รายการที่รอดำเนินการ (${requests.length} รายการ)`)
    .setDescription(desc)
    .setTimestamp()
  await interaction.editReply({ embeds: [embed] })
}

async function handleOverdue(interaction: ButtonInteraction) {
  await interaction.deferReply({ ephemeral: true })
  const today = new Date().toISOString().slice(0, 10)
  const requests = await prisma.purchaseRequest.findMany({
    where: {
      status: { in: ['pending', 'purchasing', 'accounting', 'transferred'] },
      dueDate: { lt: today, not: '' },
    },
    orderBy: { dueDate: 'asc' },
    select: { reqNo: true, title: true, totalAmount: true, status: true, dueDate: true, createdByName: true },
  })
  if (requests.length === 0) {
    await interaction.editReply({ content: 'ไม่มีรายการที่เกินกำหนดชำระ' })
    return
  }
  let overdueDesc = requests.map(r =>
    `• \`${r.reqNo}\` **${r.title.slice(0, 30)}${r.title.length > 30 ? '...' : ''}**\n  กำหนด: **${r.dueDate}** · ${STATUS_TH[r.status]} · ${fmtTHB(r.totalAmount)}`
  ).join('\n\n')
  if (overdueDesc.length > 3900) overdueDesc = overdueDesc.slice(0, 3900) + '\n...(แสดงบางส่วน)'
  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle(`รายการเกินกำหนดชำระ (${requests.length} รายการ)`)
    .setDescription(overdueDesc)
    .setTimestamp()
  await interaction.editReply({ embeds: [embed] })
}

export async function startBot(token: string): Promise<void> {
  if (client) {
    try { await client.destroy() } catch { /* ignore */ }
    client = null
    botReady = false
  }

  client = new Client({ intents: [GatewayIntentBits.Guilds] })

  const onReady = () => {
    botReady = true
    console.log(`[bot] Logged in as ${client!.user?.tag}`)
  }
  client.once('ready', onReady)
  client.once('clientReady', onReady)

  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return
    try {
      // ตรวจสิทธิ์ Discord Role
      const s = await prisma.settings.findUnique({ where: { id: 'singleton' }, select: { discordRolePerms: true } })
      if (s?.discordRolePerms) {
        const perms: Record<string, { name?: string; buttons: string[] } | string[]> = JSON.parse(s.discordRolePerms)
        const memberRoles = interaction.member?.roles
        const userRoleIds = memberRoles && 'cache' in memberRoles
          ? [...(memberRoles as any).cache.keys()]
          : []

        const getButtons = (v: any): string[] => {
          if (Array.isArray(v)) return v
          if (v && Array.isArray(v.buttons)) return v.buttons
          return []
        }

        const allowed = Object.entries(perms).some(([roleId, value]) => {
          if (!userRoleIds.includes(roleId)) return false
          const buttons = getButtons(value)
          return buttons.includes('*') || buttons.includes(interaction.customId)
        })

        // ถ้ามี config แต่ user ไม่มี role ที่ตรง → ปฏิเสธ
        const hasAnyConfig = Object.keys(perms).length > 0
        if (hasAnyConfig && !allowed) {
          await interaction.reply({
            content: 'คุณไม่มีสิทธิ์ใช้ปุ่มนี้',
            ephemeral: true,
          })
          return
        }
      }

      if (interaction.customId === 'report_refresh') await handleRefresh(interaction)
      else if (interaction.customId === 'report_daily') await handleDaily(interaction)
      else if (interaction.customId === 'report_monthly') await handleMonthly(interaction)
      else if (interaction.customId === 'report_pending') await handlePending(interaction)
      else if (interaction.customId === 'report_overdue') await handleOverdue(interaction)
    } catch (e: any) {
      console.error('[bot] interaction error:', e.message)
      try {
        if (interaction.deferred) {
          await interaction.editReply({ content: `เกิดข้อผิดพลาด: ${e.message}` })
        } else if (!interaction.replied) {
          await interaction.reply({ content: `เกิดข้อผิดพลาด: ${e.message}`, ephemeral: true })
        }
      } catch { /* ignore */ }
    }
  })

  await client.login(token)
}

export async function sendReportToChannel(channelId: string, data: ReportData): Promise<void> {
  console.log(`[bot] sendReport — online:${botReady} channelId:${channelId}`)
  if (!client || !botReady) throw new Error('Bot ยังไม่ได้เชื่อมต่อ — กรุณากด "เปิด Bot" อีกครั้ง')
  const channel = await client.channels.fetch(channelId).catch(() => null)
  console.log(`[bot] channel fetched — type:${channel?.type ?? 'null'}`)
  if (!channel) throw new Error(`หาช่องไม่พบ — ตรวจสอบ Channel ID (${channelId}) และสิทธิ์ Bot`)
  if (!channel.isTextBased()) throw new Error(`ช่องนี้ไม่รองรับการส่งข้อความ (type: ${channel.type})`)
  if ('send' in channel) {
    await (channel as any).send({ embeds: [buildReportEmbed(data)], components: [buildButtons()] })
  } else {
    throw new Error('Bot ไม่สามารถส่งข้อความในช่องนี้ได้')
  }
}

export function isBotOnline(): boolean { return botReady }

export async function stopBot(): Promise<void> {
  if (client) { await client.destroy().catch(() => {}); client = null; botReady = false }
}
