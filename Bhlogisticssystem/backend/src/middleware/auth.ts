import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'

export interface JWTPayload {
  sub: string
  email: string
  role: Role
  name: string
}

type Variables = {
  user: JWTPayload
}

export const authenticate = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    const authorization = c.req.header('Authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Missing or invalid authorization header' })
    }

    const token = authorization.slice(7)
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
      c.set('user', payload)
      await next()
    } catch {
      throw new HTTPException(401, { message: 'Invalid or expired token' })
    }
  }
)

export const authorize = (...roles: Role[]) =>
  createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.get('user')
    if (!roles.includes(user.role)) {
      throw new HTTPException(403, { message: 'Insufficient permissions' })
    }
    await next()
  })

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export const authRateLimit = createMiddleware(async (c, next) => {
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'
  const now = Date.now()
  const windowMs = 15 * 60 * 1000
  const maxRequests = 10

  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    await next()
    return
  }

  if (entry.count >= maxRequests) {
    throw new HTTPException(429, { message: 'Too many requests, please try again later' })
  }

  entry.count++
  await next()
})
