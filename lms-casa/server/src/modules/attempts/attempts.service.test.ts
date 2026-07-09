import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  attemptFindMany: vi.fn(),
  attemptCount: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptCreate: vi.fn(),
  attemptUpdate: vi.fn(),
  examFindFirst: vi.fn(),
  questionFindMany: vi.fn(),
  questionFindFirst: vi.fn(),
  examQuestionFindFirst: vi.fn(),
  responseFindMany: vi.fn(),
  responseUpsert: vi.fn(),
  txn: vi.fn(),
  sendExamResult: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    examAttempt: {
      findMany: mocks.attemptFindMany,
      count: mocks.attemptCount,
      findFirst: mocks.attemptFindFirst,
      create: mocks.attemptCreate,
      update: mocks.attemptUpdate,
    },
    exam: { findFirst: mocks.examFindFirst },
    question: { findMany: mocks.questionFindMany, findFirst: mocks.questionFindFirst },
    examQuestion: { findFirst: mocks.examQuestionFindFirst },
    attemptResponse: { findMany: mocks.responseFindMany, upsert: mocks.responseUpsert },
    $transaction: mocks.txn,
  },
}));

vi.mock('../../config/env.js', () => ({
  env: { APP_URL: 'http://localhost' },
}));

vi.mock('../email-templates/email-templates.js', () => ({
  sendExamResult: mocks.sendExamResult,
}));

import {
  listMine,
  start,
  getById,
  saveResponse,
  submit,
  logEvent,
} from './attempts.service.js';
import { HttpError } from '../../utils/httpError.js';

const baseExam = {
  id: 1n,
  status: 'PUBLISHED',
  deletedAt: null,
  passingScore: 70,
  shuffleQuestions: false,
  shuffleOptions: false,
  maxAttempts: null,
  cooldownMinutes: null,
  timeLimitMinutes: 30,
  randomFromBankId: null,
  randomCount: null,
  questions: [
    {
      id: 10n,
      points: 1,
      orderIndex: 0,
      question: {
        id: 100n,
        type: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        text: 'Q1',
        defaultPoints: 1,
        meta: null,
        deletedAt: null,
        options: [
          { id: 1000n, text: 'A', imageUrl: null, orderIndex: 0, isCorrect: true, meta: null },
          { id: 1001n, text: 'B', imageUrl: null, orderIndex: 1, isCorrect: false, meta: null },
        ],
        answers: [],
      },
    },
  ],
};

