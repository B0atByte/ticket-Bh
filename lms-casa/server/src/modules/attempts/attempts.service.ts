import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { paginated, skipTake } from '../../utils/pagination.js';
import { gradeResponse, MANUAL_GRADE_TYPES } from './grading.js';
import type { AttemptListQuery, SaveResponseInput } from './attempts.schema.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { sendExamResult } from '../email-templates/email-templates.js';
import { awardSafely } from '../points/points.service.js';

// ─── types ───────────────────────────────────────────────────────────────────

type QuestionOptionRow = {
  id: bigint;
  text: string;
  imageUrl: string | null;
  orderIndex: number;
  isCorrect: boolean;
  meta: Prisma.JsonValue;
};

type ExamQuestionRow = {
  id: bigint;
  points: number;
  orderIndex: number;
  question: {
    id: bigint;
    type: string;
    difficulty: string;
    text: string;
    defaultPoints: number;
    meta: Prisma.JsonValue;
    deletedAt: Date | null;
    options: QuestionOptionRow[];
    answers: {
      value: string;
      matchMode: string;
      caseSensitive: boolean;
      points: number;
    }[];
  };
};

// ─── constants ───────────────────────────────────────────────────────────────

const ATTEMPT_SELECT = {
  id: true,
  examId: true,
  userId: true,
  attemptNumber: true,
  status: true,
  startedAt: true,
  submittedAt: true,
  expiresAt: true,
  score: true,
  maxScore: true,
  scorePct: true,
  passed: true,
  gradedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ExamAttemptSelect;

// ─── helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    if (tmp === undefined || copy[j] === undefined) continue;
    copy[i] = copy[j] as T;
    copy[j] = tmp;
  }
  return copy;
}

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

function sanitizeQuestions(
  examQuestions: ExamQuestionRow[],
  shuffleQuestions: boolean,
  shuffleOptions: boolean,
) {
  const ordered = [...examQuestions].sort((a, b) => a.orderIndex - b.orderIndex);
  const maybeShuffled = shuffleQuestions ? shuffle(ordered) : ordered;
  return maybeShuffled.map((item) => {
    const options = [...item.question.options].sort((a, b) => a.orderIndex - b.orderIndex);
    return {
      examQuestionId: item.id,
      questionId: item.question.id,
      type: item.question.type,
      difficulty: item.question.difficulty,
      text: item.question.text,
      points: item.points,
      defaultPoints: item.question.defaultPoints,
      // Do NOT expose isCorrect or answers to client
      options: (shuffleOptions ? shuffle(options) : options).map((o) => ({
        id: o.id,
        text: o.text,
        imageUrl: o.imageUrl,
        orderIndex: o.orderIndex,
        meta: o.meta,
      })),
    };
  });
}

async function getAttemptForUser(id: bigint, userId: bigint) {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id, userId },
    select: ATTEMPT_SELECT,
  });
  if (!attempt) throw HttpError.notFound('ไม่พบข้อมูลการสอบ');
  return attempt;
}

/**
 * Random selection from question bank.
 * Picks `count` random questions from the bank, wraps them as ExamQuestionRow-like objects.
 */
async function pickRandomFromBank(
  bankId: bigint,
  count: number,
): Promise<ExamQuestionRow[]> {
  const questions = await prisma.question.findMany({
    where: { bankId, deletedAt: null },
    select: {
      id: true,
      type: true,
      difficulty: true,
      text: true,
      defaultPoints: true,
      meta: true,
      deletedAt: true,
      options: {
        orderBy: { orderIndex: 'asc' },
        select: { id: true, text: true, imageUrl: true, orderIndex: true, isCorrect: true, meta: true },
      },
      answers: {
        select: { value: true, matchMode: true, caseSensitive: true, points: true },
      },
    },
  });

  const picked = shuffle(questions).slice(0, count);
  return picked.map((q: (typeof questions)[number], idx) => ({
    id: BigInt(0), // no ExamQuestion row for random picks
    points: q.defaultPoints,
    orderIndex: idx,
    question: {
      id: q.id,
      type: q.type,
      difficulty: q.difficulty,
      text: q.text,
      defaultPoints: q.defaultPoints,
      meta: q.meta,
      deletedAt: q.deletedAt,
      options: q.options,
      answers: q.answers,
    },
  }));
}

