// Ops-level alert — separate from the per-system report-issue webhooks in
// issue-service. Fires when this dashboard can't reach issue-service at all,
// or when it responds slowly. Cooldown avoids re-alerting on every refresh
// while the outage is ongoing; state resets once a call succeeds quickly.
const SLOW_THRESHOLD_MS = 2000
const COOLDOWN_MS = 5 * 60 * 1000

type AlertKey = 'down' | 'slow'

let lastAlertKey: AlertKey | null = null
let lastAlertAt = 0

function env(name: string): string {
  return process.env[name] ?? ''
}

async function sendAlert(message: string, color: number): Promise<void> {
  const webhookUrl = env('OPS_DISCORD_WEBHOOK_URL')
  if (!webhookUrl) return // unconfigured → skip silently, same convention as issue-service's per-system webhooks

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'issues-dashboard',
        embeds: [
          {
            title: 'issue-service health',
            description: message,
            color,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    })
  } catch (err) {
    console.error('Discord ops alert failed:', err)
  }
}

function shouldFire(key: AlertKey): boolean {
  const now = Date.now()
  if (lastAlertKey === key && now - lastAlertAt < COOLDOWN_MS) return false
  lastAlertKey = key
  lastAlertAt = now
  return true
}

export function alertIssueServiceDown(reason: string): void {
  if (!shouldFire('down')) return
  void sendAlert(`🔴 issue-service ไม่ตอบสนอง — ${reason}`, 0xdc2626)
}

export function alertIssueServiceSlow(latencyMs: number): void {
  if (!shouldFire('slow')) return
  void sendAlert(`🟡 issue-service ตอบสนองช้า (${latencyMs}ms)`, 0xf59e0b)
}

export function clearOpsAlertState(): void {
  lastAlertKey = null
}

export const OPS_SLOW_THRESHOLD_MS = SLOW_THRESHOLD_MS
