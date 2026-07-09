import jwt from 'jsonwebtoken'
import { isBlacklisted } from './tokenBlacklist.js'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

export interface JwtPayload {
  id: string
  role: string
  name: string
  exp?: number
}

export function signToken(payload: JwtPayload, rememberMe = false) {
  return jwt.sign(payload, SECRET, { expiresIn: rememberMe ? '30d' : '8h' })
}

export function verifyToken(token: string): JwtPayload {
  if (isBlacklisted(token)) throw new Error('Token has been revoked')
  return jwt.verify(token, SECRET) as JwtPayload
}
