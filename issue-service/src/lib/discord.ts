import { discordWebhookFor, type SystemName } from '../systems.js'

export async function notifyDiscord(issue: {
  system: SystemName
  description: string
  page: string | null
  reporterName: string | null
  reporterRole: string | null
}): Promise<void> {
  const webhookUrl = discordWebhookFor(issue.system)
  if (!webhookUrl) return // unconfigured for this system → skip silently, same as every existing system's own endpoint

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: issue.system,
        embeds: [
          {
            title: `🐞 แจ้งปัญหาใหม่ - ${issue.system}`,
            description: issue.description,
            color: 0xef4444,
            fields: [
              {
                name: 'ผู้แจ้ง',
                value: issue.reporterName ? `${issue.reporterName} (${issue.reporterRole ?? '-'})` : 'ไม่ระบุ (ยังไม่ได้ login)',
                inline: true,
              },
              { name: 'หน้า', value: issue.page ?? '-', inline: true },
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
