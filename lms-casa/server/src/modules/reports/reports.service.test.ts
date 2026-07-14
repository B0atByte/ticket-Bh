import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  examAttemptFindMany: vi.fn(),
  enrollmentFindMany: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    examAttempt: { findMany: mocks.examAttemptFindMany },
    enrollment: { findMany: mocks.enrollmentFindMany },
  },
}));

import { buildCourseCompletionWorkbook, buildExamResultsWorkbook } from './reports.service.js';

beforeEach(() => {
  mocks.examAttemptFindMany.mockReset();
  mocks.enrollmentFindMany.mockReset();
});

describe('buildExamResultsWorkbook', () => {
  it('builds a workbook with one row per attempt', async () => {
    mocks.examAttemptFindMany.mockResolvedValue([
      {
        id: 1n,
        attemptNumber: 1,
        status: 'GRADED',
        startedAt: new Date('2026-01-01T00:00:00Z'),
        submittedAt: new Date('2026-01-01T00:10:00Z'),
        score: 8,
        maxScore: 10,
        scorePct: { toString: () => '80.00' },
        passed: true,
        exam: { title: 'Safety 101', course: { title: 'Onboarding' } },
        user: {
          email: 'a@example.com',
          firstName: 'A',
          lastName: 'B',
          department: { name: 'Ops' },
        },
      },
    ]);

    const wb = await buildExamResultsWorkbook();
    const sheet = wb.getWorksheet('Exam Results');
    expect(sheet).toBeDefined();
    expect(sheet!.rowCount).toBe(2);
    expect(sheet!.getRow(2).getCell('email').value).toBe('a@example.com');
    expect(sheet!.getRow(2).getCell('scorePct').value).toBe('80.00');
    expect(sheet!.getRow(2).getCell('passed').value).toBe('Yes');
  });

  it('filters by examId and submittedAt date range', async () => {
    mocks.examAttemptFindMany.mockResolvedValue([]);
    const examId = 42n;
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-01-31T00:00:00Z');

    await buildExamResultsWorkbook({ examId, from, to });

    const where = mocks.examAttemptFindMany.mock.calls[0][0].where;
    expect(where.examId).toBe(examId);
    expect(where.submittedAt).toEqual({ gte: from, lte: to });
  });

  it('omits the where clause entirely when no filter is given', async () => {
    mocks.examAttemptFindMany.mockResolvedValue([]);
    await buildExamResultsWorkbook();
    expect(mocks.examAttemptFindMany.mock.calls[0][0].where).toEqual({});
  });
});

describe('buildCourseCompletionWorkbook', () => {
  it('builds a workbook with one row per enrollment, excluding soft-deleted', async () => {
    mocks.enrollmentFindMany.mockResolvedValue([
      {
        id: 5n,
        status: 'COMPLETED',
        progressPct: 100,
        enrolledAt: new Date('2026-01-01T00:00:00Z'),
        startedAt: new Date('2026-01-02T00:00:00Z'),
        completedAt: new Date('2026-01-10T00:00:00Z'),
        dueAt: null,
        course: { title: 'Onboarding' },
        user: { email: 'c@example.com', firstName: 'C', lastName: 'D', department: null },
      },
    ]);

    const wb = await buildCourseCompletionWorkbook();
    const sheet = wb.getWorksheet('Course Completion');
    expect(sheet!.rowCount).toBe(2);
    expect(sheet!.getRow(2).getCell('progressPct').value).toBe(100);
    expect(sheet!.getRow(2).getCell('department').value).toBe('');

    expect(mocks.enrollmentFindMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
  });
});
