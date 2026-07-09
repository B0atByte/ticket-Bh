// In-memory token blacklist สำหรับ logout
// เมื่อ restart server blacklist จะหาย แต่ token เก่าก็หมดอายุใน 8h อยู่แล้ว

interface BlacklistEntry {
  exp: number // unix timestamp ที่ token หมดอายุ
}

const blacklist = new Map<string, BlacklistEntry>()

// ล้าง token ที่หมดอายุแล้วทุก 1 ชั่วโมง (ป้องกัน memory leak)
setInterval(() => {
  const now = Math.floor(Date.now() / 1000)
  for (const [token, entry] of blacklist.entries()) {
    if (entry.exp < now) blacklist.delete(token)
  }
}, 60 * 60 * 1000)

export function addToBlacklist(token: string, exp: number) {
  blacklist.set(token, { exp })
}

export function isBlacklisted(token: string): boolean {
  return blacklist.has(token)
}
