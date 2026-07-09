import crypto from 'node:crypto';
import JSZip from 'jszip';
import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { hashPassword } from '../auth/tokens.js';

function toJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
    2,
  );
}

export type CourseStarStatus = 'PASSED' | 'FAILED' | 'IN_PROGRESS' | 'NOT_STARTED';

/**
 * Shared rule for a learner's per-course "star" status.
 *  - PASSED (ดาว): a SUPER_ADMIN granted it manually, OR the course HAS a post-test
 *    and/or practical evaluation, all required lessons done, every post-test passed,
 *    AND the practical evaluation (if any) is PASSED.
 *  - FAILED (เรียนไม่ผ่าน): attempted a post-test but hasn't passed it, or the
 *    practical evaluation was marked FAILED.
 *  - IN_PROGRESS / NOT_STARTED: started vs untouched
 */
export function deriveCourseStarStatus(args: {
  progressPct: number;
  hasPostTest: boolean;
  passedAllPostTests: boolean;
  postTestAttempts: number;
  manualStarGranted?: boolean;
  hasPracticalEval?: boolean;
  practicalResult?: 'PENDING' | 'PASSED' | 'FAILED' | null;
}): CourseStarStatus {
  const {
    progressPct,
    hasPostTest,
    passedAllPostTests,
    postTestAttempts,
    manualStarGranted,
    hasPracticalEval = false,
    practicalResult = null,
  } = args;
  if (manualStarGranted) return 'PASSED'; // SUPER_ADMIN override for prior offline training
  const hasGate = hasPostTest || hasPracticalEval;
  const postTestOk = !hasPostTest || passedAllPostTests;
  const practicalOk = !hasPracticalEval || practicalResult === 'PASSED';
  const postTestFailed = postTestAttempts > 0 && !passedAllPostTests;
  const practicalFailed = hasPracticalEval && practicalResult === 'FAILED';
  if (hasGate && progressPct >= 100 && postTestOk && practicalOk) return 'PASSED';
  if (postTestFailed || practicalFailed) return 'FAILED';
  if (progressPct > 0 || postTestAttempts > 0) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

export interface CourseProgressEntry {
  courseId: string;
  status: CourseStarStatus;
  progressPct: number;
  /** Whether the course has a published post-test (a star requires one). */
  hasPostTest: boolean;
  /** Number of finished post-test attempts (for "เรียนใหม่รอบที่ N"). */
  postTestAttempts: number;
  /** Whether the course has a practical evaluation checklist (a star requires it to PASS). */
  hasPracticalEval: boolean;
  /** This learner's practical evaluation result, if any. */
  practicalResult: 'PENDING' | 'PASSED' | 'FAILED' | null;
}

/**
 * Per-course "star" status for the current learner.
 * A star (PASSED) is earned when every required lesson is done AND every
 * published POST_TEST for the course has a passing attempt. A course with no
 * post-test only needs its lessons completed.
 */
export async function getMyCourseProgress(
  userId: bigint,
): Promise<{ items: CourseProgressEntry[]; stars: number }> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, courseId: true, progressPct: true, manualStarGrantedAt: true },
  });
  if (enrollments.length === 0) return { items: [], stars: 0 };

  const courseIds = enrollments.map((e) => e.courseId);
  const enrollmentIds = enrollments.map((e) => e.id);

  const practicalCriteriaCourses = await prisma.practicalEvaluationCriterion.findMany({
    where: { courseId: { in: courseIds }, deletedAt: null },
    select: { courseId: true },
    distinct: ['courseId'],
  });
  const coursesWithPracticalEval = new Set(practicalCriteriaCourses.map((c) => c.courseId.toString()));

  const practicalEvaluations = await prisma.practicalEvaluation.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    select: { enrollmentId: true, result: true },
  });
  const practicalResultByEnrollment = new Map(
    practicalEvaluations.map((p) => [p.enrollmentId.toString(), p.result]),
  );

  const postTests = await prisma.exam.findMany({
    where: {
      courseId: { in: courseIds },
      type: 'POST_TEST',
      status: 'PUBLISHED',
      deletedAt: null,
    },
    select: { id: true, courseId: true },
  });

  const postTestsByCourse = new Map<string, string[]>();
  const examToCourse = new Map<string, string>();
  for (const pt of postTests) {
    if (pt.courseId == null) continue;
    const courseKey = pt.courseId.toString();
    examToCourse.set(pt.id.toString(), courseKey);
    const arr = postTestsByCourse.get(courseKey) ?? [];
    arr.push(pt.id.toString());
    postTestsByCourse.set(courseKey, arr);
  }

  const postTestIds = postTests.map((p) => p.id);
  const attempts =
    postTestIds.length === 0
      ? []
      : await prisma.examAttempt.findMany({
          where: {
            userId,
            examId: { in: postTestIds },
            status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'GRADED'] },
          },
          select: { examId: true, passed: true },
        });

  const passedByCourse = new Map<string, Set<string>>();
  const attemptsByCourse = new Map<string, number>();
  for (const a of attempts) {
    const courseKey = examToCourse.get(a.examId.toString());
    if (!courseKey) continue;
    attemptsByCourse.set(courseKey, (attemptsByCourse.get(courseKey) ?? 0) + 1);
    if (a.passed) {
      const set = passedByCourse.get(courseKey) ?? new Set<string>();
      set.add(a.examId.toString());
      passedByCourse.set(courseKey, set);
    }
  }

  const items: CourseProgressEntry[] = enrollments.map((e) => {
    const courseKey = e.courseId.toString();
    const requiredPostTests = postTestsByCourse.get(courseKey) ?? [];
    const passedSet = passedByCourse.get(courseKey) ?? new Set<string>();
    const hasPostTest = requiredPostTests.length > 0;
    const passedAllPostTests =
      hasPostTest && requiredPostTests.every((id) => passedSet.has(id));
    const postTestAttempts = attemptsByCourse.get(courseKey) ?? 0;
    const hasPracticalEval = coursesWithPracticalEval.has(courseKey);
    const practicalResult = practicalResultByEnrollment.get(e.id.toString()) ?? null;
    const status = deriveCourseStarStatus({
      progressPct: e.progressPct,
      hasPostTest,
      passedAllPostTests,
      postTestAttempts,
      manualStarGranted: e.manualStarGrantedAt != null,
      hasPracticalEval,
      practicalResult,
    });

    return {
      courseId: courseKey,
      status,
      progressPct: e.progressPct,
      hasPostTest,
      postTestAttempts,
      hasPracticalEval,
      practicalResult,
    };
  });

  const stars = items.filter((i) => i.status === 'PASSED').length;
  return { items, stars };
}

