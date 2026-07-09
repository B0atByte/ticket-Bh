import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  userFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  userCount: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  roleFindMany: vi.fn(),
  userRoleCreateMany: vi.fn(),
  userRoleDeleteMany: vi.fn(),
  refreshUpdateMany: vi.fn(),
  txn: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    user: {
      findMany: mocks.userFindMany,
      findFirst: mocks.userFindFirst,
      findUnique: mocks.userFindUnique,
      count: mocks.userCount,
      create: mocks.userCreate,
      update: mocks.userUpdate,
    },
    role: { findMany: mocks.roleFindMany },
    userRole: {
      createMany: mocks.userRoleCreateMany,
      deleteMany: mocks.userRoleDeleteMany,
    },
    refreshToken: { updateMany: mocks.refreshUpdateMany },
    $transaction: mocks.txn,
  },
}));

vi.mock('../auth/tokens.js', () => ({
  hashPassword: mocks.hashPassword,
}));

import {
  list,
  getById,
  getUserRecord,
  create,
  update,
  softDelete,
  changePassword,
} from './users.service.js';
import { HttpError } from '../../utils/httpError.js';

const baseUser = {
  id: 1n,
  email: 'a@b.com',
  firstName: 'A',
  lastName: 'B',
  userRoles: [{ role: { key: 'EMPLOYEE' } }],
};

// Actors for privilege-ceiling checks (see roleHierarchy.ts).
const adminActor = { id: 99n, roles: ['ADMIN'] };
const superActor = { id: 100n, roles: ['SUPER_ADMIN'] };
const managerActor = { id: 5n, roles: ['MANAGER'] };

