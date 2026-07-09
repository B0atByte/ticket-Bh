import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deptCount: vi.fn(),
  userCount: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    department: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
      count: mocks.deptCount,
    },
    user: { count: mocks.userCount },
  },
}));

import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from './departments.service.js';
import { HttpError } from '../../utils/httpError.js';

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('departments.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  it('listDepartments maps active user counts', async () => {
    mocks.findMany.mockResolvedValueOnce([
      { id: 1n, name: 'IT', code: 'IT', parentId: null, _count: { users: 3 } },
    ]);
    const out = await listDepartments();
    expect(out[0]).toMatchObject({ id: 1n, name: 'IT', userCount: 3 });
  });

  it('createDepartment maps duplicate code to 409', async () => {
    mocks.create.mockRejectedValueOnce(p2002());
    await expect(createDepartment({ name: 'IT', code: 'IT' })).rejects.toMatchObject({ status: 409 });
  });

  it('createDepartment rejects a missing parent with 400', async () => {
    mocks.findFirst.mockResolvedValueOnce(null); // parent lookup
    await expect(createDepartment({ name: 'Sub', parentId: 99n })).rejects.toMatchObject({ status: 400 });
  });

  it('updateDepartment rejects setting itself as parent (400)', async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: 5n }); // target exists
    await expect(updateDepartment(5n, { parentId: 5n })).rejects.toMatchObject({ status: 400 });
  });

  it('deleteDepartment blocks when active users are assigned (409)', async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: 2n }); // target exists
    mocks.userCount.mockResolvedValueOnce(4);
    await expect(deleteDepartment(2n)).rejects.toMatchObject({ status: 409 });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('deleteDepartment soft-deletes when empty', async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: 2n });
    mocks.userCount.mockResolvedValueOnce(0);
    mocks.deptCount.mockResolvedValueOnce(0); // no children
    mocks.update.mockResolvedValueOnce({});
    await deleteDepartment(2n);
    expect(mocks.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });

  it('throws 404 when deleting a missing department', async () => {
    mocks.findFirst.mockResolvedValueOnce(null);
    await expect(deleteDepartment(7n)).rejects.toBeInstanceOf(HttpError);
  });
});
