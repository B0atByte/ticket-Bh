import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { awardSafely } from '../points/points.service.js';
import type { UpsertProgressInput } from './lesson-progress.schema.js';

/** All of a user's lesson-progress rows for a single course (for resuming + % done). */
export async function listByCourse(courseId: bigint, userId: bigint) {
  return prisma.lessonProgress.findMany({
    where: {
      userId,
      lesson: { module: { courseId }, deletedAt: null },
    },
    select: {
      id: true,
      lessonId: true,
      userId: true,
      status: true,
      secondsWatched: true,
      lastPositionSec: true,
      completedAt: true,
      updatedAt: true,
    },
  });
}

export async function getProgress(lessonId: bigint, userId: bigint) {
  return prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: {
      id: true,
      lessonId: true,
      userId: true,
      status: true,
      secondsWatched: true,
      lastPositionSec: true,
      completedAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Anti-AFK kick: reset a lesson's progress to the start so the learner must
 * re-watch. Deliberately only touches LessonProgress — enrollment and exam
 * eligibility are untouched ("ไม่เสียสิทธิ์สอบ").
 */
export async function resetProgress(lessonId: bigint, userId: bigint) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, deletedAt: null },
    select: { id: true },
  });
  if (!lesson) throw HttpError.notFound('Lesson not found');

  return prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      status: 'IN_PROGRESS',
      secondsWatched: 0,
      lastPositionSec: 0,
      completedAt: null,
    },
    update: {
      status: 'IN_PROGRESS',
      secondsWatched: { set: 0 },
      lastPositionSec: 0,
      completedAt: null,
    },
    select: {
      id: true,
      lessonId: true,
      userId: true,
      status: true,
      secondsWatched: true,
      lastPositionSec: true,
      completedAt: true,
      updatedAt: true,
    },
  });
}

export async function upsertProgress(
  lessonId: bigint,
  userId: bigint,
  input: UpsertProgressInput,
) {
  // Validate lesson exists
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, deletedAt: null },
    select: { id: true, durationSeconds: true },
  });
  if (!lesson) throw HttpError.notFound('Lesson not found');

  // Completion is STICKY: once a lesson is done it stays done. Re-watching (which
  // saves progress at a position below the 90% mark) must never downgrade it back
  // to IN_PROGRESS. Only the explicit anti-AFK reset (resetProgress) clears it.
  const existing = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { status: true, completedAt: true, secondsWatched: true, createdAt: true },
  });
  const alreadyCompleted = existing?.status === 'COMPLETED' || existing?.completedAt != null;

  const now = new Date();

  // A timed (video) lesson has a known duration; a non-timed lesson (text/PDF/slide)
  // does not, and completion for those is the client's explicit `completed` flag.
  const isTimed = lesson.durationSeconds != null && lesson.durationSeconds > 0;

  // Anti-fast-forward: the credited watch counter can never exceed the real
  // wall-clock time elapsed since this progress row was first created (+ a grace
  // window for the player's save interval). This is an ABSOLUTE anchor (createdAt),
  // so it is immune to spamming many inflated saves — a single "I watched it all"
  // request, or 100 rapid ones, can never complete a timed lesson before enough
  // real time has actually passed. The client `completed` flag is ignored for
  // timed lessons.
  const GRACE_SEC = 30;
  const prevWatched = existing?.secondsWatched ?? 0;
  const realElapsedSec = existing
    ? Math.max(0, Math.floor((now.getTime() - existing.createdAt.getTime()) / 1000))
    : 0;
  const watchCeiling = realElapsedSec + GRACE_SEC;
  // Bounded by real elapsed time, monotonic (never drops below already-credited),
  // and (for timed lessons) never above the lesson duration.
  let effectiveWatched = Math.max(Math.min(input.secondsWatched, watchCeiling), prevWatched);
  if (isTimed) effectiveWatched = Math.min(effectiveWatched, lesson.durationSeconds!);

  let newlyComplete = false;
  if (!alreadyCompleted) {
    if (isTimed) {
      const threshold = lesson.durationSeconds! * 0.9;
      // Both conditions server-validated: reached 90% position AND actually
      // accumulated 90% of (rate-limited) watch time.
      newlyComplete = input.lastPositionSec >= threshold && effectiveWatched >= threshold;
    } else {
      newlyComplete = input.completed === true;
    }
  }
  const isComplete = alreadyCompleted || newlyComplete;

  const status = isComplete ? 'COMPLETED' : 'IN_PROGRESS';

  if (newlyComplete) {
    awardSafely({
      userId,
      type: 'LESSON_COMPLETED',
      idempotencyKey: `lesson:${lessonId.toString()}`,
      metadata: { lessonId: lessonId.toString() },
    });
  }

  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      status,
      secondsWatched: effectiveWatched,
      lastPositionSec: input.lastPositionSec,
      completedAt: isComplete ? now : null,
    },
    update: {
      status,
      // Server-clamped watch counter (anti-fast-forward); monotonic, never decreases.
      secondsWatched: { set: effectiveWatched },
      lastPositionSec: input.lastPositionSec,
      // Set on the completing save; leave untouched afterwards (preserves original date).
      completedAt: newlyComplete ? now : undefined,
    },
    select: {
      id: true,
      lessonId: true,
      userId: true,
      status: true,
      secondsWatched: true,
      lastPositionSec: true,
      completedAt: true,
      updatedAt: true,
    },
  });

  // Keep the enrollment's status + progressPct in sync. Runs after the row above
  // is committed so the completed-lesson count includes this update.
  void syncEnrollmentProgress(lessonId, userId);

  return progress;
}

