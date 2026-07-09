import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { paginated, skipTake } from '../../utils/pagination.js';
import { deriveCourseStarStatus } from '../me/me.service.js';
import type { AssignEnrollmentInput, EnrollmentListQuery, UpdateEnrollmentStatusInput } from './enrollments.schema.js';

const ENROLLMENT_SELECT = {
  id: true,
  userId: true,
  courseId: true,
  status: true,
  progressPct: true,
  enrolledAt: true,
  startedAt: true,
  completedAt: true,
  dueAt: true,
  expiresAt: true,
  assignedById: true,
  manualStarGrantedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** True when the course is locked behind an unlock code (some other course unlocks it). */
async function courseNeedsUnlockCode(courseId: bigint): Promise<boolean> {
  const n = await prisma.course.count({ where: { unlockNextCourseId: courseId, deletedAt: null } });
  return n > 0;
}

export async function selfEnroll(userId: bigint, courseId: bigint) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null, status: 'PUBLISHED' },
    select: { id: true, title: true },
  });
  if (!course) throw HttpError.notFound('ไม่พบหลักสูตร หรือหลักสูตรยังไม่ได้เผยแพร่');

  // Block if already actively enrolled
  const active = await prisma.enrollment.findFirst({
    where: { userId, courseId, deletedAt: null },
  });
  if (active) throw HttpError.conflict('ลงทะเบียนเรียนหลักสูตรนี้อยู่แล้ว');

  // Course is gated behind an unlock code — must redeem a code instead of self-enrolling.
  if (await courseNeedsUnlockCode(courseId)) {
    throw HttpError.forbidden('หลักสูตรนี้ต้องใช้โค้ดปลดล็อก — กรอกโค้ดที่ได้รับจากการสอบผ่านหลักสูตรก่อนหน้า');
  }

  // Restore a previously soft-deleted enrollment instead of creating a new one
  // (unique constraint is on userId+courseId without deletedAt)
  const deleted = await prisma.enrollment.findFirst({
    where: { userId, courseId, deletedAt: { not: null } },
  });
  if (deleted) {
    return prisma.enrollment.update({
      where: { id: deleted.id },
      data: {
        deletedAt: null,
        status: 'ASSIGNED',
        progressPct: 0,
        startedAt: null,
        completedAt: null,
        enrolledAt: new Date(),
      },
      select: ENROLLMENT_SELECT,
    });
  }

  return prisma.enrollment.create({
    data: { userId, courseId, status: 'ASSIGNED' },
    select: ENROLLMENT_SELECT,
  });
}

export async function selfUnenroll(userId: bigint, courseId: bigint) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId, deletedAt: null },
  });
  if (!enrollment) throw HttpError.notFound('ไม่พบข้อมูลการลงทะเบียน');

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { deletedAt: new Date() },
  });
}

export async function listMine(userId: bigint, query: EnrollmentListQuery) {
  const where = { userId, deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      ...skipTake(query.page, query.pageSize),
      orderBy: { enrolledAt: 'desc' },
      select: {
        ...ENROLLMENT_SELECT,
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            summary: true,
            estimatedMinutes: true,
            status: true,
          },
        },
      },
    }),
    prisma.enrollment.count({ where }),
  ]);
  return paginated(items, total, query.page, query.pageSize);
}

export async function getMyEnrollment(userId: bigint, courseId: bigint) {
  return prisma.enrollment.findFirst({
    where: { userId, courseId, deletedAt: null },
    select: ENROLLMENT_SELECT,
  });
}