describe('users.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
    mocks.hashPassword.mockResolvedValue('hash');
  });

  it('list applies all filters and shapes roles', async () => {
    mocks.userFindMany.mockResolvedValueOnce([baseUser]);
    mocks.userCount.mockResolvedValueOnce(1);
    const out = await list({
      page: 1,
      pageSize: 20,
      status: 'ACTIVE',
      departmentId: 3n,
      role: 'ADMIN',
      q: 'a',
    }, adminActor);
    expect(out.items[0].roles).toEqual(['EMPLOYEE']);
    const where = mocks.userFindMany.mock.calls[0][0].where;
    expect(where.status).toBe('ACTIVE');
    expect(where.departmentId).toBe(3n);
    expect(where.userRoles).toBeDefined();
    expect(where.OR).toBeDefined();
  });

  it('getById throws 404 when missing', async () => {
    mocks.userFindFirst.mockResolvedValueOnce(null);
    await expect(getById(1n, adminActor)).rejects.toBeInstanceOf(HttpError);
  });

  it('getById shapes roles', async () => {
    mocks.userFindFirst.mockResolvedValueOnce(baseUser);
    const out = await getById(1n, adminActor);
    expect(out.roles).toEqual(['EMPLOYEE']);
  });

  it('create throws 409 on duplicate email', async () => {
    mocks.userFindUnique.mockResolvedValueOnce({ id: 9n });
    await expect(
      create({
        email: 'a@b.com',
        password: 'Pass@1234',
        firstName: 'A',
        lastName: 'B',
      }, adminActor),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('create defaults to EMPLOYEE role + ACTIVE status', async () => {
    mocks.userFindUnique.mockResolvedValueOnce(null);
    const txCreate = vi.fn().mockResolvedValueOnce({ id: 99n });
    const txRoleFindMany = vi.fn().mockResolvedValueOnce([{ id: 1n, key: 'EMPLOYEE' }]);
    const txUserRoleCreate = vi.fn();
    mocks.txn.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        user: { create: txCreate },
        role: { findMany: txRoleFindMany },
        userRole: { createMany: txUserRoleCreate },
      }),
    );
    mocks.userFindFirst.mockResolvedValueOnce(baseUser);
    await create({
      email: 'new@x.com',
      password: 'Pass@1234',
      firstName: 'A',
      lastName: 'B',
    }, adminActor);
    expect(mocks.hashPassword).toHaveBeenCalledWith('Pass@1234');
    expect(txCreate.mock.calls[0][0].data.status).toBe('ACTIVE');
    expect(txRoleFindMany.mock.calls[0][0].where.key.in).toEqual(['EMPLOYEE']);
  });

  it('create throws 400 when no roles found', async () => {
    mocks.userFindUnique.mockResolvedValueOnce(null);
    mocks.txn.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        user: { create: vi.fn().mockResolvedValueOnce({ id: 99n }) },
        role: { findMany: vi.fn().mockResolvedValueOnce([]) },
        userRole: { createMany: vi.fn() },
      }),
    );
    await expect(
      create({
        email: 'n@x.com',
        password: 'Pass@1234',
        firstName: 'A',
        lastName: 'B',
        roleKeys: ['NOPE'],
      }, adminActor),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('update throws 404 when missing', async () => {
    mocks.userFindFirst.mockResolvedValueOnce(null);
    await expect(update(1n, { firstName: 'X' }, adminActor)).rejects.toBeInstanceOf(HttpError);
  });

  it('update throws 409 on email collision with different user', async () => {
    mocks.userFindFirst.mockResolvedValueOnce({
      id: 1n,
      email: 'a@b.com',
      userRoles: [{ role: { key: 'EMPLOYEE' } }],
    });
    mocks.userFindUnique.mockResolvedValueOnce({ id: 9n });
    await expect(update(1n, { email: 'taken@x.com' }, adminActor)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('update replaces roles when roleKeys provided', async () => {
    mocks.userFindFirst.mockResolvedValueOnce({
      id: 1n,
      email: 'a@b.com',
      userRoles: [{ role: { key: 'EMPLOYEE' } }],
    });
    const userUpdate = vi.fn();
    const roleFindMany = vi.fn().mockResolvedValueOnce([{ id: 2n, key: 'ADMIN' }]);
    const userRoleDelete = vi.fn();
    const userRoleCreate = vi.fn();
    mocks.txn.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        user: { update: userUpdate },
        role: { findMany: roleFindMany },
        userRole: { deleteMany: userRoleDelete, createMany: userRoleCreate },
      }),
    );
    mocks.userFindFirst.mockResolvedValueOnce(baseUser);
    // SUPER_ADMIN required to grant ADMIN (ADMIN cannot mint an equal-rank role).
    await update(1n, { roleKeys: ['ADMIN'] }, superActor);
    expect(userRoleDelete).toHaveBeenCalled();
    expect(userRoleCreate).toHaveBeenCalled();
  });

  it('softDelete rejects self-delete', async () => {
    await expect(softDelete(5n, { id: 5n, roles: ['ADMIN'] })).rejects.toBeInstanceOf(HttpError);
  });

  it('softDelete throws 404 when missing', async () => {
    mocks.userFindFirst.mockResolvedValueOnce(null);
    await expect(softDelete(1n, adminActor)).rejects.toBeInstanceOf(HttpError);
  });

  it('softDelete sets deletedAt + DISABLED', async () => {
    mocks.userFindFirst.mockResolvedValueOnce(baseUser);
    mocks.userUpdate.mockResolvedValueOnce({});
    await softDelete(1n, adminActor);
    expect(mocks.userUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(mocks.userUpdate.mock.calls[0][0].data.status).toBe('DISABLED');
  });

  it('changePassword throws 404 when missing', async () => {
    mocks.userFindFirst.mockResolvedValueOnce(null);
    await expect(changePassword(1n, 'New@1234', adminActor)).rejects.toBeInstanceOf(HttpError);
  });

  it('changePassword updates hash + revokes refresh tokens', async () => {
    mocks.userFindFirst.mockResolvedValueOnce(baseUser);
    mocks.userUpdate.mockReturnValueOnce('p1');
    mocks.refreshUpdateMany.mockReturnValueOnce('p2');
    mocks.txn.mockResolvedValueOnce([{}, { count: 2 }]);
    await changePassword(1n, 'Whatever@1234', adminActor);
    expect(mocks.hashPassword).toHaveBeenCalledWith('Whatever@1234');
    expect(mocks.txn).toHaveBeenCalled();
  });

  // === Privilege-ceiling regression tests (Issues #1 & #2) ===

  it('update: HR cannot escalate a user to SUPER_ADMIN (Issue #1)', async () => {
    mocks.userFindFirst.mockResolvedValueOnce(baseUser);
    await expect(
      update(1n, { roleKeys: ['SUPER_ADMIN'] }, { id: 4n, roles: ['HR'] }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('changePassword: HR cannot reset a SUPER_ADMIN password (Issue #2)', async () => {
    mocks.userFindFirst.mockResolvedValueOnce({
      id: 1n,
      email: 'admin@x.com',
      userRoles: [{ role: { key: 'SUPER_ADMIN' } }],
    });
    await expect(
      changePassword(1n, 'Pwned@12345', { id: 4n, roles: ['HR'] }),
    ).rejects.toMatchObject({ status: 403 });
  });

  // === Manager scoping regression tests (Issue #7) ===

  it('list scopes a MANAGER to direct reports; ADMIN is unscoped', async () => {
    mocks.userFindMany.mockResolvedValue([]);
    mocks.userCount.mockResolvedValue(0);
    await list({ page: 1, pageSize: 20 }, managerActor);
    expect(mocks.userFindMany.mock.calls[0][0].where.managerId).toBe(5n);

    mocks.userFindMany.mockClear();
    await list({ page: 1, pageSize: 20 }, adminActor);
    expect(mocks.userFindMany.mock.calls[0][0].where.managerId).toBeUndefined();
  });

  it('getById: MANAGER cannot read a non-report (403), can read own report', async () => {
    mocks.userFindFirst.mockResolvedValueOnce({ ...baseUser, managerId: 999n });
    await expect(getById(1n, managerActor)).rejects.toMatchObject({ status: 403 });

    mocks.userFindFirst.mockResolvedValueOnce({ ...baseUser, managerId: 5n });
    const out = await getById(1n, managerActor);
    expect(out.roles).toEqual(['EMPLOYEE']);
  });

  it('getUserRecord: MANAGER cannot read a non-report (403)', async () => {
    mocks.userFindFirst.mockResolvedValueOnce({
      ...baseUser,
      managerId: 999n,
      department: null,
    });
    await expect(getUserRecord(1n, managerActor)).rejects.toMatchObject({ status: 403 });
  });
});
