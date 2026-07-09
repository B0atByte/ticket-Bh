import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'
import { loginSchema, registerSchema } from '../schemas/index.js'
import { authenticate, authorize } from '../middleware/auth.js'
import type { Role } from '@prisma/client'

const DUMMY_HASH = '$2b$12$LnuGTHOXvZHiUhX1eSGvROqy7XfhXJvOUGVVF4kDR8LOIxGXcFqNm'
const ACCESS_TOKEN_TTL = 15 * 60
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

function signAccessToken(payload: { sub: string; email: string; role: Role; name: string }) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_TTL })
}

async function createRefreshToken(userId: string) {
  const token = crypto.randomBytes(64).toString('hex')
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } })
  return token
}

const router = new Hono()

router.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = loginSchema.safeParse(body)
  if (!result.success) {
    throw new HTTPException(400, { message: result.error.errors[0].message })
  }

  const { email, password } = result.data
  const user = await prisma.user.findUnique({ where: { email } })

  const hashToCompare = user?.password ?? DUMMY_HASH
  const valid = await bcrypt.compare(password, hashToCompare)

  if (!user || !valid) {
    throw new HTTPException(401, { message: 'Invalid email or password' })
  }

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  })
  const refreshToken = await createRefreshToken(user.id)

  return c.json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, branchId: user.branchId },
  })
})

router.post('/register', authenticate, authorize('ADMIN'), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = registerSchema.safeParse(body)
  if (!result.success) {
    throw new HTTPException(400, { message: result.error.errors[0].message })
  }

  const { email, password, name, role, branchId } = result.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new HTTPException(409, { message: 'Email already in use' })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name, role, branchId },
    select: { id: true, email: true, name: true, role: true, branchId: true, createdAt: true },
  })

  return c.json(user, 201)
})

router.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { refreshToken } = body as { refreshToken?: string }

  if (!refreshToken) {
    throw new HTTPException(400, { message: 'Refresh token required' })
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  })

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } })
    throw new HTTPException(401, { message: 'Invalid or expired refresh token' })
  }

  await prisma.refreshToken.delete({ where: { id: stored.id } })

  const { user } = stored
  const newAccessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  })
  const newRefreshToken = await createRefreshToken(user.id)

  return c.json({ accessToken: newAccessToken, refreshToken: newRefreshToken })
})

router.post('/logout', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { refreshToken } = body as { refreshToken?: string }

  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
  }

  return c.json({ message: 'Logged out' })
})

router.get('/me', authenticate, async (c) => {
  const user = c.get('user')
  const dbUser = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { id: true, email: true, name: true, role: true, branchId: true },
  })
  if (!dbUser) throw new HTTPException(404, { message: 'User not found' })
  return c.json(dbUser)
})

export default router