// ─── service functions ────────────────────────────────────────────────────────

export async function listMine(userId: bigint, query: AttemptListQuery) {
  const where: Prisma.ExamAttemptWhereInput = { userId };
  if (query.examId) where.examId = query.examId;
  if (query.q) where.exam = { title: { contains: query.q }, deletedAt: null };

  const [items, total] = await Promise.all([
    prisma.examAttempt.findMany({
      where,
      ...skipTake(query.page, query.pageSize),
      orderBy: { id: 'desc' },
      select: {
        ...ATTEMPT_SELECT,
        exam: { select: { title: true, status: true } },
      },
    }),
    prisma.examAttempt.count({ where }),
  ]);

  return paginated(items, total, query.page, query.pageSize);
}

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'HR'];

export async function start(examId: bigint, userId: bigint, roles: string[] = []) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, deletedAt: null, status: 'PUBLISHED' },
    include: {
      questions: {
        orderBy: { orderIndex: 'asc' },
        include: {
          question: {
            include: {
              options: {
                orderBy: { orderIndex: 'asc' },
                select: { id: true, text: true, imageUrl: true, orderIndex: true, isCorrect: true, meta: true },
              },
              answers: {
                select: { value: true, matchMode: true, caseSensitive: true, points: true },
              },
            },
          },
        },
      },
    },
  });
  if (!exam) throw HttpError.notFound('ไม่พบข้อสอบที่เผยแพร่แล้ว');

  // Exam type access control — only applies to exams linked to a course; staff bypass
  if (exam.courseId && !roles.some((r) => STAFF_ROLES.includes(r))) {
    const { type, courseId } = exam;

    if (type === 'POST_TEST') {
      // Must have completed the course before taking this exam
      const enrollment = await prisma.enrollment.findFirst({
        where: { userId, courseId, status: 'COMPLETED', deletedAt: null },
      });
      if (!enrollment) {
        throw HttpError.forbidden('ต้องเรียนจบคอร์สก่อนจึงจะทำแบบทดสอบหลังอบรมได้');
      }
    } else if (type !== 'SURVEY') {
      // QUIZ, ASSESSMENT, PRE_TEST — must be enrolled (any active status)
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          userId,
          courseId,
          status: { in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] },
          deletedAt: null,
        },
      });
      if (!enrollment) {
        throw HttpError.forbidden('ต้องลงทะเบียนเรียนคอร์สนี้ก่อนจึงจะทำแบบทดสอบได้');
      }
    }
    // SURVEY — no restriction, anyone can take
  }

  // Attempt limit + cooldown checks
  const existingCount = await prisma.examAttempt.count({ where: { examId, userId } });
  if (exam.maxAttempts !== null && existingCount >= exam.maxAttempts) {
    throw HttpError.conflict(`ทำข้อสอบครบ ${exam.maxAttempts} ครั้งแล้ว ไม่สามารถทำเพิ่มได้`);
  }
  const latest = await prisma.examAttempt.findFirst({
    where: { examId, userId },
    orderBy: { attemptNumber: 'desc' },
  });
  if (exam.cooldownMinutes !== null && latest) {
    const anchor = latest.submittedAt ?? latest.startedAt;
    const availableAt = new Date(anchor.getTime() + exam.cooldownMinutes * 60_000);
    if (Date.now() < availableAt.getTime()) {
      const remaining = Math.ceil((availableAt.getTime() - Date.now()) / 60_000);
      throw HttpError.conflict(`ต้องรออีก ${remaining} นาทีก่อนทำข้อสอบได้อีกครั้ง`);
    }
  }

  // Resolve question list: random bank OR fixed exam questions
  let activeQuestions: ExamQuestionRow[];
  if (exam.randomFromBankId && exam.randomCount && exam.randomCount > 0) {
    activeQuestions = await pickRandomFromBank(exam.randomFromBankId, exam.randomCount);
  } else {
    activeQuestions = (exam.questions as ExamQuestionRow[]).filter(
      (item) => item.question.deletedAt === null,
    );
  }

  if (activeQuestions.length < 1) throw HttpError.badRequest('ข้อสอบนี้ยังไม่มีคำถาม กรุณาติดต่อผู้ดูแลระบบ');

  const maxScore = activeQuestions.reduce((sum, item) => sum + item.points, 0);
  const expiresAt =
    exam.timeLimitMinutes !== null
      ? new Date(Date.now() + exam.timeLimitMinutes * 60_000)
      : undefined;

  const attempt = await prisma.examAttempt.create({
    data: {
      examId,
      userId,
      attemptNumber: (latest?.attemptNumber ?? 0) + 1,
      expiresAt,
      maxScore,
      metadata: { startedFrom: 'api' },
    },
    select: ATTEMPT_SELECT,
  });

  return {
    attempt,
    questions: sanitizeQuestions(activeQuestions, exam.shuffleQuestions, exam.shuffleOptions),
    secondsPerQuestion: exam.secondsPerQuestion,
  };
}

