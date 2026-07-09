import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  userRoleFindMany: vi.fn(),
  refreshCreate: vi.fn(),
  refreshFindUnique: vi.fn(),
  refreshUpdate: vi.fn(),
  refreshUpdateMany: vi.fn(),
  txn: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    userRole: { findMany: mocks.userRoleFindMany },
    refreshToken: {
      create: mocks.refreshCreate,
      findUnique: mocks.refreshFindUnique,
      update: mocks.refreshUpdate,
      updateMany: mocks.refreshUpdateMany,
    },
    $transaction: mocks.txn,
  },
}));

vi.mock('../../config/env.js', () => ({
  env: {
    JWT_ACCESS_SECRET: 'test-secret-at-least-32-chars-long!!',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
    BCRYPT_ROUNDS: 4,
  },
}));

import { register, login, refresh, logout, getMe } from './auth.service.js';
import { hashPassword, hashRefreshToken } from './tokens.js';
import { HttpError } from '../../utils/httpError.js';

let cachedPasswordHash: string | undefined;
async function getPasswordHash(): Promise<string> {
  if (!cachedPasswordHash) cachedPasswordHash = await hashPassword('Pass@1234');
  return cachedPasswordHash;
}

const userRoleRows = [
  {
    role: {
      key: 'EMPLOYEE',
      rolePermissions: [
        { permission: { key: 'course.read' } },
        { permission: { key: 'course.read' } }, // duplicate to test dedupe
      ],
    },
  },
];