export async function adminAssign(assignedById: bigint, courseId: bigint, input: AssignEnrollmentInput) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null },
    select: { id: true },
  });
  if (!course) throw HttpError.notFound('ไม่พบหลักสูตร');

  const user = await prisma.user.findFirst({
    where: { id: input.userId, deletedAt: null },
    select: { id: true },
  });
  if (!user) throw HttpError.notFound('ไม่พบผู้ใช้');

  const existing = await prisma.enrollment.findFirst({
    where: { userId: input.userId, courseId, deletedAt: null },
  });
  if (existing) throw HttpError.conflict('ผู้ใช้นี้ลงทะเบียนเรียนหลักสูตรนี้อยู่แล้ว');

  // Restore a previously soft-deleted enrollment instead of creating a new one
  // (unique constraint is on userId+courseId without deletedAt)
  const deleted = await prisma.enrollment.findFirst({
    where: { userId: input.userId, courseId, deletedAt: { not: null } },
  });
  if (deleted) {
    return prisma.enrollment.update({
      where: { id: deleted.id },
      data: {
        deletedAt: null,
        status: 'ASSIGNED',
        progressPct: 0,
        startedAt: null,
        completedAt: null,
        enrolledAt: new Date(),
        dueAt: input.dueAt,
        assignedById,
      },
      select: ENROLLMENT_SELECT,
    });
  }

  return prisma.enrollment.create({
    data: {
      userId: input.userId,
      courseId,
      status: 'ASSIGNED',
      dueAt: input.dueAt,
      assignedById,
    },
    select: ENROLLMENT_SELECT,
  });
}

export async function listByCourse(courseId: bigint, query: EnrollmentListQuery) {
  const where = { courseId, deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      ...skipTake(query.page, query.pageSize),
      orderBy: { enrolledAt: 'desc' },
      select: {
        ...ENROLLMENT_SELECT,
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    }),
    prisma.enrollment.count({ where }),
  ]);

  // Per-learner star status: lessons complete + passed all published post-tests
  // + (if configured) a PASSED practical evaluation.
  const postTests = await prisma.exam.findMany({
    where: { courseId, type: 'POST_TEST', status: 'PUBLISHED', deletedAt: null },
    select: { id: true },
  });
  const postTestIds = postTests.map((p) => p.id);
  const userIds = items.map((e) => e.userId);

  const practicalCriteriaCount = await prisma.practicalEvaluationCriterion.count({
    where: { courseId, deletedAt: null },
  });
  const hasPracticalEval = practicalCriteriaCount > 0;
  const enrollmentIds = items.map((e) => e.id);
  const practicalEvaluations = await prisma.practicalEvaluation.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    select: { enrollmentId: true, result: true },
  });
  const practicalResultByEnrollment = new Map(
    practicalEvaluations.map((p) => [p.enrollmentId.toString(), p.result]),
  );

  const attempts =
    postTestIds.length === 0 || userIds.length === 0
      ? []
      : await prisma.examAttempt.findMany({
          where: {
            userId: { in: userIds },
            examId: { in: postTestIds },
            status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'GRADED'] },
          },
          select: { userId: true, examId: true, passed: true },
        });

  const passedByUser = new Map<string, Set<string>>();
  const attemptsByUser = new Map<string, number>();
  for (const a of attempts) {
    const uk = a.userId.toString();
    attemptsByUser.set(uk, (attemptsByUser.get(uk) ?? 0) + 1);
    if (a.passed) {
      const set = passedByUser.get(uk) ?? new Set<string>();
      set.add(a.examId.toString());
      passedByUser.set(uk, set);
    }
  }

  const withStatus = items.map((e) => {
    const uk = e.userId.toString();
    const passedSet = passedByUser.get(uk) ?? new Set<string>();
    const hasPostTest = postTestIds.length > 0;
    const passedAllPostTests =
      hasPostTest && postTestIds.every((id) => passedSet.has(id.toString()));
    const postTestAttempts = attemptsByUser.get(uk) ?? 0;
    const manualStarGranted = e.manualStarGrantedAt != null;
    const practicalResult = practicalResultByEnrollment.get(e.id.toString()) ?? null;
    return {
      ...e,
      hasPostTest,
      postTestAttempts,
      manualStarGranted,
      hasPracticalEval,
      practicalResult,
      starStatus: deriveCourseStarStatus({
        progressPct: e.progressPct,
        hasPostTest,
        passedAllPostTests,
        postTestAttempts,
        manualStarGranted,
        hasPracticalEval,
        practicalResult,
      }),
    };
  });

  return paginated(withStatus, total, query.page, query.pageSize);
}

export async function updateStatus(id: bigint, actorId: bigint, input: UpdateEnrollmentStatusInput) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { id, deletedAt: null },
  });
  if (!enrollment) throw HttpError.notFound('ไม่พบข้อมูลการลงทะเบียน');

  return prisma.enrollment.update({
    where: { id },
    data: {
      status: input.status,
      completedAt: input.status === 'COMPLETED' ? new Date() : undefined,
    },
    select: ENROLLMENT_SELECT,
  });
}

