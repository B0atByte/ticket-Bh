import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';

export interface AccessTokenPayload {
  sub: string;      // user id (string-encoded BigInt)
  roles: string[];  // role keys
  perms: string[];  // permission keys
  sid: string;      // session id = active refresh-token id (single-session enforcement)
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const opts: SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
    issuer: 'lms-casa',
    audience: 'lms-casa-client',
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, opts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'lms-casa',
    audience: 'lms-casa-client',
  }) as AccessTokenPayload;
}

// Refresh token = random opaque string. Store SHA-256 hash in DB.
export function generateRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Support "7d", "12h", "30m", "45s"
export function parseTtlMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}`);
  }
  const n = Number(match[1]);
  const unit = match[2];
  const seconds =
    unit === 's' ? n :
    unit === 'm' ? n * 60 :
    unit === 'h' ? n * 3600 :
    /* d */         n * 86400;
  return seconds * 1000;
}

export function refreshExpiry(): Date {
  return new Date(Date.now() + parseTtlMs(env.JWT_REFRESH_TTL));
}

export function accessTokenMaxAgeMs(): number {
  return parseTtlMs(env.JWT_ACCESS_TTL);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