/**
 * Keep the learner's enrollment in sync with their lesson progress:
 *  - ASSIGNED → IN_PROGRESS as soon as they start a lesson (sets startedAt)
 *  - progressPct = completed required lessons / total required lessons
 *  - → COMPLETED when every required lesson is done (awards COURSE_COMPLETED XP once)
 * Never downgrades an enrollment that is already COMPLETED, and leaves
 * WITHDRAWN / EXPIRED enrollments untouched.
 */
async function syncEnrollmentProgress(lessonId: bigint, userId: bigint) {
  try {
    // Walk up: lesson → module → course
    const row = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { module: { select: { courseId: true } } },
    });
    const courseId = row?.module?.courseId;
    if (!courseId) return;

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true, status: true, startedAt: true },
    });
    if (!enrollment) return; // not enrolled — nothing to track
    if (enrollment.status === 'WITHDRAWN' || enrollment.status === 'EXPIRED') return;

    const totalRequired = await prisma.lesson.count({
      where: { module: { courseId }, deletedAt: null, isRequired: true },
    });
    if (totalRequired === 0) return;

    const completedRequired = await prisma.lessonProgress.count({
      where: {
        userId,
        status: 'COMPLETED',
        lesson: { module: { courseId }, deletedAt: null, isRequired: true },
      },
    });

    const progressPct = Math.round((completedRequired / totalRequired) * 100);
    const isDone = completedRequired >= totalRequired;

    // Already complete: only keep the percentage honest, never downgrade.
    if (enrollment.status === 'COMPLETED') {
      if (progressPct !== 100) {
        await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { progressPct: 100 },
        });
      }
      return;
    }

    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: isDone ? 'COMPLETED' : 'IN_PROGRESS',
        progressPct,
        startedAt: enrollment.startedAt ?? new Date(),
        completedAt: isDone ? new Date() : null,
      },
    });

    if (isDone) {
      awardSafely({
        userId,
        type: 'COURSE_COMPLETED',
        idempotencyKey: `course:${courseId.toString()}`,
        metadata: { courseId: courseId.toString() },
      });
    }
  } catch {
    // Non-critical — don't surface to the learner if this fails
  }
}
