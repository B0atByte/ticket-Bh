import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  txn: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    course: {
      findMany: mocks.findMany,
      count: mocks.count,
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
    },
    $transaction: mocks.txn,
  },
}));

import {
  list,
  getById,
  create,
  update,
  publish,
  archive,
  softDelete,
} from './courses.service.js';
import { HttpError } from '../../utils/httpError.js';

const baseCourse = { id: 1n, status: 'DRAFT', slug: 'old-slug' };

describe('courses.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  describe('list', () => {
    it('applies all filters', async () => {
      mocks.findMany.mockResolvedValueOnce([]);
      mocks.count.mockResolvedValueOnce(0);
      await list({
        page: 1,
        pageSize: 10,
        status: 'PUBLISHED',
        visibility: 'INTERNAL',
        categoryId: 3n,
        authorId: 7n,
        q: 'react',
      });
      const where = mocks.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('PUBLISHED');
      expect(where.visibility).toBe('INTERNAL');
      expect(where.categoryId).toBe(3n);
      expect(where.authorId).toBe(7n);
      expect(where.OR).toBeDefined();
    });

    it('returns paginated items', async () => {
      mocks.findMany.mockResolvedValueOnce([
        { id: 1n, modules: [{ _count: { lessons: 3 } }, { _count: { lessons: 2 } }] },
        { id: 2n, modules: [] },
      ]);
      mocks.count.mockResolvedValueOnce(2);
      const out = await list({ page: 1, pageSize: 20 });
      expect(out.items).toHaveLength(2);
      expect(out.items[0].lessonCount).toBe(5);
      expect(out.items[1].lessonCount).toBe(0);
      expect((out.items[0] as { modules?: unknown }).modules).toBeUndefined();
      expect(out.meta.total).toBe(2);
    });
  });

  describe('getById', () => {
    it('throws 404 when not found', async () => {
      mocks.findFirst.mockResolvedValueOnce(null);
      await expect(getById(1n)).rejects.toBeInstanceOf(HttpError);
    });

    it('returns course', async () => {
      mocks.findFirst.mockResolvedValueOnce({ id: 1n, title: 'C', status: 'PUBLISHED' });
      const out = await getById(1n);
      expect(out.id).toBe(1n);
    });

    it('blocks non-staff/non-author from unpublished course', async () => {
      mocks.findFirst.mockResolvedValueOnce({ id: 1n, title: 'C', status: 'DRAFT', authorId: 2n });
      await expect(getById(1n, { userId: 99n, roles: ['EMPLOYEE'] })).rejects.toBeInstanceOf(HttpError);
    });

    it('allows author to view their own unpublished course', async () => {
      mocks.findFirst.mockResolvedValueOnce({ id: 1n, title: 'C', status: 'DRAFT', authorId: 2n });
      const out = await getById(1n, { userId: 2n, roles: ['INSTRUCTOR'] });
      expect(out.id).toBe(1n);
    });

    it('allows staff to view unpublished course', async () => {
      mocks.findFirst.mockResolvedValueOnce({ id: 1n, title: 'C', status: 'DRAFT', authorId: 2n });
      const out = await getById(1n, { userId: 99n, roles: ['ADMIN'] });
      expect(out.id).toBe(1n);
    });
  });

  describe('create', () => {
    it('throws conflict on duplicate slug', async () => {
      mocks.findUnique.mockResolvedValueOnce({ id: 9n });
      await expect(
        create({ title: 't', slug: 'dup' }, 1n),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('sanitizes description and creates', async () => {
      mocks.findUnique.mockResolvedValueOnce(null);
      mocks.create.mockResolvedValueOnce({ id: 99n });
      await create(
        {
          title: 't',
          slug: 's',
          description: '<p>Safe</p><script>alert(1)</script>',
        },
        7n,
      );
      const arg = mocks.create.mock.calls[0][0].data;
      expect(arg.description).toContain('<p>Safe</p>');
      expect(arg.description).not.toContain('<script');
      expect(arg.authorId).toBe(7n);
    });

    it('attaches tags when tagIds provided', async () => {
      mocks.findUnique.mockResolvedValueOnce(null);
      mocks.create.mockResolvedValueOnce({ id: 99n });
      await create({ title: 't', slug: 's', tagIds: [1n, 2n] }, 7n);
      expect(mocks.create.mock.calls[0][0].data.tags.create).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('throws 404 when missing', async () => {
      mocks.findFirst.mockResolvedValueOnce(null);
      await expect(update(1n, { title: 'x' })).rejects.toBeInstanceOf(HttpError);
    });

    it('rejects when new slug conflicts', async () => {
      mocks.findFirst.mockResolvedValueOnce(baseCourse);
      mocks.findUnique.mockResolvedValueOnce({ id: 9n });
      await expect(update(1n, { slug: 'taken' })).rejects.toMatchObject({ status: 409 });
    });

    it('allows update when slug unchanged', async () => {
      mocks.findFirst.mockResolvedValueOnce(baseCourse);
      mocks.findFirst.mockResolvedValueOnce(baseCourse); // for getById
      mocks.txn.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          course: { update: vi.fn() },
          courseTag: { deleteMany: vi.fn(), createMany: vi.fn() },
        }),
      );
      await update(1n, { title: 'new' });
      expect(mocks.txn).toHaveBeenCalled();
    });

    it('sanitizes description on update', async () => {
      mocks.findFirst.mockResolvedValueOnce(baseCourse);
      mocks.findFirst.mockResolvedValueOnce(baseCourse);
      const courseUpdate = vi.fn();
      mocks.txn.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          course: { update: courseUpdate },
          courseTag: { deleteMany: vi.fn(), createMany: vi.fn() },
        }),
      );
      await update(1n, { description: '<p>X</p><script>bad</script>' });
      const data = courseUpdate.mock.calls[0][0].data;
      expect(data.description).not.toContain('<script');
    });

    it('replaces tags when tagIds provided', async () => {
      mocks.findFirst.mockResolvedValueOnce(baseCourse);
      mocks.findFirst.mockResolvedValueOnce(baseCourse);
      const deleteMany = vi.fn();
      const createMany = vi.fn();
      mocks.txn.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          course: { update: vi.fn() },
          courseTag: { deleteMany, createMany },
        }),
      );
      await update(1n, { tagIds: [1n, 2n] });
      expect(deleteMany).toHaveBeenCalled();
      expect(createMany).toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('throws 404 when missing', async () => {
      mocks.findFirst.mockResolvedValueOnce(null);
      await expect(publish(1n)).rejects.toBeInstanceOf(HttpError);
    });

    it('is no-op when already PUBLISHED', async () => {
      mocks.findFirst.mockResolvedValueOnce({ ...baseCourse, status: 'PUBLISHED' });
      const out = await publish(1n);
      expect(out.status).toBe('PUBLISHED');
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it('rejects publishing ARCHIVED course', async () => {
      mocks.findFirst.mockResolvedValueOnce({ ...baseCourse, status: 'ARCHIVED' });
      await expect(publish(1n)).rejects.toBeInstanceOf(HttpError);
    });

    it('transitions DRAFT → PUBLISHED with publishedAt', async () => {
      mocks.findFirst.mockResolvedValueOnce(baseCourse);
      mocks.update.mockResolvedValueOnce({ status: 'PUBLISHED' });
      await publish(1n);
      const data = mocks.update.mock.calls[0][0].data;
      expect(data.status).toBe('PUBLISHED');
      expect(data.publishedAt).toBeInstanceOf(Date);
    });
  });

  describe('archive', () => {
    it('throws 404 when missing', async () => {
      mocks.findFirst.mockResolvedValueOnce(null);
      await expect(archive(1n)).rejects.toBeInstanceOf(HttpError);
    });

    it('sets status ARCHIVED', async () => {
      mocks.findFirst.mockResolvedValueOnce(baseCourse);
      mocks.update.mockResolvedValueOnce({ status: 'ARCHIVED' });
      await archive(1n);
      expect(mocks.update.mock.calls[0][0].data.status).toBe('ARCHIVED');
    });
  });

  describe('softDelete', () => {
    it('throws 404 when missing', async () => {
      mocks.findFirst.mockResolvedValueOnce(null);
      await expect(softDelete(1n)).rejects.toBeInstanceOf(HttpError);
    });

    it('sets deletedAt', async () => {
      mocks.findFirst.mockResolvedValueOnce(baseCourse);
      mocks.update.mockResolvedValueOnce({});
      await softDelete(1n);
      expect(mocks.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    });
  });
});