export async function adminWithdraw(id: bigint) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { id, deletedAt: null },
  });
  if (!enrollment) throw HttpError.notFound('ไม่พบข้อมูลการลงทะเบียน');

  await prisma.enrollment.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'WITHDRAWN' },
  });
}

/** SUPER_ADMIN manually grants the course star to a learner (prior offline training). */
export async function grantStar(id: bigint, grantedById: bigint) {
  const enrollment = await prisma.enrollment.findFirst({ where: { id, deletedAt: null } });
  if (!enrollment) throw HttpError.notFound('ไม่พบข้อมูลการลงทะเบียน');

  return prisma.enrollment.update({
    where: { id },
    data: { manualStarGrantedAt: new Date(), manualStarGrantedById: grantedById },
    select: ENROLLMENT_SELECT,
  });
}

/** Revoke a previously granted manual star. */
export async function revokeStar(id: bigint) {
  const enrollment = await prisma.enrollment.findFirst({ where: { id, deletedAt: null } });
  if (!enrollment) throw HttpError.notFound('ไม่พบข้อมูลการลงทะเบียน');

  return prisma.enrollment.update({
    where: { id },
    data: { manualStarGrantedAt: null, manualStarGrantedById: null },
    select: ENROLLMENT_SELECT,
  });
}

/**
 * Admin re-issues an unlock code for a learner + target course (e.g. they lost theirs).
 * Reuses an existing unused code if present, otherwise generates a fresh one.
 */
export async function issueUnlockCode(userId: bigint, courseId: bigint) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null },
    select: { title: true },
  });
  if (!course) throw HttpError.notFound('ไม่พบหลักสูตรปลายทาง');

  let row = await prisma.courseUnlockCode.findFirst({
    where: { userId, courseId, usedAt: null },
    select: { code: true },
  });
  if (!row) {
    const code = `UL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    row = await prisma.courseUnlockCode.create({ data: { code, userId, courseId }, select: { code: true } });
  }
  return { code: row.code, courseId: courseId.toString(), courseTitle: course.title };
}

/**
 * Redeem an unlock code: validates it belongs to this user and is unused, then
 * enrolls them in the target course and marks the code consumed.
 */
export async function redeemUnlockCode(userId: bigint, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const row = await prisma.courseUnlockCode.findFirst({
    where: { code, userId, usedAt: null },
    select: { id: true, courseId: true, course: { select: { title: true, deletedAt: true, status: true } } },
  });
  if (!row) throw HttpError.badRequest('โค้ดไม่ถูกต้อง หรือถูกใช้ไปแล้ว');
  if (row.course.deletedAt != null || row.course.status !== 'PUBLISHED') {
    throw HttpError.badRequest('หลักสูตรปลายทางไม่พร้อมใช้งาน');
  }

  // Anti-skip: the learner must have actually PASSED a prerequisite course
  // (one whose "next course" is this target). Blocks codes from being passed around.
  const sources = await prisma.course.findMany({
    where: { unlockNextCourseId: row.courseId, deletedAt: null },
    select: { id: true },
  });
  if (sources.length > 0) {
    const passed = await prisma.examAttempt.findFirst({
      where: {
        userId,
        passed: true,
        status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'GRADED'] },
        exam: { courseId: { in: sources.map((s) => s.id) }, deletedAt: null },
      },
      select: { id: true },
    });
    if (!passed) {
      throw HttpError.forbidden('ยังไม่ผ่านการสอบของหลักสูตรก่อนหน้า — ปลดล็อกไม่ได้');
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.courseUnlockCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });

    const existing = await tx.enrollment.findFirst({
      where: { userId, courseId: row.courseId },
    });
    const enrollment = existing
      ? await tx.enrollment.update({
          where: { id: existing.id },
          data: { deletedAt: null, status: 'ASSIGNED', enrolledAt: new Date() },
          select: ENROLLMENT_SELECT,
        })
      : await tx.enrollment.create({
          data: { userId, courseId: row.courseId, status: 'ASSIGNED' },
          select: ENROLLMENT_SELECT,
        });
    return { enrollment, courseId: row.courseId.toString(), courseTitle: row.course.title };
  });
}