describe('attempts.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  describe('listMine', () => {
    it('applies examId + q filters', async () => {
      mocks.attemptFindMany.mockResolvedValueOnce([]);
      mocks.attemptCount.mockResolvedValueOnce(0);
      await listMine(5n, { page: 1, pageSize: 10, examId: 7n, q: 'final' });
      const where = mocks.attemptFindMany.mock.calls[0][0].where;
      expect(where.examId).toBe(7n);
      expect(where.exam.title.contains).toBe('final');
    });
  });

  describe('start', () => {
    it('throws 404 if exam not published', async () => {
      mocks.examFindFirst.mockResolvedValueOnce(null);
      await expect(start(1n, 5n)).rejects.toBeInstanceOf(HttpError);
    });

    it('respects maxAttempts', async () => {
      mocks.examFindFirst.mockResolvedValueOnce({ ...baseExam, maxAttempts: 1 });
      mocks.attemptCount.mockResolvedValueOnce(1);
      await expect(start(1n, 5n)).rejects.toMatchObject({ status: 409 });
    });

    it('respects cooldownMinutes', async () => {
      mocks.examFindFirst.mockResolvedValueOnce({ ...baseExam, cooldownMinutes: 60 });
      mocks.attemptCount.mockResolvedValueOnce(0);
      mocks.attemptFindFirst.mockResolvedValueOnce({
        attemptNumber: 1,
        submittedAt: new Date(Date.now() - 30 * 60_000),
        startedAt: new Date(Date.now() - 50 * 60_000),
      });
      await expect(start(1n, 5n)).rejects.toMatchObject({ status: 409 });
    });

    it('creates attempt with shuffled questions', async () => {
      mocks.examFindFirst.mockResolvedValueOnce({ ...baseExam, shuffleQuestions: true });
      mocks.attemptCount.mockResolvedValueOnce(0);
      mocks.attemptFindFirst.mockResolvedValueOnce(null);
      mocks.attemptCreate.mockResolvedValueOnce({ id: 99n });
      const out = await start(1n, 5n);
      expect(out.attempt.id).toBe(99n);
      expect(out.questions).toHaveLength(1);
      expect(out.questions[0]).not.toHaveProperty('isCorrect');
    });

    it('rejects exam with no active questions', async () => {
      mocks.examFindFirst.mockResolvedValueOnce({
        ...baseExam,
        questions: [],
      });
      mocks.attemptCount.mockResolvedValueOnce(0);
      mocks.attemptFindFirst.mockResolvedValueOnce(null);
      await expect(start(1n, 5n)).rejects.toBeInstanceOf(HttpError);
    });

    it('uses random bank when configured', async () => {
      mocks.examFindFirst.mockResolvedValueOnce({
        ...baseExam,
        randomFromBankId: 50n,
        randomCount: 2,
      });
      mocks.attemptCount.mockResolvedValueOnce(0);
      mocks.attemptFindFirst.mockResolvedValueOnce(null);
      mocks.questionFindMany.mockResolvedValueOnce([
        {
          id: 100n,
          type: 'SINGLE_CHOICE',
          difficulty: 'EASY',
          text: 'q1',
          defaultPoints: 1,
          meta: null,
          deletedAt: null,
          options: [{ id: 1n, text: 'a', imageUrl: null, orderIndex: 0, isCorrect: true, meta: null }],
          answers: [],
        },
        {
          id: 101n,
          type: 'SINGLE_CHOICE',
          difficulty: 'EASY',
          text: 'q2',
          defaultPoints: 1,
          meta: null,
          deletedAt: null,
          options: [{ id: 2n, text: 'b', imageUrl: null, orderIndex: 0, isCorrect: true, meta: null }],
          answers: [],
        },
      ]);
      mocks.attemptCreate.mockResolvedValueOnce({ id: 50n });
      const out = await start(1n, 5n);
      expect(out.questions.length).toBeGreaterThan(0);
      expect(mocks.questionFindMany).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns attempt with responses', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({ id: 1n });
      mocks.responseFindMany.mockResolvedValueOnce([{ id: 1n }]);
      const out = await getById(1n, 5n);
      expect(out.responses).toHaveLength(1);
    });

    it('throws 404 when attempt missing', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce(null);
      await expect(getById(1n, 5n)).rejects.toBeInstanceOf(HttpError);
    });
  });

  describe('saveResponse', () => {
    it('rejects if attempt already submitted', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({ id: 1n, examId: 5n, status: 'SUBMITTED' });
      await expect(
        saveResponse(1n, 5n, { questionId: 100n }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('rejects if attempt expired', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({
        id: 1n,
        examId: 5n,
        status: 'IN_PROGRESS',
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        saveResponse(1n, 5n, { questionId: 100n }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('rejects question outside exam (no random bank)', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({
        id: 1n,
        examId: 5n,
        status: 'IN_PROGRESS',
        expiresAt: null,
      });
      mocks.examQuestionFindFirst.mockResolvedValueOnce(null);
      mocks.examFindFirst.mockResolvedValueOnce({ randomFromBankId: null });
      await expect(
        saveResponse(1n, 5n, { questionId: 100n }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects deleted question', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({
        id: 1n,
        examId: 5n,
        status: 'IN_PROGRESS',
        expiresAt: null,
      });
      mocks.examQuestionFindFirst.mockResolvedValueOnce({
        question: { type: 'SINGLE_CHOICE', deletedAt: new Date(), options: [] },
      });
      await expect(
        saveResponse(1n, 5n, { questionId: 100n }),
      ).rejects.toBeInstanceOf(HttpError);
    });

    it('rejects unknown option for choice question', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({
        id: 1n,
        examId: 5n,
        status: 'IN_PROGRESS',
        expiresAt: null,
      });
      mocks.examQuestionFindFirst.mockResolvedValueOnce({
        question: {
          type: 'SINGLE_CHOICE',
          deletedAt: null,
          options: [{ id: 999n }],
        },
      });
      await expect(
        saveResponse(1n, 5n, { questionId: 100n, selectedOptionIds: [123n] }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('upserts response with selected ids deduplicated', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({
        id: 1n,
        examId: 5n,
        status: 'IN_PROGRESS',
        expiresAt: null,
      });
      mocks.examQuestionFindFirst.mockResolvedValueOnce({
        question: {
          type: 'SINGLE_CHOICE',
          deletedAt: null,
          options: [{ id: 1000n }],
        },
      });
      mocks.responseUpsert.mockResolvedValueOnce({ id: 1n });
      await saveResponse(1n, 5n, { questionId: 100n, selectedOptionIds: [1000n, 1000n] });
      const args = mocks.responseUpsert.mock.calls[0][0];
      expect(args.create.selectedOptionIds).toEqual(['1000']);
    });
  });

  describe('logEvent', () => {
    it('throws 404 when attempt missing', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce(null);
      await expect(logEvent(1n, 5n, { type: 'TAB_BLUR' })).rejects.toBeInstanceOf(HttpError);
    });

    it('rejects logging for non-IN_PROGRESS attempt', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({ status: 'SUBMITTED' });
      await expect(logEvent(1n, 5n, { type: 'TAB_BLUR' })).rejects.toMatchObject({ status: 409 });
    });

    it('appends event to metadata.events', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({
        id: 1n,
        status: 'IN_PROGRESS',
        metadata: { events: [{ type: 'PASTE_DETECTED', ts: 't', payload: null }] },
      });
      mocks.attemptUpdate.mockResolvedValueOnce({});
      const out = await logEvent(1n, 5n, { type: 'TAB_BLUR', payload: { x: 1 } });
      expect(out.eventCount).toBe(2);
      const updateData = mocks.attemptUpdate.mock.calls[0][0].data.metadata;
      expect(updateData.events).toHaveLength(2);
    });

    it('initializes empty events array if missing', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({
        id: 1n,
        status: 'IN_PROGRESS',
        metadata: null,
      });
      mocks.attemptUpdate.mockResolvedValueOnce({});
      const out = await logEvent(1n, 5n, { type: 'TAB_BLUR' });
      expect(out.eventCount).toBe(1);
    });

    it('counts only violation types and does not auto-submit below threshold (Issue #10)', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({
        id: 1n,
        status: 'IN_PROGRESS',
        metadata: {
          events: [
            { type: 'TAB_FOCUS' }, // benign return — not counted
            { type: 'VISIBILITY_VISIBLE' }, // benign — not counted
            { type: 'PASTE_DETECTED' }, // violation
          ],
        },
      });
      mocks.attemptUpdate.mockResolvedValueOnce({});
      const out = await logEvent(1n, 5n, { type: 'TAB_BLUR' }); // violation
      expect(out.violationCount).toBe(2); // PASTE_DETECTED + TAB_BLUR
      expect(out.autoSubmitted).toBe(false);
      expect(mocks.attemptUpdate.mock.calls[0][0].data.metadata.violationCount).toBe(2);
    });
  });

  describe('submit', () => {
    it('throws 404 when attempt missing', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce(null);
      await expect(submit(1n, 5n)).rejects.toBeInstanceOf(HttpError);
    });

    it('rejects already-submitted attempt', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({
        id: 1n,
        status: 'SUBMITTED',
        exam: { deletedAt: null, questions: [] },
        responses: [],
      });
      await expect(submit(1n, 5n)).rejects.toMatchObject({ status: 409 });
    });

    it('rejects when exam is deleted', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({
        id: 1n,
        status: 'IN_PROGRESS',
        exam: { deletedAt: new Date(), questions: [] },
        responses: [],
      });
      await expect(submit(1n, 5n)).rejects.toBeInstanceOf(HttpError);
    });

    it('grades + transitions to SUBMITTED + sends email when passed', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce({
        id: 1n,
        userId: 5n,
        examId: 10n,
        status: 'IN_PROGRESS',
        expiresAt: null,
        user: { firstName: 'A', lastName: 'B', email: 'a@b.com' },
        exam: {
          title: 'E',
          course: { title: 'C' },
          deletedAt: null,
          passingScore: 50,
          questions: [
            {
              questionId: 100n,
              points: 10,
              question: {
                type: 'SINGLE_CHOICE',
                deletedAt: null,
                meta: null,
                options: [
                  { id: 1n, isCorrect: true, orderIndex: 0, meta: null },
                  { id: 2n, isCorrect: false, orderIndex: 1, meta: null },
                ],
                answers: [],
              },
            },
          ],
        },
        responses: [
          { questionId: 100n, selectedOptionIds: ['1'], textAnswer: null, meta: null },
        ],
      });
      const txAttempt = {
        update: vi
          .fn()
          .mockResolvedValueOnce({ id: 1n, score: 10, maxScore: 10, scorePct: 100, passed: true }),
      };
      const txResp = { upsert: vi.fn() };
      mocks.txn.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ examAttempt: txAttempt, attemptResponse: txResp }),
      );
      mocks.sendExamResult.mockResolvedValueOnce(undefined);
      const out = await submit(1n, 5n);
      expect(out.result.passed).toBe(true);
      expect(out.result.scorePct).toBe(100);
      expect(mocks.sendExamResult).toHaveBeenCalled();
    });

    function singleChoiceAttempt(type: string, passingScore: number, correct: boolean) {
      return {
        id: 1n,
        userId: 5n,
        examId: 10n,
        status: 'IN_PROGRESS',
        expiresAt: null,
        user: { firstName: 'A', lastName: 'B', email: 'a@b.com' },
        exam: {
          title: 'E',
          type,
          course: { title: 'C' },
          deletedAt: null,
          passingScore,
          questions: [
            {
              questionId: 100n,
              points: 10,
              question: {
                type: 'SINGLE_CHOICE',
                deletedAt: null,
                meta: null,
                options: [
                  { id: 1n, isCorrect: true, orderIndex: 0, meta: null },
                  { id: 2n, isCorrect: false, orderIndex: 1, meta: null },
                ],
                answers: [],
              },
            },
          ],
        },
        responses: [
          { questionId: 100n, selectedOptionIds: [correct ? '1' : '2'], textAnswer: null, meta: null },
        ],
      };
    }

    it('PRE_TEST passes regardless of score (ก่อนเรียน — ไม่ฟิกเกณฑ์)', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce(singleChoiceAttempt('PRE_TEST', 80, false));
      const txAttempt = { update: vi.fn().mockResolvedValueOnce({ id: 1n, scorePct: 0, passed: true }) };
      mocks.txn.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ examAttempt: txAttempt, attemptResponse: { upsert: vi.fn() } }),
      );
      mocks.sendExamResult.mockResolvedValueOnce(undefined);
      await submit(1n, 5n);
      const data = txAttempt.update.mock.calls[0][0].data;
      expect(data.scorePct).toBe(0);
      expect(data.passed).toBe(true);
    });

    it('POST_TEST fails when below passing score (หลังเรียน — ต้องผ่าน)', async () => {
      mocks.attemptFindFirst.mockResolvedValueOnce(singleChoiceAttempt('POST_TEST', 80, false));
      const txAttempt = { update: vi.fn().mockResolvedValueOnce({ id: 1n, scorePct: 0, passed: false }) };
      mocks.txn.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ examAttempt: txAttempt, attemptResponse: { upsert: vi.fn() } }),
      );
      mocks.sendExamResult.mockResolvedValueOnce(undefined);
      await submit(1n, 5n);
      const data = txAttempt.update.mock.calls[0][0].data;
      expect(data.passed).toBe(false);
    });
  });
});
