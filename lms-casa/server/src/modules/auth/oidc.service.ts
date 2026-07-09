/**
 * OIDC SSO service — Phase 6
 *
 * Flow:
 *   1. GET /api/v1/auth/oidc/authorize  → redirect to IdP
 *   2. IdP redirects back to GET /api/v1/auth/oidc/callback?code=...&state=...
 *   3. Exchange code → id_token → extract email
 *   4. Find or provision user in DB → issue JWT (same as normal login)
 *
 * Supports any OIDC-compliant IdP: Azure AD, Google Workspace, Keycloak, Okta, etc.
 * Configure via env: OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI
 */

import { Issuer, generators, type Client } from 'openid-client';
import { prisma } from '../../config/db.js';
import { redis } from '../../config/redis.js';
import { HttpError } from '../../utils/httpError.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import { issueTokensForUser } from './auth.service.js';

// ─── OIDC client (lazy-initialized) ──────────────────────────────────────────

let _client: Client | null = null;

export function isOidcConfigured(): boolean {
  return Boolean(env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET);
}

async function getClient(): Promise<Client> {
  if (_client) return _client;

  if (!isOidcConfigured()) {
    throw HttpError.internal('OIDC is not configured. Set OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET in env.');
  }

  const issuer = await Issuer.discover(env.OIDC_ISSUER);
  _client = new issuer.Client({
    client_id: env.OIDC_CLIENT_ID,
    client_secret: env.OIDC_CLIENT_SECRET,
    redirect_uris: [env.OIDC_REDIRECT_URI],
    response_types: ['code'],
  });

  logger.info(`OIDC client initialized for issuer: ${issuer.metadata.issuer}`);
  return _client;
}

// ─── state + exchange-code stores (Redis-backed — safe across instances) ─────

const STATE_TTL_SEC = 10 * 60; // 10 minutes
const EXCHANGE_TTL_SEC = 60; // 1 minute — frontend exchanges this immediately after redirect

const stateKey = (state: string) => `oidc:state:${state}`;
const exchangeKey = (code: string) => `oidc:exchange:${code}`;

// ─── service functions ────────────────────────────────────────────────────────

/**
 * Generate authorization URL to redirect the user to the IdP.
 */
export async function getAuthorizationUrl(): Promise<string> {
  const client = await getClient();
  const state = generators.state();
  const nonce = generators.nonce();

  await redis.set(stateKey(state), JSON.stringify({ nonce }), 'EX', STATE_TTL_SEC);

  return client.authorizationUrl({
    scope: 'openid email profile',
    state,
    nonce,
  });
}

/**
 * Handle the IdP callback: exchange code, validate tokens, find/provision user, issue JWT.
 */
export async function handleCallback(
  params: Record<string, string>,
  ctx: { ip?: string; userAgent?: string },
): Promise<{ accessToken: string; refreshToken: string; refreshExpiresAt: Date }> {
  const client = await getClient();

  const state = params['state'];
  if (!state) throw HttpError.badRequest('Missing state parameter');

  const storedRaw = await redis.get(stateKey(state));
  if (!storedRaw) throw HttpError.badRequest('Invalid or expired OIDC state');
  await redis.del(stateKey(state)); // one-time use
  const stored = JSON.parse(storedRaw) as { nonce: string };

  // Exchange authorization code for tokens
  const callbackParams = client.callbackParams(
    `${env.OIDC_REDIRECT_URI}?${new URLSearchParams(params).toString()}`,
  );

  const tokenSet = await client.callback(env.OIDC_REDIRECT_URI, callbackParams, {
    state,
    nonce: stored.nonce,
  });

  const claims = tokenSet.claims();
  const email = claims.email as string | undefined;

  if (!email) {
    throw HttpError.badRequest('IdP did not return an email claim. Ensure the "email" scope is granted.');
  }

  // Find or provision user
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    if (!env.OIDC_AUTO_PROVISION) {
      throw HttpError.forbidden(
        `No account found for ${email}. Contact your administrator to create an account first.`,
      );
    }

    // Auto-provision: create user with EMPLOYEE role
    const firstName = (claims.given_name as string | undefined) ?? email.split('@')[0] ?? 'User';
    const lastName = (claims.family_name as string | undefined) ?? '';

    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash: '', // no password for SSO-only users
          firstName,
          lastName,
        },
      });
      const employeeRole = await tx.role.findUnique({ where: { key: 'EMPLOYEE' } });
      if (employeeRole) {
        await tx.userRole.create({ data: { userId: created.id, roleId: employeeRole.id } });
      }
      return created;
    });

    logger.info(`OIDC: auto-provisioned user ${email} (id=${user.id})`);
  }

  if (user.deletedAt) throw HttpError.forbidden('Account has been deleted');
  if (user.status !== 'ACTIVE') throw HttpError.forbidden(`Account is ${user.status.toLowerCase()}`);

  // Update last login
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return issueTokensForUser(user.id, ctx);
}

/**
 * Stash session tokens behind a short-lived, one-time code so they never travel
 * in the OIDC redirect URL (avoids leaking them via browser history/referrer/logs).
 * The frontend immediately exchanges this code via POST /oidc/exchange.
 */
export async function createExchangeCode(tokens: {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}): Promise<string> {
  const code = generators.random();
  await redis.set(
    exchangeKey(code),
    JSON.stringify({ ...tokens, refreshExpiresAt: tokens.refreshExpiresAt.toISOString() }),
    'EX',
    EXCHANGE_TTL_SEC,
  );
  return code;
}

/**
 * Consume a one-time exchange code. Returns null if missing/expired/already used.
 */
export async function consumeExchangeCode(
  code: string,
): Promise<{ accessToken: string; refreshToken: string; refreshExpiresAt: string } | null> {
  const key = exchangeKey(code);
  const raw = await redis.get(key);
  if (!raw) return null;
  await redis.del(key);
  return JSON.parse(raw) as { accessToken: string; refreshToken: string; refreshExpiresAt: string };
}
