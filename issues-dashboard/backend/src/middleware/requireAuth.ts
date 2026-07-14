import type { Context, Next } from 'hono'
import { verifyDashboardToken } from '../lib/jwt.js'

export async function requireAuth(c: Context, next: Next) {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ') || !verifyDashboardToken(auth.slice(7))) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
}
