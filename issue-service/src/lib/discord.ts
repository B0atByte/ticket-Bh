import { SEVERITY_META, type Severity } from '../constants.js'
import { discordWebhookFor, type SystemName } from '../systems.js'

export async function notifyDiscord(issue: {
  system: SystemName
  description: string
  page: string | null
  severity: Severity
  reporterName: string
  reporterRole: string | null
  hasAttachment: boolean
}): Promise<void> {
  const webhookUrl = discordWebhookFor(issue.system)
  if (!webhookUrl) return // unconfigured for this system → skip silently, same as every existing system's own endpoint

  const meta = SEVERITY_META[issue.severity]

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: issue.system,
        embeds: [
          {
            title: `${meta.emoji} แจ้งปัญหาใหม่ (${meta.label}) - ${issue.system}`,
            description: issue.description,
            color: meta.color,
            fields: [
              { name: 'ผู้แจ้ง', value: `${issue.reporterName}${issue.reporterRole ? ` (${issue.reporterRole})` : ''}`, inline: true },
              { name: 'หน้า', value: issue.page ?? '-', inline: true },
              { name: 'ไฟล์แนบ', value: issue.hasAttachment ? 'มี' : 'ไม่มี', inline: true },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    })
  } catch (err) {
    console.error(`Discord webhook failed for ${issue.system}:`, err)
  }
}
