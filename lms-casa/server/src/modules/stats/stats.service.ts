import { prisma } from '../../config/db.js';
import { cacheJson } from '../../utils/cache.js';

/** Admin dashboard is the hottest aggregate (9 queries/hit); cache briefly. */
const ADMIN_STATS_TTL_SEC = 30;

export interface PersonalStats {
  enrollments: { total: number; inProgress: number; completed: number };
  hoursWatched: number;
  attempts: { total: number; passed: number; passRate: number };
  recentAttempts: Array<{
    id: string;
    examTitle: string;
    scorePct: string | null;
    passed: boolean | null;
    submittedAt: Date | null;
  }>;
  progressOverTime: Array<{ date: string; minutes: number }>;
}

export async function personalStats(userId: bigint): Promise<PersonalStats> {
  const [enrollments, progressAgg, attempts, recent, recentLessons] = await Promise.all([
    prisma.enrollment.groupBy({
      where: { userId, deletedAt: null },
      by: ['status'],
      _count: { status: true },
    }),
    prisma.lessonProgress.aggregate({
      where: { userId },
      _sum: { secondsWatched: true },
    }),
    prisma.examAttempt.findMany({
      where: { userId, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'GRADED'] } },
      select: { id: true, passed: true },
    }),
    prisma.examAttempt.findMany({
      where: {
        userId,
        submittedAt: { not: null },
      },
      orderBy: { submittedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        scorePct: true,
        passed: true,
        submittedAt: true,
        exam: { select: { title: true } },
      },
    }),
    prisma.lessonProgress.findMany({
      where: {
        userId,
        updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { secondsWatched: true, updatedAt: true },
    }),
  ]);

  const enrollMap: Record<string, number> = {};
  for (const e of enrollments) enrollMap[e.status] = e._count.status;
  const total = enrollments.reduce((s, e) => s + e._count.status, 0);
  const completed = enrollMap['COMPLETED'] ?? 0;
  const inProgress = (enrollMap['IN_PROGRESS'] ?? 0) + (enrollMap['ASSIGNED'] ?? 0);

  const passedCount = attempts.filter((a) => a.passed === true).length;

  // bucket by day (UTC)
  const buckets = new Map<string, number>();
  for (const lp of recentLessons) {
    const key = lp.updatedAt.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + lp.secondsWatched);
  }
  const progressOverTime = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, seconds]) => ({ date, minutes: Math.round(seconds / 60) }));

  return {
    enrollments: { total, inProgress, completed },
    hoursWatched: Math.round((progressAgg._sum.secondsWatched ?? 0) / 360) / 10,
    attempts: {
      total: attempts.length,
      passed: passedCount,
      passRate: attempts.length === 0 ? 0 : Math.round((passedCount / attempts.length) * 100),
    },
    recentAttempts: recent.map((r) => ({
      id: r.id.toString(),
      examTitle: r.exam.title,
      scorePct: r.scorePct?.toString() ?? null,
      passed: r.passed,
      submittedAt: r.submittedAt,
    })),
    progressOverTime,
  };
}

export async function managerStats(managerId: bigint) {
  const reports = await prisma.user.findMany({
    where: { managerId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      enrollments: {
        where: { deletedAt: null },
        select: { status: true, progressPct: true, dueAt: true },
      },
      attempts: {
        where: { status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'GRADED'] } },
        select: { passed: true, scorePct: true },
      },
    },
  });

  const now = new Date();
  return reports.map((u) => {
    const overdue = u.enrollments.filter(
      (e) => e.dueAt && e.dueAt < now && e.status !== 'COMPLETED',
    ).length;
    const completedCount = u.enrollments.filter((e) => e.status === 'COMPLETED').length;
    const totalEnroll = u.enrollments.length;
    const avgProgress =
      totalEnroll === 0
        ? 0
        : Math.round(u.enrollments.reduce((s, e) => s + e.progressPct, 0) / totalEnroll);
    const passed = u.attempts.filter((a) => a.passed === true).length;
    return {
      userId: u.id.toString(),
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      enrollments: { total: totalEnroll, completed: completedCount, overdue },
      avgProgress,
      attempts: { total: u.attempts.length, passed },
    };
  });
}

export async function adminStats() {
  return cacheJson('stats:admin', ADMIN_STATS_TTL_SEC, computeAdminStats);
}

async function computeAdminStats() {
  const [
    totalUsers,
    totalCourses,
    publishedCourses,
    totalExams,
    enrollAgg,
    attemptAgg,
    statusGroups,
    recentEnrollments,
    topCourses,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.course.count({ where: { deletedAt: null } }),
    prisma.course.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
    prisma.exam.count({ where: { deletedAt: null } }),
    prisma.enrollment.aggregate({
      where: { deletedAt: null },
      _avg: { progressPct: true },
      _count: { _all: true },
    }),
    prisma.examAttempt.aggregate({
      where: { status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'GRADED'] } },
      _avg: { scorePct: true },
      _count: { _all: true },
    }),
    prisma.enrollment.groupBy({
      where: { deletedAt: null },
      by: ['status'],
      _count: { status: true },
    }),
    prisma.enrollment.findMany({
      where: { deletedAt: null, enrolledAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
      select: { enrolledAt: true },
    }),
    prisma.course.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        title: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { enrollments: { _count: 'desc' } },
      take: 5,
    }),
  ]);

  const enrollByDay = new Map<string, number>();
  for (const e of recentEnrollments) {
    const key = e.enrolledAt.toISOString().slice(0, 10);
    enrollByDay.set(key, (enrollByDay.get(key) ?? 0) + 1);
  }

  return {
    totals: {
      users: totalUsers,
      courses: totalCourses,
      publishedCourses,
      exams: totalExams,
      enrollments: enrollAgg._count._all,
      attempts: attemptAgg._count._all,
    },
    averages: {
      progressPct: Math.round(enrollAgg._avg.progressPct ?? 0),
      examScorePct: Math.round(Number(attemptAgg._avg.scorePct ?? 0)),
    },
    enrollmentStatus: statusGroups.map((g) => ({ status: g.status, count: g._count.status })),
    enrollmentsOverTime: [...enrollByDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, count]) => ({ date, count })),
    topCourses: topCourses.map((c) => ({
      id: c.id.toString(),
      title: c.title,
      enrollments: c._count.enrollments,
    })),
  };
}
