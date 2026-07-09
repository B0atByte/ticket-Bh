import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  qFindMany: vi.fn(),
  qCount: vi.fn(),
  qFindFirst: vi.fn(),
  qCreate: vi.fn(),
  qUpdate: vi.fn(),
  aFindFirst: vi.fn(),
  aCreate: vi.fn(),
  aUpdate: vi.fn(),
  aUpdateMany: vi.fn(),
  courseFindFirst: vi.fn(),
  txn: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    courseQuestion: {
      findMany: mocks.qFindMany,
      count: mocks.qCount,
      findFirst: mocks.qFindFirst,
      create: mocks.qCreate,
      update: mocks.qUpdate,
    },
    courseAnswer: {
      findFirst: mocks.aFindFirst,
      create: mocks.aCreate,
      update: mocks.aUpdate,
      updateMany: mocks.aUpdateMany,
    },
    course: { findFirst: mocks.courseFindFirst },
    $transaction: mocks.txn,
  },
}));

import {
  listQuestions,
  getQuestion,
  createQuestion,
  deleteQuestion,
  createAnswer,
  acceptAnswer,
  deleteAnswer,
} from './course-qa.service.js';
import { HttpError } from '../../utils/httpError.js';

describe('course-qa.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  it('listQuestions applies q filter', async () => {
    mocks.qFindMany.mockResolvedValueOnce([]);
    mocks.qCount.mockResolvedValueOnce(0);
    await listQuestions(1n, { page: 1, pageSize: 10, q: 'hello' });
    expect(mocks.qFindMany.mock.calls[0][0].where.OR).toBeDefined();
  });

  it('getQuestion throws 404 when missing', async () => {
    mocks.qFindFirst.mockResolvedValueOnce(null);
    await expect(getQuestion(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('getQuestion returns question', async () => {
    mocks.qFindFirst.mockResolvedValueOnce({ id: 1n, answers: [] });
    const out = await getQuestion(1n);
    expect(out.id).toBe(1n);
  });

  it('createQuestion throws 404 when course missing', async () => {
    mocks.courseFindFirst.mockResolvedValueOnce(null);
    await expect(
      createQuestion(1n, 5n, { title: 't', body: 'b' }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('createQuestion persists', async () => {
    mocks.courseFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.qCreate.mockResolvedValueOnce({ id: 99n });
    const out = await createQuestion(1n, 5n, { title: 't', body: 'b' });
    expect(out.id).toBe(99n);
    expect(mocks.qCreate.mock.calls[0][0].data.userId).toBe(5n);
  });

  it('deleteQuestion throws 404 when missing', async () => {
    mocks.qFindFirst.mockResolvedValueOnce(null);
    await expect(deleteQuestion(1n, 5n, [])).rejects.toBeInstanceOf(HttpError);
  });

  it('deleteQuestion allows owner', async () => {
    mocks.qFindFirst.mockResolvedValueOnce({ id: 1n, userId: 5n });
    mocks.qUpdate.mockResolvedValueOnce({});
    await deleteQuestion(1n, 5n, []);
    expect(mocks.qUpdate).toHaveBeenCalled();
  });

  it('deleteQuestion allows admin/instructor', async () => {
    mocks.qFindFirst.mockResolvedValueOnce({ id: 1n, userId: 99n });
    mocks.qUpdate.mockResolvedValueOnce({});
    await deleteQuestion(1n, 5n, ['INSTRUCTOR']);
    expect(mocks.qUpdate).toHaveBeenCalled();
  });

  it('deleteQuestion forbids non-owner non-admin', async () => {
    mocks.qFindFirst.mockResolvedValueOnce({ id: 1n, userId: 99n });
    await expect(deleteQuestion(1n, 5n, ['EMPLOYEE'])).rejects.toMatchObject({
      status: 403,
    });
  });

  it('createAnswer throws 404 when question missing', async () => {
    mocks.qFindFirst.mockResolvedValueOnce(null);
    await expect(createAnswer(1n, 5n, { body: 'x' })).rejects.toBeInstanceOf(HttpError);
  });

  it('createAnswer persists answer', async () => {
    mocks.qFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.aCreate.mockResolvedValueOnce({ id: 99n });
    await createAnswer(1n, 5n, { body: 'x' });
    expect(mocks.aCreate.mock.calls[0][0].data.userId).toBe(5n);
  });

  it('acceptAnswer throws 404 when missing', async () => {
    mocks.aFindFirst.mockResolvedValueOnce(null);
    await expect(acceptAnswer(1n, 5n, [])).rejects.toBeInstanceOf(HttpError);
  });

  it('acceptAnswer forbids non-owner non-admin', async () => {
    mocks.aFindFirst.mockResolvedValueOnce({
      id: 1n,
      questionId: 5n,
      question: { userId: 99n },
    });
    await expect(acceptAnswer(1n, 5n, [])).rejects.toMatchObject({ status: 403 });
  });

  it('acceptAnswer marks answer accepted (transaction)', async () => {
    mocks.aFindFirst.mockResolvedValueOnce({
      id: 1n,
      questionId: 5n,
      question: { userId: 7n },
    });
    mocks.aUpdateMany.mockReturnValueOnce('p1');
    mocks.aUpdate.mockReturnValueOnce('p2');
    mocks.txn.mockResolvedValueOnce([{}, {}]);
    mocks.aFindFirst.mockResolvedValueOnce({ id: 1n, isAccepted: true });
    await acceptAnswer(1n, 7n, []);
    expect(mocks.txn).toHaveBeenCalled();
  });

  it('deleteAnswer forbids non-owner non-admin', async () => {
    mocks.aFindFirst.mockResolvedValueOnce({ id: 1n, userId: 99n });
    await expect(deleteAnswer(1n, 5n, [])).rejects.toMatchObject({ status: 403 });
  });

  it('deleteAnswer allows owner', async () => {
    mocks.aFindFirst.mockResolvedValueOnce({ id: 1n, userId: 5n });
    mocks.aUpdate.mockResolvedValueOnce({});
    await deleteAnswer(1n, 5n, []);
    expect(mocks.aUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });

  it('deleteAnswer throws 404 when missing', async () => {
    mocks.aFindFirst.mockResolvedValueOnce(null);
    await expect(deleteAnswer(1n, 5n, [])).rejects.toBeInstanceOf(HttpError);
  });
});
