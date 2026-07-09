import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const allowedOrigins = env.CORS_ORIGIN.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * CSRF defense for cookie-authenticated, state-changing requests.
 *
 * Browsers ALWAYS attach an `Origin` header on cross-site POST/PUT/PATCH/DELETE,
 * so a forged request from evil.com (carrying the victim's SameSite=Lax cookie)
 * is rejected here. Requests with no Origin/Referer (curl, server-to-server,
 * health checks) carry no ambient victim cookies and are therefore not a CSRF
 * vector — they are allowed so non-browser API clients keep working.
 *
 * This complements (does not replace) the SameSite=Lax cookie attribute.
 */
export const csrfOriginGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.header('origin');
  if (origin) {
    if (!allowedOrigins.includes(origin)) {
      next(HttpError.forbidden('Cross-origin request blocked'));
      return;
    }
    next();
    return;
  }

  // No Origin: fall back to Referer when present (older browsers / some flows).
  const referer = req.header('referer');
  if (referer && !allowedOrigins.some((o) => referer.startsWith(o))) {
    next(HttpError.forbidden('Cross-origin request blocked'));
    return;
  }

  next();
};
