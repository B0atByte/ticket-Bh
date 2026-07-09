import type { Request, Response } from 'express';
import { LoginSchema, RefreshSchema, RegisterSchema } from './auth.schema.js';
import * as service from './auth.service.js';
import { audit } from '../../utils/audit.js';
import { HttpError } from '../../utils/httpError.js';
import { clearAuthCookies, setAuthCookies, REFRESH_TOKEN_COOKIE } from './cookies.js';

function sessionCtx(req: Request): { ip?: string; userAgent?: string } {
  return {
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const input = RegisterSchema.parse(req.body);
  const result = await service.register(input, sessionCtx(req));
  setAuthCookies(res, result.tokens);
  await audit({
    actorId: BigInt(result.user.id),
    action: 'auth.register',
    entityType: 'user',
    entityId: result.user.id,
    req,
  });
  res.status(201).json({ user: result.user });
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = LoginSchema.parse(req.body);
  try {
    const result = await service.login(input, sessionCtx(req));
    setAuthCookies(res, result.tokens);
    await audit({
      actorId: BigInt(result.user.id),
      action: 'auth.login',
      entityType: 'user',
      entityId: result.user.id,
      req,
    });
    res.json({ user: result.user });
  } catch (err) {
    await audit({
      action: 'auth.login.fail',
      req,
      metadata: { identifier: input.identifier },
    });
    throw err;
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken: bodyToken } = RefreshSchema.parse(req.body ?? {});
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] ?? bodyToken;
  if (!refreshToken) throw HttpError.unauthorized('Missing refresh token');
  const tokens = await service.refresh(refreshToken, sessionCtx(req));
  setAuthCookies(res, tokens);
  res.status(204).end();
}

export async function logout(req: Request, res: Response): Promise<void> {
  const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] ?? bodyToken;
  await service.logout(refreshToken);
  clearAuthCookies(res);
  if (req.auth) {
    await audit({
      actorId: BigInt(req.auth.userId),
      action: 'auth.logout',
      entityType: 'user',
      entityId: req.auth.userId,
      req,
    });
  }
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw HttpError.unauthorized();
  const user = await service.getMe(BigInt(req.auth.userId));
  res.json({ user });
}