describe('auth.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  describe('register', () => {
    it('throws 409 on duplicate email', async () => {
      mocks.userFindUnique.mockResolvedValueOnce({ id: 1n });
      await expect(
        register(
          { email: 'a@b.com', password: 'Pass@1234', firstName: 'A', lastName: 'B' },
          {},
        ),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('creates user + EMPLOYEE role + tokens', async () => {
      mocks.userFindUnique.mockResolvedValueOnce(null);
      const txUser = {
        create: vi.fn().mockResolvedValueOnce({
          id: 99n,
          email: 'a@b.com',
          firstName: 'A',
          lastName: 'B',
        }),
      };
      const txRole = { findUnique: vi.fn().mockResolvedValueOnce({ id: 5n, key: 'EMPLOYEE' }) };
      const txUserRole = { create: vi.fn() };
      mocks.txn.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ user: txUser, role: txRole, userRole: txUserRole }),
      );
      mocks.userRoleFindMany.mockResolvedValueOnce(userRoleRows);
      mocks.refreshCreate.mockResolvedValueOnce({ id: 1n });
      const out = await register(
        { email: 'a@b.com', password: 'Pass@1234', firstName: 'A', lastName: 'B' },
        { ip: '127.0.0.1', userAgent: 'jest' },
      );
      expect(out.user.id).toBe('99');
      expect(out.user.roles).toEqual(['EMPLOYEE']);
      expect(out.user.perms).toContain('course.read');
      expect(typeof out.tokens.accessToken).toBe('string');
      expect(typeof out.tokens.refreshToken).toBe('string');
    });
  });

  describe('login', () => {
    it('rejects unknown user with generic message', async () => {
      mocks.userFindUnique.mockResolvedValueOnce(null);
      await expect(
        login({ identifier: 'a@b.com', password: 'x' }, {}),
      ).rejects.toMatchObject({ status: 401 });
    });

    it('rejects deleted user', async () => {
      mocks.userFindUnique.mockResolvedValueOnce({
        id: 1n,
        deletedAt: new Date(),
        status: 'ACTIVE',
      });
      await expect(
        login({ identifier: 'a@b.com', password: 'x' }, {}),
      ).rejects.toMatchObject({ status: 401 });
    });

    it('rejects non-ACTIVE account with 403', async () => {
      mocks.userFindUnique.mockResolvedValueOnce({
        id: 1n,
        deletedAt: null,
        status: 'PENDING',
        passwordHash: 'whatever',
      });
      await expect(
        login({ identifier: 'a@b.com', password: 'x' }, {}),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('rejects wrong password', async () => {
      const hash = await getPasswordHash();
      mocks.userFindUnique.mockResolvedValueOnce({
        id: 1n,
        deletedAt: null,
        status: 'ACTIVE',
        passwordHash: hash,
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
      });
      await expect(
        login({ identifier: 'a@b.com', password: 'wrong' }, {}),
      ).rejects.toMatchObject({ status: 401 });
    });

    it('issues tokens on success + updates lastLoginAt', async () => {
      const hash = await getPasswordHash();
      mocks.userFindUnique.mockResolvedValueOnce({
        id: 1n,
        deletedAt: null,
        status: 'ACTIVE',
        passwordHash: hash,
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
      });
      mocks.userUpdate.mockResolvedValueOnce({});
      mocks.userRoleFindMany.mockResolvedValueOnce(userRoleRows);
      mocks.refreshCreate.mockResolvedValueOnce({ id: 1n });
      const out = await login({ identifier: 'a@b.com', password: 'Pass@1234' }, {});
      expect(out.user.id).toBe('1');
      expect(out.tokens.accessToken).toBeTruthy();
      expect(mocks.userUpdate).toHaveBeenCalled();
    });

    it('revokes other active sessions on login (single active session)', async () => {
      const hash = await getPasswordHash();
      mocks.userFindUnique.mockResolvedValueOnce({
        id: 7n,
        deletedAt: null,
        status: 'ACTIVE',
        passwordHash: hash,
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
      });
      mocks.userUpdate.mockResolvedValueOnce({});
      mocks.refreshUpdateMany.mockResolvedValueOnce({ count: 2 });
      mocks.userRoleFindMany.mockResolvedValueOnce(userRoleRows);
      mocks.refreshCreate.mockResolvedValueOnce({ id: 1n });

      await login({ identifier: 'a@b.com', password: 'Pass@1234' }, {});

      expect(mocks.refreshUpdateMany).toHaveBeenCalledTimes(1);
      const call = mocks.refreshUpdateMany.mock.calls[0][0];
      expect(call.where).toMatchObject({ userId: 7n, revokedAt: null });
      expect(call.data.revokedAt).toBeInstanceOf(Date);
    });

    it('looks up by employeeId when identifier has no @', async () => {
      mocks.userFindUnique.mockResolvedValueOnce(null);
      await expect(login({ identifier: 'E001', password: 'x' }, {})).rejects.toBeInstanceOf(
        HttpError,
      );
      expect(mocks.userFindUnique.mock.calls[0][0].where.employeeId).toBe('E001');
    });
  });

  describe('refresh', () => {
    it('rejects unknown token', async () => {
      mocks.refreshFindUnique.mockResolvedValueOnce(null);
      await expect(refresh('whatever', {})).rejects.toMatchObject({ status: 401 });
    });

    it('rejects revoked token', async () => {
      mocks.refreshFindUnique.mockResolvedValueOnce({ revokedAt: new Date() });
      await expect(refresh('whatever', {})).rejects.toMatchObject({ status: 401 });
    });

    it('rejects expired token', async () => {
      mocks.refreshFindUnique.mockResolvedValueOnce({
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(refresh('whatever', {})).rejects.toMatchObject({ status: 401 });
    });

    it('rotates valid token', async () => {
      mocks.refreshFindUnique.mockResolvedValueOnce({
        id: 9n,
        userId: 5n,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      mocks.refreshUpdate.mockResolvedValueOnce({});
      mocks.userRoleFindMany.mockResolvedValueOnce(userRoleRows);
      mocks.refreshCreate.mockResolvedValueOnce({ id: 1n });
      const out = await refresh('plain-token', {});
      expect(out.accessToken).toBeTruthy();
      expect(mocks.refreshUpdate.mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date);
    });
  });

  describe('logout', () => {
    it('no-op when token undefined', async () => {
      await logout(undefined);
      expect(mocks.refreshUpdateMany).not.toHaveBeenCalled();
    });

    it('revokes matching token', async () => {
      mocks.refreshUpdateMany.mockResolvedValueOnce({ count: 1 });
      await logout('plain');
      expect(mocks.refreshUpdateMany.mock.calls[0][0].where.tokenHash).toBe(hashRefreshToken('plain'));
    });
  });

  describe('getMe', () => {
    it('throws 404 when missing', async () => {
      mocks.userFindUnique.mockResolvedValueOnce(null);
      await expect(getMe(1n)).rejects.toBeInstanceOf(HttpError);
    });

    it('throws 404 on deleted user', async () => {
      mocks.userFindUnique.mockResolvedValueOnce({ id: 1n, deletedAt: new Date() });
      await expect(getMe(1n)).rejects.toBeInstanceOf(HttpError);
    });

    it('returns summary', async () => {
      mocks.userFindUnique.mockResolvedValueOnce({
        id: 5n,
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        deletedAt: null,
      });
      mocks.userRoleFindMany.mockResolvedValueOnce(userRoleRows);
      const out = await getMe(5n);
      expect(out.id).toBe('5');
      expect(out.roles).toEqual(['EMPLOYEE']);
    });
  });
});

