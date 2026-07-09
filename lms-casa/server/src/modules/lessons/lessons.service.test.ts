import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  moduleFindFirst: vi.fn(),
  lessonFindFirst: vi.fn(),
  lessonFindMany: vi.fn(),
  lessonAggregate: vi.fn(),
  lessonCreate: vi.fn(),
  lessonUpdate: vi.fn(),
  contentFindFirst: vi.fn(),
  contentAggregate: vi.fn(),
  contentCreate: vi.fn(),
  contentUpdate: vi.fn(),
  txn: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    module: { findFirst: mocks.moduleFindFirst },
    lesson: {
      findFirst: mocks.lessonFindFirst,
      findMany: mocks.lessonFindMany,
      aggregate: mocks.lessonAggregate,
      create: mocks.lessonCreate,
      update: mocks.lessonUpdate,
    },
    lessonContent: {
      findFirst: mocks.contentFindFirst,
      aggregate: mocks.contentAggregate,
      create: mocks.contentCreate,
      update: mocks.contentUpdate,
    },
    $transaction: mocks.txn,
  },
}));

import {
  listByModule,
  getById,
  create,
  update,
  softDelete,
  reorder,
  addContent,
  removeContent,
} from './lessons.service.js';
import { HttpError } from '../../utils/httpError.js';

describe('lessons.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  it('listByModule throws 404 when module missing', async () => {
    mocks.moduleFindFirst.mockResolvedValueOnce(null);
    await expect(listByModule(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('listByModule returns lessons ordered', async () => {
    mocks.moduleFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.lessonFindMany.mockResolvedValueOnce([{ id: 1n }]);
    const out = await listByModule(1n);
    expect(out).toHaveLength(1);
  });

  it('getById throws 404 when missing', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce(null);
    await expect(getById(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('create assigns next orderIndex', async () => {
    mocks.moduleFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.lessonAggregate.mockResolvedValueOnce({ _max: { orderIndex: 2 } });
    mocks.lessonCreate.mockResolvedValueOnce({ id: 99n });
    await create(1n, { title: 'L' });
    expect(mocks.lessonCreate.mock.calls[0][0].data.orderIndex).toBe(3);
    expect(mocks.lessonCreate.mock.calls[0][0].data.isRequired).toBe(true);
  });

  it('create starts at 0 when no existing lessons', async () => {
    mocks.moduleFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.lessonAggregate.mockResolvedValueOnce({ _max: { orderIndex: null } });
    mocks.lessonCreate.mockResolvedValueOnce({});
    await create(1n, { title: 'L', isRequired: false });
    expect(mocks.lessonCreate.mock.calls[0][0].data.orderIndex).toBe(0);
    expect(mocks.lessonCreate.mock.calls[0][0].data.isRequired).toBe(false);
  });

  it('update throws 404 when missing', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce(null);
    await expect(update(1n, { title: 'x' })).rejects.toBeInstanceOf(HttpError);
  });

  it('update applies data', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.lessonUpdate.mockResolvedValueOnce({});
    await update(1n, { title: 'new' });
    expect(mocks.lessonUpdate).toHaveBeenCalled();
  });

  it('softDelete throws 404 when missing', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce(null);
    await expect(softDelete(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('softDelete sets deletedAt', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.lessonUpdate.mockResolvedValueOnce({});
    await softDelete(1n);
    expect(mocks.lessonUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });

  it('reorder validates id count', async () => {
    mocks.moduleFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.lessonFindMany.mockResolvedValueOnce([{ id: 1n }, { id: 2n }]);
    await expect(reorder(1n, [1n])).rejects.toBeInstanceOf(HttpError);
  });

  it('reorder rejects ids not in module', async () => {
    mocks.moduleFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.lessonFindMany.mockResolvedValueOnce([{ id: 1n }, { id: 2n }]);
    await expect(reorder(1n, [1n, 99n])).rejects.toBeInstanceOf(HttpError);
  });

  it('reorder runs transaction', async () => {
    mocks.moduleFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.lessonFindMany.mockResolvedValueOnce([{ id: 1n }, { id: 2n }]);
    mocks.txn.mockResolvedValueOnce([]);
    mocks.lessonUpdate.mockReturnValue('STUB');
    await reorder(1n, [2n, 1n]);
    expect(mocks.txn).toHaveBeenCalled();
  });

  it('addContent throws 404 when lesson missing', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce(null);
    await expect(addContent(1n, { type: 'TEXT' })).rejects.toBeInstanceOf(HttpError);
  });

  it('addContent assigns next orderIndex', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.contentAggregate.mockResolvedValueOnce({ _max: { orderIndex: 1 } });
    mocks.contentCreate.mockResolvedValueOnce({ id: 99n });
    await addContent(1n, { type: 'VIDEO', url: 'https://x' });
    expect(mocks.contentCreate.mock.calls[0][0].data.orderIndex).toBe(2);
  });

  it('removeContent throws 404 when missing', async () => {
    mocks.contentFindFirst.mockResolvedValueOnce(null);
    await expect(removeContent(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('removeContent soft-deletes', async () => {
    mocks.contentFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.contentUpdate.mockResolvedValueOnce({});
    await removeContent(1n);
    expect(mocks.contentUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });
});
