import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  questionFindMany: vi.fn(),
  questionCount: vi.fn(),
  questionFindFirst: vi.fn(),
  questionCreate: vi.fn(),
  questionUpdate: vi.fn(),
  bankFindFirst: vi.fn(),
  bankCreate: vi.fn(),
  txn: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    question: {
      findMany: mocks.questionFindMany,
      count: mocks.questionCount,
      findFirst: mocks.questionFindFirst,
      create: mocks.questionCreate,
      update: mocks.questionUpdate,
    },
    questionBank: {
      findFirst: mocks.bankFindFirst,
      create: mocks.bankCreate,
    },
    $transaction: mocks.txn,
  },
}));

import {
  list,
  getById,
  create,
  update,
  softDelete,
} from './questions.service.js';
import { HttpError } from '../../utils/httpError.js';

describe('questions.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  describe('list', () => {
    it('applies all filters', async () => {
      mocks.questionFindMany.mockResolvedValueOnce([]);
      mocks.questionCount.mockResolvedValueOnce(0);
      await list({
        page: 1,
        pageSize: 10,
        bankId: 5n,
        type: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        categoryId: 3n,
        q: 'hello',
      });
      const where = mocks.questionFindMany.mock.calls[0][0].where;
      expect(where.bankId).toBe(5n);
      expect(where.type).toBe('SINGLE_CHOICE');
      expect(where.difficulty).toBe('EASY');
      expect(where.text.contains).toBe('hello');
    });
  });

  it('getById throws 404 when missing', async () => {
    mocks.questionFindFirst.mockResolvedValueOnce(null);
    await expect(getById(1n)).rejects.toBeInstanceOf(HttpError);
  });

  describe('create', () => {
    it('rejects SINGLE_CHOICE with !=1 correct', async () => {
      await expect(
        create(
          {
            type: 'SINGLE_CHOICE',
            text: 't',
            options: [
              { text: 'a', isCorrect: true },
              { text: 'b', isCorrect: true },
            ],
          },
          1n,
        ),
      ).rejects.toBeInstanceOf(HttpError);
    });

    it('rejects MULTIPLE_CHOICE with no correct', async () => {
      await expect(
        create(
          {
            type: 'MULTIPLE_CHOICE',
            text: 't',
            options: [
              { text: 'a', isCorrect: false },
              { text: 'b', isCorrect: false },
            ],
          },
          1n,
        ),
      ).rejects.toBeInstanceOf(HttpError);
    });

    it('rejects when fewer than 2 options', async () => {
      await expect(
        create(
          { type: 'SINGLE_CHOICE', text: 't', options: [{ text: 'only', isCorrect: true }] },
          1n,
        ),
      ).rejects.toBeInstanceOf(HttpError);
    });

    it('creates default bank when bankId omitted', async () => {
      mocks.bankFindFirst.mockResolvedValueOnce(null);
      mocks.bankCreate.mockResolvedValueOnce({ id: 1n });
      mocks.questionCreate.mockResolvedValueOnce({ id: 99n });
      await create(
        {
          type: 'SINGLE_CHOICE',
          text: '<p>q</p><script>x</script>',
          options: [
            { text: 'a', isCorrect: true },
            { text: 'b', isCorrect: false },
          ],
        },
        7n,
      );
      expect(mocks.bankCreate).toHaveBeenCalled();
      const data = mocks.questionCreate.mock.calls[0][0].data;
      expect(data.text).not.toContain('<script');
      expect(data.bankId).toBe(1n);
      expect(data.authorId).toBe(7n);
    });

    it('throws 404 when bankId not found', async () => {
      mocks.bankFindFirst.mockResolvedValueOnce(null);
      await expect(
        create(
          {
            bankId: 99n,
            type: 'SINGLE_CHOICE',
            text: 'q',
            options: [
              { text: 'a', isCorrect: true },
              { text: 'b', isCorrect: false },
            ],
          },
          1n,
        ),
      ).rejects.toBeInstanceOf(HttpError);
    });

    it('uses existing default bank if found', async () => {
      mocks.bankFindFirst.mockResolvedValueOnce({ id: 42n });
      mocks.questionCreate.mockResolvedValueOnce({ id: 1n });
      await create(
        {
          type: 'TRUE_FALSE',
          text: 'q',
          options: [
            { text: 'T', isCorrect: true },
            { text: 'F', isCorrect: false },
          ],
        },
        1n,
      );
      expect(mocks.bankCreate).not.toHaveBeenCalled();
      expect(mocks.questionCreate.mock.calls[0][0].data.bankId).toBe(42n);
    });
  });

  describe('update', () => {
    it('throws 404 when missing', async () => {
      mocks.questionFindFirst.mockResolvedValueOnce(null);
      await expect(update(1n, { text: 'x' })).rejects.toBeInstanceOf(HttpError);
    });

    it('runs transaction and sanitizes', async () => {
      mocks.questionFindFirst.mockResolvedValueOnce({ id: 1n, type: 'SINGLE_CHOICE' });
      mocks.questionFindFirst.mockResolvedValueOnce({ id: 1n }); // for getById
      const qUpdate = vi.fn();
      const oDelete = vi.fn();
      const oCreate = vi.fn();
      mocks.txn.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          question: { update: qUpdate },
          questionOption: { deleteMany: oDelete, createMany: oCreate },
        }),
      );
      await update(1n, {
        text: '<p>safe</p><script>bad</script>',
        options: [
          { text: 'a', isCorrect: true },
          { text: 'b', isCorrect: false },
        ],
      });
      expect(qUpdate.mock.calls[0][0].data.text).not.toContain('<script');
      expect(oDelete).toHaveBeenCalled();
      expect(oCreate).toHaveBeenCalled();
    });
  });

  it('softDelete throws 404 when missing', async () => {
    mocks.questionFindFirst.mockResolvedValueOnce(null);
    await expect(softDelete(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('softDelete sets deletedAt', async () => {
    mocks.questionFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.questionUpdate.mockResolvedValueOnce({});
    await softDelete(1n);
    expect(mocks.questionUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });
});
