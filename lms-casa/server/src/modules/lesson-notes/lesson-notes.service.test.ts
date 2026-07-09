import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  lessonFindFirst: vi.fn(),
  noteFindMany: vi.fn(),
  noteCount: vi.fn(),
  noteCreate: vi.fn(),
  noteFindFirst: vi.fn(),
  noteUpdate: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    lesson: { findFirst: mocks.lessonFindFirst },
    lessonNote: {
      findMany: mocks.noteFindMany,
      count: mocks.noteCount,
      create: mocks.noteCreate,
      findFirst: mocks.noteFindFirst,
      update: mocks.noteUpdate,
    },
  },
}));

import { list, create, update, remove } from './lesson-notes.service.js';
import { HttpError } from '../../utils/httpError.js';

describe('lesson-notes.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  it('list applies type filter when provided', async () => {
    mocks.noteFindMany.mockResolvedValueOnce([{ id: 1n }]);
    mocks.noteCount.mockResolvedValueOnce(1);
    const out = await list(5n, 9n, { page: 1, pageSize: 10, type: 'NOTE' });
    expect(out.items).toHaveLength(1);
    expect(out.meta.total).toBe(1);
    expect(mocks.noteFindMany.mock.calls[0][0].where.type).toBe('NOTE');
  });

  it('list omits type filter when undefined', async () => {
    mocks.noteFindMany.mockResolvedValueOnce([]);
    mocks.noteCount.mockResolvedValueOnce(0);
    await list(5n, 9n, { page: 1, pageSize: 20 });
    expect(mocks.noteFindMany.mock.calls[0][0].where.type).toBeUndefined();
  });

  it('create throws 404 when lesson missing', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce(null);
    await expect(
      create(5n, 9n, { type: 'NOTE', content: 'x' }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('create returns created note', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce({ id: 5n });
    mocks.noteCreate.mockResolvedValueOnce({ id: 1n, content: 'hi' });
    const out = await create(5n, 9n, { type: 'NOTE', content: 'hi', timestampSec: 12 });
    expect(out.id).toBe(1n);
    expect(mocks.noteCreate.mock.calls[0][0].data.timestampSec).toBe(12);
  });

  it('update throws 404 if not owned by user', async () => {
    mocks.noteFindFirst.mockResolvedValueOnce(null);
    await expect(update(1n, 9n, { content: 'x' })).rejects.toBeInstanceOf(HttpError);
  });

  it('update updates content', async () => {
    mocks.noteFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.noteUpdate.mockResolvedValueOnce({ id: 1n, content: 'new' });
    const out = await update(1n, 9n, { content: 'new' });
    expect(out.content).toBe('new');
  });

  it('remove throws 404 when missing', async () => {
    mocks.noteFindFirst.mockResolvedValueOnce(null);
    await expect(remove(1n, 9n)).rejects.toBeInstanceOf(HttpError);
  });

  it('remove soft-deletes', async () => {
    mocks.noteFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.noteUpdate.mockResolvedValueOnce({});
    await remove(1n, 9n);
    expect(mocks.noteUpdate).toHaveBeenCalled();
    expect(mocks.noteUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });
});
