import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  courseFindFirst: vi.fn(),
  moduleFindMany: vi.fn(),
  moduleAggregate: vi.fn(),
  moduleCreate: vi.fn(),
  moduleFindFirst: vi.fn(),
  moduleUpdate: vi.fn(),
  txn: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    course: { findFirst: mocks.courseFindFirst },
    module: {
      findMany: mocks.moduleFindMany,
      aggregate: mocks.moduleAggregate,
      create: mocks.moduleCreate,
      findFirst: mocks.moduleFindFirst,
      update: mocks.moduleUpdate,
    },
    $transaction: mocks.txn,
  },
}));

import { listByCourse, create, update, softDelete, reorder } from './course-modules.service.js';
import { HttpError } from '../../utils/httpError.js';

describe('course-modules.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  it('listByCourse throws 404 when course missing', async () => {
    mocks.courseFindFirst.mockResolvedValueOnce(null);
    await expect(listByCourse(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('listByCourse returns ordered modules', async () => {
    mocks.courseFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.moduleFindMany.mockResolvedValueOnce([{ id: 10n }, { id: 11n }]);
    const out = await listByCourse(1n);
    expect(out).toHaveLength(2);
    expect(mocks.moduleFindMany.mock.calls[0][0].orderBy.orderIndex).toBe('asc');
  });

  it('create assigns next orderIndex', async () => {
    mocks.courseFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.moduleAggregate.mockResolvedValueOnce({ _max: { orderIndex: 4 } });
    mocks.moduleCreate.mockResolvedValueOnce({ id: 99n, orderIndex: 5 });
    const out = await create(1n, { title: 'M' });
    expect(out.orderIndex).toBe(5);
    expect(mocks.moduleCreate.mock.calls[0][0].data.orderIndex).toBe(5);
  });

  it('create starts at orderIndex 0 when no existing modules', async () => {
    mocks.courseFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.moduleAggregate.mockResolvedValueOnce({ _max: { orderIndex: null } });
    mocks.moduleCreate.mockResolvedValueOnce({ id: 1n });
    await create(1n, { title: 'first' });
    expect(mocks.moduleCreate.mock.calls[0][0].data.orderIndex).toBe(0);
  });

  it('update throws 404 when missing', async () => {
    mocks.moduleFindFirst.mockResolvedValueOnce(null);
    await expect(update(1n, { title: 'x' })).rejects.toBeInstanceOf(HttpError);
  });

  it('update saves data', async () => {
    mocks.moduleFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.moduleUpdate.mockResolvedValueOnce({ id: 1n, title: 'x' });
    await update(1n, { title: 'x' });
    expect(mocks.moduleUpdate).toHaveBeenCalled();
  });

  it('softDelete throws 404 when missing', async () => {
    mocks.moduleFindFirst.mockResolvedValueOnce(null);
    await expect(softDelete(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('softDelete sets deletedAt', async () => {
    mocks.moduleFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.moduleUpdate.mockResolvedValueOnce({});
    await softDelete(1n);
    expect(mocks.moduleUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });

  it('reorder validates id count matches', async () => {
    mocks.courseFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.moduleFindMany.mockResolvedValueOnce([{ id: 1n }, { id: 2n }, { id: 3n }]);
    await expect(reorder(1n, [1n, 2n])).rejects.toBeInstanceOf(HttpError);
  });

  it('reorder rejects ids that do not belong to course', async () => {
    mocks.courseFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.moduleFindMany.mockResolvedValueOnce([{ id: 1n }, { id: 2n }]);
    await expect(reorder(1n, [1n, 99n])).rejects.toBeInstanceOf(HttpError);
  });

  it('reorder runs transaction with updated orderIndex', async () => {
    mocks.courseFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.moduleFindMany.mockResolvedValueOnce([{ id: 1n }, { id: 2n }, { id: 3n }]);
    mocks.txn.mockResolvedValueOnce([]);
    mocks.moduleUpdate.mockReturnValue('PROMISE_STUB');
    await reorder(1n, [3n, 1n, 2n]);
    expect(mocks.txn).toHaveBeenCalledTimes(1);
  });
});
