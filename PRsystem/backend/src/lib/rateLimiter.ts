interface IpRecord {
  count: number
  lockedAt?: Date
  lastAttempt: Date
}

const MAX_ATTEMPTS = 5
const records = new Map<string, IpRecord>()

export function getClientIp(c: any): string {
  return (c.req.header('x-forwarded-for') || '').split(',')[0].trim()
    || c.req.header('x-real-ip')
    || '127.0.0.1'
}

export function isLocked(ip: string): boolean {
  const r = records.get(ip)
  return !!(r?.lockedAt)
}

export function recordFailure(ip: string): { locked: boolean; remaining: number } {
  const r = records.get(ip) || { count: 0, lastAttempt: new Date() }
  r.count += 1
  r.lastAttempt = new Date()
  if (r.count >= MAX_ATTEMPTS && !r.lockedAt) r.lockedAt = new Date()
  records.set(ip, r)
  return { locked: !!r.lockedAt, remaining: Math.max(0, MAX_ATTEMPTS - r.count) }
}

export function recordSuccess(ip: string) {
  records.delete(ip)
}

export function unlockIp(ip: string): boolean {
  if (!records.has(ip)) return false
  records.delete(ip)
  return true
}

export function getLockedIps(): { ip: string; count: number; lockedAt: Date; lastAttempt: Date }[] {
  const result = []
  for (const [ip, r] of records.entries()) {
    if (r.lockedAt) result.push({ ip, count: r.count, lockedAt: r.lockedAt, lastAttempt: r.lastAttempt })
  }
  return result.sort((a, b) => b.lockedAt.getTime() - a.lockedAt.getTime())
}
