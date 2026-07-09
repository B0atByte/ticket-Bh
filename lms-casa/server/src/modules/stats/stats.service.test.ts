import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  enrollGroupBy: vi.fn(),
  enrollAggregate: vi.fn(),
  enrollFindMany: vi.fn(),
  lpAggregate: vi.fn(),
  lpFindMany: vi.fn(),
  attemptFindMany: vi.fn(),
  attemptAggregate: vi.fn(),
  userFindMany: vi.fn(),
  userCount: vi.fn(),
  courseCount: vi.fn(),
  courseFindMany: vi.fn(),
  examCount: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    enrollment: {
      groupBy: mocks.enrollGroupBy,
      aggregate: mocks.enrollAggregate,
      findMany: mocks.enrollFindMany,
    },
    lessonProgress: { aggregate: mocks.lpAggregate, findMany: mocks.lpFindMany },
    examAttempt: { findMany: mocks.attemptFindMany, aggregate: mocks.attemptAggregate },
    user: { findMany: mocks.userFindMany, count: mocks.userCount },
    course: { count: mocks.courseCount, findMany: mocks.courseFindMany },
    exam: { count: mocks.examCount },
  },
}));

import { personalStats, managerStats, adminStats } from './stats.service.js';

describe('stats.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  describe('personalStats', () => {
    it('aggregates enrollments + hours + attempts', async () => {
      mocks.enrollGroupBy.mockResolvedValueOnce([
        { status: 'COMPLETED', _count: { status: 2 } },
        { status: 'IN_PROGRESS', _count: { status: 1 } },
        { status: 'ASSIGNED', _count: { status: 1 } },
      ]);
      mocks.lpAggregate.mockResolvedValueOnce({ _sum: { secondsWatched: 7200 } });
      mocks.attemptFindMany.mockResolvedValueOnce([
        { id: 1n, passed: true },
        { id: 2n, passed: false },
        { id: 3n, passed: true },
      ]);
      mocks.attemptFindMany.mockResolvedValueOnce([
        {
          id: 9n,
          scorePct: 85,
          passed: true,
          submittedAt: new Date('2026-01-01'),
          exam: { title: 'Final' },
        },
      ]);
      mocks.lpFindMany.mockResolvedValueOnce([
        { secondsWatched: 600, updatedAt: new Date('2026-01-01T00:00:00Z') },
        { secondsWatched: 1200, updatedAt: new Date('2026-01-01T12:00:00Z') },
        { secondsWatched: 300, updatedAt: new Date('2026-01-02T00:00:00Z') },
      ]);
      const out = await personalStats(1n);
      expect(out.enrollments.total).toBe(4);
      expect(out.enrollments.completed).toBe(2);
      expect(out.enrollments.inProgress).toBe(2);
      expect(out.hoursWatched).toBeCloseTo(2, 1);
      expect(out.attempts.total).toBe(3);
      expect(out.attempts.passed).toBe(2);
      expect(out.attempts.passRate).toBe(67);
      expect(out.recentAttempts).toHaveLength(1);
      expect(out.recentAttempts[0].examTitle).toBe('Final');
      // 2 buckets: 2026-01-01 (1800s = 30 min) and 2026-01-02 (300s = 5 min)
      expect(out.progressOverTime).toHaveLength(2);
      expect(out.progressOverTime[0].minutes).toBe(30);
      expect(out.progressOverTime[1].minutes).toBe(5);
    });

    it('handles empty data — passRate 0, no buckets', async () => {
      mocks.enrollGroupBy.mockResolvedValueOnce([]);
      mocks.lpAggregate.mockResolvedValueOnce({ _sum: { secondsWatched: null } });
      mocks.attemptFindMany.mockResolvedValueOnce([]);
      mocks.attemptFindMany.mockResolvedValueOnce([]);
      mocks.lpFindMany.mockResolvedValueOnce([]);
      const out = await personalStats(1n);
      expect(out.attempts.passRate).toBe(0);
      expect(out.progressOverTime).toEqual([]);
      expect(out.hoursWatched).toBe(0);
    });
  });

  describe('managerStats', () => {
    it('returns per-employee summary with overdue', async () => {
      const past = new Date('2024-01-01');
      mocks.userFindMany.mockResolvedValueOnce([
        {
          id: 5n,
          firstName: 'A',
          lastName: 'B',
          email: 'a@b.com',
          enrollments: [
            { status: 'IN_PROGRESS', progressPct: 50, dueAt: past },
            { status: 'COMPLETED', progressPct: 100, dueAt: null },
          ],
          attempts: [{ passed: true }, { passed: false }, { passed: true }],
        },
      ]);
      const out = await managerStats(1n);
      expect(out).toHaveLength(1);
      expect(out[0].name).toBe('A B');
      expect(out[0].enrollments.total).toBe(2);
      expect(out[0].enrollments.completed).toBe(1);
      expect(out[0].enrollments.overdue).toBe(1);
      expect(out[0].avgProgress).toBe(75);
      expect(out[0].attempts.passed).toBe(2);
    });

    it('handles user with no enrollments', async () => {
      mocks.userFindMany.mockResolvedValueOnce([
        {
          id: 5n,
          firstName: 'A',
          lastName: 'B',
          email: 'a@b.com',
          enrollments: [],
          attempts: [],
        },
      ]);
      const out = await managerStats(1n);
      expect(out[0].avgProgress).toBe(0);
      expect(out[0].enrollments.total).toBe(0);
    });
  });

  describe('adminStats', () => {
    it('aggregates totals + averages + topCourses', async () => {
      mocks.userCount.mockResolvedValueOnce(100);
      mocks.courseCount.mockResolvedValueOnce(20);
      mocks.courseCount.mockResolvedValueOnce(15);
      mocks.examCount.mockResolvedValueOnce(10);
      mocks.enrollAggregate.mockResolvedValueOnce({
        _avg: { progressPct: 62.4 },
        _count: { _all: 500 },
      });
      mocks.attemptAggregate.mockResolvedValueOnce({
        _avg: { scorePct: 78.9 },
        _count: { _all: 200 },
      });
      mocks.enrollGroupBy.mockResolvedValueOnce([
        { status: 'COMPLETED', _count: { status: 250 } },
        { status: 'IN_PROGRESS', _count: { status: 250 } },
      ]);
      mocks.enrollFindMany.mockResolvedValueOnce([
        { enrolledAt: new Date('2026-01-01T00:00:00Z') },
        { enrolledAt: new Date('2026-01-01T12:00:00Z') },
        { enrolledAt: new Date('2026-01-02T00:00:00Z') },
      ]);
      mocks.courseFindMany.mockResolvedValueOnce([
        { id: 1n, title: 'A', _count: { enrollments: 30 } },
        { id: 2n, title: 'B', _count: { enrollments: 20 } },
      ]);
      const out = await adminStats();
      expect(out.totals.users).toBe(100);
      expect(out.totals.courses).toBe(20);
      expect(out.totals.publishedCourses).toBe(15);
      expect(out.totals.exams).toBe(10);
      expect(out.totals.enrollments).toBe(500);
      expect(out.totals.attempts).toBe(200);
      expect(out.averages.progressPct).toBe(62);
      expect(out.averages.examScorePct).toBe(79);
      expect(out.topCourses).toHaveLength(2);
      expect(out.topCourses[0].title).toBe('A');
    });
  });
});
