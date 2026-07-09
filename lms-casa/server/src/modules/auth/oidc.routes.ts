/**
 * OIDC SSO routes — Phase 6
 *
 * GET  /api/v1/auth/oidc/authorize  → redirect to IdP
 * GET  /api/v1/auth/oidc/callback   → exchange code, issue JWT, redirect to frontend
 */

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  consumeExchangeCode,
  createExchangeCode,
  getAuthorizationUrl,
  handleCallback,
  isOidcConfigured,
} from './oidc.service.js';
import { env } from '../../config/env.js';
import { audit } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { HttpError } from '../../utils/httpError.js';
import { setAuthCookies } from './cookies.js';

const router = Router();

/**
 * Public status endpoint for the login page.
 * GET /api/v1/auth/oidc/status
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({ enabled: isOidcConfigured() });
});

/**
 * Step 1 — Redirect user to IdP authorization endpoint.
 * GET /api/v1/auth/oidc/authorize
 */
router.get(
  '/authorize',
  asyncHandler(async (_req: Request, res: Response) => {
    const url = await getAuthorizationUrl();
    res.redirect(url);
  }),
);

/**
 * Step 2 — IdP redirects back here with ?code=...&state=...
 * GET /api/v1/auth/oidc/callback
 *
 * On success: redirect to frontend with a short-lived, one-time exchange code.
 * The frontend SPA immediately exchanges it via POST /oidc/exchange for the real
 * session tokens, so the tokens themselves never appear in the URL
 * (avoids leaking them via browser history, server logs, or the Referer header).
 */
router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as Record<string, string>;

    // IdP error response (e.g. user denied consent)
    if (params['error']) {
      logger.warn(`OIDC callback error: ${params['error']} — ${params['error_description'] ?? ''}`);
      const errorUrl = new URL('/login', env.APP_URL);
      errorUrl.searchParams.set('sso_error', params['error_description'] ?? params['error'] ?? 'sso_failed');
      res.redirect(errorUrl.toString());
      return;
    }

    const ctx = {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    };

    const tokens = await handleCallback(params, ctx);

    // Audit log (best-effort — no userId available here without decoding JWT)
    await audit({ action: 'auth.oidc.login', req }).catch(() => {/* non-blocking */});

    // Redirect to frontend SPA with a one-time exchange code
    const code = await createExchangeCode(tokens);
    const redirectUrl = new URL('/auth/oidc/complete', env.APP_URL);
    redirectUrl.searchParams.set('code', code);

    res.redirect(redirectUrl.toString());
  }),
);

/**
 * Step 3 — frontend exchanges the one-time code for session tokens.
 * POST /api/v1/auth/oidc/exchange
 */
router.post(
  '/exchange',
  asyncHandler(async (req: Request, res: Response) => {
    const code = req.body?.code;
    if (typeof code !== 'string' || !code) throw HttpError.badRequest('Missing code');

    const tokens = await consumeExchangeCode(code);
    if (!tokens) throw HttpError.badRequest('Invalid or expired code');

    setAuthCookies(res, { ...tokens, refreshExpiresAt: new Date(tokens.refreshExpiresAt) });
    res.status(204).end();
  }),
);

export default router;
