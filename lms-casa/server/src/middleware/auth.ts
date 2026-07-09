import type { RequestHandler, Request } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { verifyAccessToken, type AccessTokenPayload } from '../modules/auth/tokens.js';
import { ACCESS_TOKEN_COOKIE } from '../modules/auth/cookies.js';
import { HttpError } from '../utils/httpError.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: {
      userId: string;
      roles: string[];
      perms: string[];
    };
  }
}

function extractToken(req: Request): string | null {
  const header = req.header('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE];
  return typeof cookieToken === 'string' && cookieToken ? cookieToken : null;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    next(HttpError.unauthorized('Missing access token'));
    return;
  }

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      next(HttpError.unauthorized('Access token expired'));
      return;
    }
    if (err instanceof JsonWebTokenError) {
      next(HttpError.unauthorized('Invalid access token'));
      return;
    }
    next(err);
    return;
  }

  // Single active session: the access token is bound to a refresh-token session (sid).
  // If that session was revoked (login from another device, logout, admin force-logout)
  // the token is dead on the very next request — not only when it expires.
  let sessionId: bigint;
  try {
    sessionId = BigInt(payload.sid);
  } catch {
    next(HttpError.unauthorized('Invalid session'));
    return;
  }

  try {
    const session = await prisma.refreshToken.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, expiresAt: true },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      next(HttpError.unauthorized('Session ended'));
      return;
    }
  } catch (err) {
    next(err);
    return;
  }

  req.auth = { userId: payload.sub, roles: payload.roles, perms: payload.perms };
  next();
};

export const requireRole =
  (...allowed: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) {
      next(HttpError.unauthorized());
      return;
    }
    const has = req.auth.roles.some((r) => allowed.includes(r));
    if (!has) {
      next(HttpError.forbidden('Role not allowed'));
      return;
    }
    next();
  };

export const requirePermission =
  (...required: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) {
      next(HttpError.unauthorized());
      return;
    }
    const has = required.every((p) => req.auth!.perms.includes(p));
    if (!has) {
      next(HttpError.forbidden('Permission denied'));
      return;
    }
    next();
  };