export async function getById(id: bigint, userId: bigint) {
  const attempt = await getAttemptForUser(id, userId);
  const responses = await prisma.attemptResponse.findMany({
    where: { attemptId: id },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      questionId: true,
      selectedOptionIds: true,
      textAnswer: true,
      pointsEarned: true,
      isCorrect: true,
      feedback: true,
      gradedAt: true,
      meta: true,
    },
  });
  return { ...attempt, responses };
}

export async function saveResponse(id: bigint, userId: bigint, input: SaveResponseInput) {
  const attempt = await getAttemptForUser(id, userId);
  if (attempt.status !== 'IN_PROGRESS') throw HttpError.conflict('ส่งข้อสอบนี้ไปแล้ว');
  if (attempt.expiresAt && Date.now() > attempt.expiresAt.getTime()) {
    throw HttpError.conflict('หมดเวลาสอบแล้ว กรุณากดส่งข้อสอบ');
  }

  const examQuestion = await prisma.examQuestion.findFirst({
    where: { examId: attempt.examId, questionId: input.questionId },
    include: {
      question: {
        include: {
          options: { select: { id: true } },
        },
      },
    },
  });

  // For random-bank exams, examQuestion row may not exist — validate question belongs to bank
  if (!examQuestion) {
    const exam = await prisma.exam.findFirst({
      where: { id: attempt.examId },
      select: { randomFromBankId: true },
    });
    if (exam?.randomFromBankId) {
      const q = await prisma.question.findFirst({
        where: { id: input.questionId, bankId: exam.randomFromBankId, deletedAt: null },
      });
      if (!q) throw HttpError.badRequest('คำถามนี้ไม่ได้อยู่ในชุดข้อสอบนี้');
    } else {
      throw HttpError.badRequest('คำถามนี้ไม่ได้อยู่ในชุดข้อสอบนี้');
    }
  } else if (examQuestion.question.deletedAt !== null) {
    throw HttpError.badRequest('คำถามนี้ไม่ได้อยู่ในชุดข้อสอบนี้');
  }

  const selected = [...new Set((input.selectedOptionIds ?? []).map((v) => v.toString()))];

  // Validate option ids only for choice-based types
  if (examQuestion) {
    const CHOICE_TYPES = new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE']);
    if (CHOICE_TYPES.has(examQuestion.question.type)) {
      const allowed = new Set(examQuestion.question.options.map((o) => o.id.toString()));
      if (selected.some((optId) => !allowed.has(optId))) {
        throw HttpError.badRequest('ตัวเลือกที่เลือกไม่ได้เป็นส่วนหนึ่งของคำถามนี้');
      }
    }
  }

  return prisma.attemptResponse.upsert({
    where: { attemptId_questionId: { attemptId: id, questionId: input.questionId } },
    create: {
      attemptId: id,
      questionId: input.questionId,
      selectedOptionIds: selected,
      textAnswer: input.textAnswer,
      meta: input.meta as Prisma.InputJsonValue | undefined,
    },
    update: {
      selectedOptionIds: selected,
      textAnswer: input.textAnswer,
      pointsEarned: null,
      isCorrect: null,
      feedback: null,
      gradedAt: null,
      meta: input.meta as Prisma.InputJsonValue | undefined,
    },
    select: {
      id: true,
      attemptId: true,
      questionId: true,
      selectedOptionIds: true,
      textAnswer: true,
      pointsEarned: true,
      isCorrect: true,
      gradedAt: true,
    },
  });
}

