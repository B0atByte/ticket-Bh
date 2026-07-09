import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  examFindMany: vi.fn(),
  examCount: vi.fn(),
  examFindFirst: vi.fn(),
  examCreate: vi.fn(),
  examUpdate: vi.fn(),
  courseFindFirst: vi.fn(),
  bankFindFirst: vi.fn(),
  questionFindFirst: vi.fn(),
  eqCount: vi.fn(),
  eqUpsert: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    exam: {
      findMany: mocks.examFindMany,
      count: mocks.examCount,
      findFirst: mocks.examFindFirst,
      create: mocks.examCreate,
      update: mocks.examUpdate,
    },
    course: { findFirst: mocks.courseFindFirst },
    questionBank: { findFirst: mocks.bankFindFirst },
    question: { findFirst: mocks.questionFindFirst },
    examQuestion: { count: mocks.eqCount, upsert: mocks.eqUpsert },
  },
}));

import {
  list,
  getById,
  create,
  update,
  assignQuestion,
  publish,
  archive,
  softDelete,
} from './exams.service.js';
import { HttpError } from '../../utils/httpError.js';

describe('exams.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  it('list filters by status/type/course/q', async () => {
    mocks.examFindMany.mockResolvedValueOnce([]);
    mocks.examCount.mockResolvedValueOnce(0);
    await list({
      page: 1,
      pageSize: 10,
      status: 'PUBLISHED',
      type: 'QUIZ',
      courseId: 5n,
      q: 'final',
    });
    const where = mocks.examFindMany.mock.calls[0][0].where;
    expect(where.status).toBe('PUBLISHED');
    expect(where.type).toBe('QUIZ');
    expect(where.courseId).toBe(5n);
    expect(where.OR).toBeDefined();
  });

  it('getById throws 404 when missing', async () => {
    mocks.examFindFirst.mockResolvedValueOnce(null);
    await expect(getById(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('getById filters out deleted questions', async () => {
    mocks.examFindFirst.mockResolvedValueOnce({
      id: 1n,
      questions: [
        { question: { deletedAt: null } },
        { question: { deletedAt: new Date() } },
      ],
    });
    const out = await getById(1n);
    expect(out.questions).toHaveLength(1);
  });

  it('create throws 404 when course missing', async () => {
    mocks.courseFindFirst.mockResolvedValueOnce(null);
    await expect(create({ title: 'e', courseId: 1n })).rejects.toBeInstanceOf(HttpError);
  });

  it('create throws 404 when randomFromBankId missing', async () => {
    mocks.bankFindFirst.mockResolvedValueOnce(null);
    await expect(
      create({ title: 'e', randomFromBankId: 7n }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('create applies defaults', async () => {
    mocks.examCreate.mockResolvedValueOnce({ id: 99n });
    await create({ title: 'e' });
    const data = mocks.examCreate.mock.calls[0][0].data;
    expect(data.type).toBe('QUIZ');
    expect(data.passingScore).toBe(70);
    expect(data.shuffleQuestions).toBe(false);
    expect(data.showResultMode).toBe('AFTER_SUBMIT');
  });

  it('update throws 404 when missing', async () => {
    mocks.examFindFirst.mockResolvedValueOnce(null);
    await expect(update(1n, { title: 'x' })).rejects.toBeInstanceOf(HttpError);
  });

  it('update validates course+bank', async () => {
    mocks.examFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.courseFindFirst.mockResolvedValueOnce(null);
    await expect(update(1n, { courseId: 9n })).rejects.toBeInstanceOf(HttpError);
  });

  it('assignQuestion rejects archived exam', async () => {
    mocks.examFindFirst.mockResolvedValueOnce({ id: 1n, status: 'ARCHIVED' });
    mocks.questionFindFirst.mockResolvedValueOnce({ id: 5n });
    await expect(
      assignQuestion(1n, { questionId: 5n, points: 1 }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('assignQuestion throws 404 when exam missing', async () => {
    mocks.examFindFirst.mockResolvedValueOnce(null);
    mocks.questionFindFirst.mockResolvedValueOnce({ id: 5n });
    await expect(
      assignQuestion(1n, { questionId: 5n, points: 1 }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('assignQuestion throws 404 when question missing', async () => {
    mocks.examFindFirst.mockResolvedValueOnce({ id: 1n, status: 'DRAFT' });
    mocks.questionFindFirst.mockResolvedValueOnce(null);
    await expect(
      assignQuestion(1n, { questionId: 5n, points: 1 }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('assignQuestion uses provided orderIndex', async () => {
    mocks.examFindFirst.mockResolvedValueOnce({ id: 1n, status: 'DRAFT' });
    mocks.questionFindFirst.mockResolvedValueOnce({ id: 5n });
    mocks.eqUpsert.mockResolvedValueOnce({});
    await assignQuestion(1n, { questionId: 5n, points: 2, orderIndex: 3 });
    expect(mocks.eqUpsert.mock.calls[0][0].create.orderIndex).toBe(3);
  });

  it('assignQuestion falls back to count for orderIndex', async () => {
    mocks.examFindFirst.mockResolvedValueOnce({ id: 1n, status: 'DRAFT' });
    mocks.questionFindFirst.mockResolvedValueOnce({ id: 5n });
    mocks.eqCount.mockResolvedValueOnce(4);
    mocks.eqUpsert.mockResolvedValueOnce({});
    await assignQuestion(1n, { questionId: 5n, points: 1 });
    expect(mocks.eqUpsert.mock.calls[0][0].create.orderIndex).toBe(4);
  });

  it('publish throws 404 when missing', async () => {
    mocks.examFindFirst.mockResolvedValueOnce(null);
    await expect(publish(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('publish rejects archived', async () => {
    mocks.examFindFirst.mockResolvedValueOnce({ status: 'ARCHIVED', _count: { questions: 1 } });
    await expect(publish(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('publish requires at least one question', async () => {
    mocks.examFindFirst.mockResolvedValueOnce({ status: 'DRAFT', _count: { questions: 0 } });
    await expect(publish(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('publish transitions to PUBLISHED', async () => {
    mocks.examFindFirst.mockResolvedValueOnce({ status: 'DRAFT', _count: { questions: 3 } });
    mocks.examUpdate.mockResolvedValueOnce({ status: 'PUBLISHED' });
    await publish(1n);
    expect(mocks.examUpdate.mock.calls[0][0].data.status).toBe('PUBLISHED');
    expect(mocks.examUpdate.mock.calls[0][0].data.publishedAt).toBeInstanceOf(Date);
  });

  it('archive throws 404 when missing', async () => {
    mocks.examFindFirst.mockResolvedValueOnce(null);
    await expect(archive(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('archive sets status', async () => {
    mocks.examFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.examUpdate.mockResolvedValueOnce({ status: 'ARCHIVED' });
    await archive(1n);
    expect(mocks.examUpdate.mock.calls[0][0].data.status).toBe('ARCHIVED');
  });

  it('softDelete sets deletedAt', async () => {
    mocks.examFindFirst.mockResolvedValueOnce({ id: 1n });
    mocks.examUpdate.mockResolvedValueOnce({});
    await softDelete(1n);
    expect(mocks.examUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });

  it('softDelete throws 404 when missing', async () => {
    mocks.examFindFirst.mockResolvedValueOnce(null);
    await expect(softDelete(1n)).rejects.toBeInstanceOf(HttpError);
  });
});
