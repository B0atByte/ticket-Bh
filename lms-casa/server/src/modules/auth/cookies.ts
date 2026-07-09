import type { CookieOptions, Response } from 'express';
import { env } from '../../config/env.js';
import { accessTokenMaxAgeMs } from './tokens.js';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

// Refresh token cookie is scoped to the auth endpoints that actually need it
// (refresh/logout/oidc-exchange all live under this path).
const REFRESH_COOKIE_PATH = '/api/v1/auth';

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; refreshExpiresAt: Date },
): void {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseOptions,
    maxAge: accessTokenMaxAgeMs(),
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseOptions,
    path: REFRESH_COOKIE_PATH,
    expires: tokens.refreshExpiresAt,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...baseOptions, path: REFRESH_COOKIE_PATH });
}