export async function submit(id: bigint, userId: bigint) {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id, userId },
    select: {
      id: true,
      userId: true,
      examId: true,
      status: true,
      expiresAt: true,
      attemptNumber: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      exam: {
        select: {
          title: true,
          type: true,
          courseId: true,
          maxAttempts: true,
          course: { select: { title: true } },
          deletedAt: true,
          passingScore: true,
          questions: {
            select: {
              questionId: true,
              points: true,
              question: {
                select: {
                  type: true,
                  deletedAt: true,
                  meta: true,
                  options: {
                    select: { id: true, isCorrect: true, orderIndex: true, meta: true },
                  },
                  answers: {
                    select: { value: true, matchMode: true, caseSensitive: true, points: true },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        select: {
          questionId: true,
          selectedOptionIds: true,
          textAnswer: true,
          meta: true,
        },
      },
    },
  });
  if (!attempt) throw HttpError.notFound('ไม่พบข้อมูลการสอบ');
  if (attempt.status !== 'IN_PROGRESS') throw HttpError.conflict('ส่งข้อสอบนี้ไปแล้ว');
  if (attempt.exam.deletedAt !== null) throw HttpError.notFound('ไม่พบข้อสอบ');

  const now = new Date();
  const autoSubmitted = attempt.expiresAt !== null && now > attempt.expiresAt;
  const responseByQuestion = new Map(
    attempt.responses.map((r) => [r.questionId.toString(), r]),
  );

  let totalScore = 0;
  let maxScore = 0;
  let hasPendingManual = false;

  const gradedResponses = attempt.exam.questions
    .filter((item) => item.question.deletedAt === null)
    .map((item) => {
      maxScore += item.points;
      const response = responseByQuestion.get(item.questionId.toString());

      const ctx = {
        type: item.question.type,
        points: item.points,
        options: item.question.options.map((o) => ({
          id: o.id.toString(),
          isCorrect: o.isCorrect,
          orderIndex: o.orderIndex,
          meta: o.meta,
        })),
        answers: item.question.answers,
        questionMeta: item.question.meta,
      };

      const result = gradeResponse(
        ctx,
        response?.selectedOptionIds,
        response?.textAnswer,
        response?.meta,
      );

      if (MANUAL_GRADE_TYPES.has(item.question.type)) {
        hasPendingManual = true;
      } else {
        totalScore += result.pointsEarned;
      }

      return {
        questionId: item.questionId,
        pointsEarned: result.pointsEarned,
        isCorrect: result.isCorrect,
        feedback: result.feedback,
      };
    });

  const scorePct = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0;
  // PRE_TEST = diagnostic, always passes. SURVEY = no grading, always passes.
  // All other types must meet passingScore.
  const isPreTest = attempt.exam.type === 'PRE_TEST';
  const isSurvey  = attempt.exam.type === 'SURVEY';
  const passed = !hasPendingManual && (isPreTest || isSurvey || scorePct >= attempt.exam.passingScore);

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const graded of gradedResponses) {
      await tx.attemptResponse.upsert({
        where: { attemptId_questionId: { attemptId: id, questionId: graded.questionId } },
        create: {
          attemptId: id,
          questionId: graded.questionId,
          selectedOptionIds: [],
          pointsEarned: graded.pointsEarned,
          isCorrect: graded.isCorrect,
          feedback: graded.feedback,
          gradedAt: graded.isCorrect !== null ? now : null,
        },
        update: {
          pointsEarned: graded.pointsEarned,
          isCorrect: graded.isCorrect,
          feedback: graded.feedback,
          gradedAt: graded.isCorrect !== null ? now : null,
        },
      });
    }

    return tx.examAttempt.update({
      where: { id },
      data: {
        status: autoSubmitted ? 'AUTO_SUBMITTED' : 'SUBMITTED',
        submittedAt: now,
        score: Math.round(totalScore),
        maxScore,
        scorePct,
        passed,
        gradedAt: hasPendingManual ? null : now,
      },
      select: ATTEMPT_SELECT,
    });
  });

  // Failed the final allowed attempt → must re-watch the course videos.
  // Resets every lesson's progress for the exam's course so the learner starts over.
  const maxAttempts = attempt.exam.maxAttempts;
  const courseId = attempt.exam.courseId;
  const outOfAttempts =
    !passed && !isPreTest && !isSurvey && maxAttempts != null && attempt.attemptNumber >= maxAttempts;
  let videoProgressReset = false;
  if (outOfAttempts && courseId != null) {
    const r = await prisma.lessonProgress.updateMany({
      where: { userId, lesson: { module: { courseId }, deletedAt: null } },
      data: { status: 'IN_PROGRESS', lastPositionSec: 0, secondsWatched: 0, completedAt: null },
    });
    videoProgressReset = r.count > 0;
    // Keep the enrollment's percentage in sync with the reset lessons (don't touch withdrawn/expired).
    await prisma.enrollment.updateMany({
      where: { userId, courseId, deletedAt: null, status: { in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] } },
      data: { status: 'IN_PROGRESS', progressPct: 0, completedAt: null },
    });
  }

  const result = {
    attempt: updated,
    hasPendingManual,
    videoProgressReset,
    result: {
      score: updated.score,
      maxScore: updated.maxScore,
      scorePct: updated.scorePct,
      passed: updated.passed,
    },
  };

  // Award XP for passing — PRE_TEST and SURVEY are auto-pass types and never grant XP.
  if (passed && !isPreTest && !isSurvey) {
    const examIdStr = attempt.examId.toString();
    awardSafely({
      userId,
      type: 'EXAM_PASSED',
      idempotencyKey: `exam:${examIdStr}`,
      metadata: { examId: examIdStr, attemptId: updated.id.toString() },
    });
    if (scorePct >= 100) {
      awardSafely({
        userId,
        type: 'EXAM_PERFECT_SCORE',
        idempotencyKey: `exam:${examIdStr}:perfect`,
        metadata: { examId: examIdStr, attemptId: updated.id.toString() },
      });
    }
  }

  // Send exam result email (async, non-blocking) — skip if auto-submitted or pending manual grading
  if (!autoSubmitted && !hasPendingManual && attempt.user && attempt.exam) {
    const attemptUrl = `${env.APP_URL}/attempts/${updated.id}`;
    sendExamResult({
      userName: `${attempt.user.firstName} ${attempt.user.lastName}`,
      userEmail: attempt.user.email,
      courseName: attempt.exam.course?.title ?? 'Unknown Course',
      examName: attempt.exam.title,
      score: Number(updated.scorePct ?? 0),
      passed: updated.passed ?? false,
      attemptUrl,
    }).catch((e) => logger.error('Failed to send exam result email', e));
  }

  // Unlock chain: passing this course's exam issues a one-time code for the next course.
  let unlockCode: { code: string; courseId: string; courseTitle: string } | null = null;
  if (passed && !isPreTest && !isSurvey && courseId != null) {
    const src = await prisma.course.findUnique({
      where: { id: courseId },
      select: { unlockNextCourse: { select: { id: true, title: true, deletedAt: true } } },
    });
    const next = src?.unlockNextCourse;
    if (next && next.deletedAt == null) {
      // Skip if already enrolled in the next course.
      const enrolled = await prisma.enrollment.findFirst({
        where: { userId, courseId: next.id, deletedAt: null },
        select: { id: true },
      });
      if (!enrolled) {
        // Reuse an existing unused code, otherwise generate a fresh one.
        let row = await prisma.courseUnlockCode.findFirst({
          where: { userId, courseId: next.id, usedAt: null },
          select: { code: true },
        });
        if (!row) {
          const code = `UL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
          row = await prisma.courseUnlockCode.create({
            data: { code, userId, courseId: next.id },
            select: { code: true },
          });
        }
        unlockCode = { code: row.code, courseId: next.id.toString(), courseTitle: next.title };
      }
    }
  }

  return { ...result, unlockCode };
}

// Event types (from AntiCheatEventType on the client) that count as a proctoring
// violation. "Return" events (TAB_FOCUS, FULLSCREEN_ENTER, VISIBILITY_VISIBLE,
// WINDOW_FOCUS) and CUSTOM are benign and never trip the auto-submit threshold.
// Matched case-insensitively so casing drift can't silently disable enforcement.
const VIOLATION_EVENT_TYPES = new Set([
  'TAB_BLUR',
  'FULLSCREEN_EXIT',
  'PASTE_DETECTED',
  'COPY_DETECTED',
  'VISIBILITY_HIDDEN',
  'WINDOW_BLUR',
  'DEVTOOLS_OPEN',
  'RIGHT_CLICK',
]);

// How many violations are tolerated before the attempt is force-submitted.
// Generous, so an accidental tab-switch or two never auto-submits a real exam.
const ANTI_CHEAT_MAX_VIOLATIONS = 15;

/**
 * Log an anti-cheat / proctoring event for an in-progress attempt.
 *
 * Events are appended to ExamAttempt.metadata.events. Unlike before, the events
 * are now ENFORCED: each violation increments metadata.violationCount, and once
 * the configured threshold is crossed the attempt is flagged and auto-submitted
 * server-side (graded as-is). This makes the proctoring signal real rather than
 * cosmetic, and surfaces violationCount/flagged to HR via the attempt record.
 */
export async function logEvent(
  id: bigint,
  userId: bigint,
  event: { type: string; payload?: unknown },
) {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id, userId },
    select: { id: true, status: true, metadata: true },
  });
  if (!attempt) throw HttpError.notFound('ไม่พบข้อมูลการสอบ');
  if (attempt.status !== 'IN_PROGRESS') {
    throw HttpError.conflict('ไม่สามารถบันทึก event สำหรับการสอบที่ส่งไปแล้ว');
  }

  const existing = (attempt.metadata as Record<string, unknown> | null) ?? {};
  const events: unknown[] = Array.isArray(existing['events']) ? existing['events'] : [];
  events.push({
    type: event.type,
    ts: new Date().toISOString(),
    payload: event.payload ?? null,
  });

  const violationCount = events.filter(
    (e): e is { type: string } =>
      typeof e === 'object' &&
      e !== null &&
      VIOLATION_EVENT_TYPES.has(String((e as { type?: string }).type ?? '').toUpperCase()),
  ).length;
  const shouldAutoSubmit =
    violationCount >= ANTI_CHEAT_MAX_VIOLATIONS && existing['flagged'] !== true;

  await prisma.examAttempt.update({
    where: { id },
    data: {
      metadata: {
        ...existing,
        events,
        violationCount,
        ...(shouldAutoSubmit ? { flagged: true, flaggedAt: new Date().toISOString() } : {}),
      } as Prisma.InputJsonValue,
    },
  });

  if (shouldAutoSubmit) {
    // Force-submit the attempt (graded as-is). Best-effort: a grading hiccup must
    // not lose the flag we already persisted above.
    try {
      await submit(id, userId);
    } catch {
      /* attempt stays flagged; status unchanged */
    }
    return { logged: true, eventCount: events.length, violationCount, autoSubmitted: true };
  }

  return { logged: true, eventCount: events.length, violationCount, autoSubmitted: false };
}