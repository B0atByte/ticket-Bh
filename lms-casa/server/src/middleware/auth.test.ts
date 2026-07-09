import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/env.js', () => ({
  env: {
    JWT_ACCESS_SECRET: 'test-secret-at-least-32-chars-long!!',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
    BCRYPT_ROUNDS: 10,
  },
}));

const dbMocks = vi.hoisted(() => ({ refreshFindUnique: vi.fn() }));
vi.mock('../config/db.js', () => ({
  prisma: { refreshToken: { findUnique: dbMocks.refreshFindUnique } },
}));

function activeSession() {
  return { revokedAt: null, expiresAt: new Date(Date.now() + 1_000_000) };
}

import { requireAuth, requireRole, requirePermission } from './auth.js';
import { signAccessToken } from '../modules/auth/tokens.js';
import { HttpError } from '../utils/httpError.js';

function mockReq(token?: string, auth?: { userId: string; roles: string[]; perms: string[] }) {
  return {
    header: (name: string) =>
      name.toLowerCase() === 'authorization' && token ? `Bearer ${token}` : undefined,
    auth,
  };
}

describe('requireAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes when Authorization is missing → next(401)', async () => {
    const next = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await requireAuth(mockReq() as any, {} as any, next);
    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
  });

  it('attaches req.auth on valid token with an active session', async () => {
    dbMocks.refreshFindUnique.mockResolvedValueOnce(activeSession());
    const next = vi.fn();
    const token = signAccessToken({ sub: '1', roles: ['EMPLOYEE'], perms: ['course.read'], sid: '5' });
    const req = mockReq(token);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await requireAuth(req as any, {} as any, next);
    expect(next).toHaveBeenCalledWith();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((req as any).auth).toEqual({ userId: '1', roles: ['EMPLOYEE'], perms: ['course.read'] });
  });

  it('next(401) when the session was revoked (single active session)', async () => {
    dbMocks.refreshFindUnique.mockResolvedValueOnce({ revokedAt: new Date(), expiresAt: new Date(Date.now() + 1_000_000) });
    const next = vi.fn();
    const token = signAccessToken({ sub: '1', roles: [], perms: [], sid: '5' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await requireAuth(mockReq(token) as any, {} as any, next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  it('next(401) when the session no longer exists', async () => {
    dbMocks.refreshFindUnique.mockResolvedValueOnce(null);
    const next = vi.fn();
    const token = signAccessToken({ sub: '1', roles: [], perms: [], sid: '5' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await requireAuth(mockReq(token) as any, {} as any, next);
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  it('next(401) on invalid token', async () => {
    const next = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await requireAuth(mockReq('not.a.jwt') as any, {} as any, next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
    expect(next.mock.calls[0][0].status).toBe(401);
  });
});

describe('requireRole', () => {
  it('next() when role matches', () => {
    const next = vi.fn();
    requireRole('ADMIN')(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockReq(undefined, { userId: '1', roles: ['ADMIN'], perms: [] }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('next(401) when no auth', () => {
    const next = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requireRole('ADMIN')(mockReq() as any, {} as any, next);
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  it('next(403) when role not allowed', () => {
    const next = vi.fn();
    requireRole('ADMIN')(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockReq(undefined, { userId: '1', roles: ['EMPLOYEE'], perms: [] }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      next,
    );
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  it('accepts any of multiple allowed roles', () => {
    const next = vi.fn();
    requireRole('ADMIN', 'HR')(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockReq(undefined, { userId: '1', roles: ['HR'], perms: [] }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requirePermission', () => {
  it('next() when all perms present', () => {
    const next = vi.fn();
    requirePermission('user.update', 'audit.read')(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockReq(undefined, { userId: '1', roles: [], perms: ['user.update', 'audit.read'] }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('next(401) when no auth', () => {
    const next = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requirePermission('x')(mockReq() as any, {} as any, next);
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  it('next(403) when missing any required perm', () => {
    const next = vi.fn();
    requirePermission('user.update', 'audit.read')(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockReq(undefined, { userId: '1', roles: [], perms: ['user.update'] }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      next,
    );
    expect(next.mock.calls[0][0].status).toBe(403);
  });
});