export async function exportMyData(userId: bigint): Promise<Buffer> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      phone: true,
      avatarUrl: true,
      locale: true,
      status: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      department: { select: { id: true, name: true, code: true } },
      position: { select: { id: true, name: true, code: true } },
      userRoles: { select: { role: { select: { key: true, name: true } } } },
    },
  });
  if (!user) throw HttpError.notFound('User not found');

  const [
    enrollments,
    lessonProgress,
    lessonNotes,
    attempts,
    courseQuestions,
    courseAnswers,
    notifications,
    uploadedFiles,
    auditEvents,
  ] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId, deletedAt: null },
      include: { course: { select: { id: true, title: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.lessonProgress.findMany({
      where: { userId },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            module: { select: { id: true, title: true, course: { select: { id: true, title: true } } } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.lessonNote.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        lessonId: true,
        type: true,
        content: true,
        timestampSec: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.examAttempt.findMany({
      where: { userId },
      include: {
        exam: { select: { id: true, title: true } },
        responses: {
          select: {
            id: true,
            questionId: true,
            selectedOptionIds: true,
            textAnswer: true,
            pointsEarned: true,
            isCorrect: true,
            feedback: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.courseQuestion.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, courseId: true, title: true, body: true, isPinned: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.courseAnswer.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, questionId: true, body: true, isAccepted: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.findMany({
      where: { userId },
      select: { id: true, type: true, title: true, body: true, data: true, readAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.file.findMany({
      where: { uploadedById: userId, deletedAt: null },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        url: true,
        checksum: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { actorId: userId },
      select: { id: true, action: true, entityType: true, entityId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
  ]);

  const zip = new JSZip();
  zip.file('profile.json', toJson(user));
  zip.file('learning.json', toJson({ enrollments, lessonProgress, lessonNotes }));
  zip.file('exams.json', toJson({ attempts }));
  zip.file('community.json', toJson({ courseQuestions, courseAnswers }));
  zip.file('notifications.json', toJson({ notifications }));
  zip.file('files.json', toJson({ uploadedFiles }));
  zip.file('audit-events.json', toJson({ auditEvents }));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function anonymizeMe(userId: bigint): Promise<{ id: string; deletedAt: Date }> {
  const existing = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw HttpError.notFound('User not found');

  const deletedAt = new Date();
  const suffix = `${userId.toString()}-${deletedAt.getTime()}`;
  const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));

  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: deletedAt },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${suffix}@deleted.lmscasa.local`,
        passwordHash,
        firstName: 'Deleted',
        lastName: 'User',
        employeeId: null,
        phone: null,
        avatarUrl: null,
        status: 'DISABLED',
        emailVerifiedAt: null,
        lastLoginAt: null,
        departmentId: null,
        positionId: null,
        managerId: null,
        deletedAt,
      },
    }),
  ]);

  return { id: userId.toString(), deletedAt };
}
