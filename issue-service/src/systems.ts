// Single source of truth for which systems may report into this service.
// Keep these names identical to the "system" values issues-dashboard already
// uses in its per-source config (issues-dashboard/backend/src/lib/sources.ts)
// so a future swap to this service is a drop-in rename, not a data migration.
export const SYSTEMS = ['Bhlogisticssystem', 'PRsystem', 'lms-casa', 'xBloom', 'QSC-Sytem'] as const

export type SystemName = (typeof SYSTEMS)[number]

export function isSystemName(value: string): value is SystemName {
  return (SYSTEMS as readonly string[]).includes(value)
}

// One Discord webhook URL per system, independently configurable — mirrors
// how each system today notifies its own channel. Unset = notifications
// silently skipped for that system (same "no error if unconfigured" contract
// every system's own report-issue endpoint already follows).
export function discordWebhookFor(system: SystemName): string | undefined {
  const env: Record<SystemName, string | undefined> = {
    Bhlogisticssystem: process.env.DISCORD_WEBHOOK_BHLOGISTICSSYSTEM,
    PRsystem: process.env.DISCORD_WEBHOOK_PRSYSTEM,
    'lms-casa': process.env.DISCORD_WEBHOOK_LMSCASA,
    xBloom: process.env.DISCORD_WEBHOOK_XBLOOM,
    'QSC-Sytem': process.env.DISCORD_WEBHOOK_QSCSYTEM,
  }
  return env[system]
}
