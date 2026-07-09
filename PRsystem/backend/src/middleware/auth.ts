import { createMiddleware } from 'hono/factory'
import { verifyToken, type JwtPayload } from '../lib/jwt.js'

declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  try {
    const payload = verifyToken(auth.slice(7))
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'Token invalid or expired' }, 401)
  }
})

export const requireRole = (...roles: string[]) =>
  createMiddleware(async (c, next) => {
    const user = c.get('user')
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  })
