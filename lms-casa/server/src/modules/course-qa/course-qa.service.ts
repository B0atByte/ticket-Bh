import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { paginated, skipTake } from '../../utils/pagination.js';
import type { CreateAnswerInput, CreateQuestionInput, QAListQuery } from './course-qa.schema.js';

const QUESTION_SELECT = {
  id: true,
  courseId: true,
  userId: true,
  title: true,
  body: true,
  isPinned: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  _count: { select: { answers: { where: { deletedAt: null } } } },
} satisfies Prisma.CourseQuestionSelect;

const ANSWER_SELECT = {
  id: true,
  questionId: true,
  userId: true,
  body: true,
  isAccepted: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} satisfies Prisma.CourseAnswerSelect;

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Check if actor can delete a Q&A item (owner, instructor, admin) */
function canDelete(actorId: bigint, ownerId: bigint, roles: string[]): boolean {
  if (actorId === ownerId) return true;
  return roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'HR'].includes(r));
}

// ─── questions ───────────────────────────────────────────────────────────────

export async function listQuestions(courseId: bigint, query: QAListQuery) {
  const where: Prisma.CourseQuestionWhereInput = { courseId, deletedAt: null };
  if (query.q) {
    where.OR = [{ title: { contains: query.q } }, { body: { contains: query.q } }];
  }

  const [items, total] = await Promise.all([
    prisma.courseQuestion.findMany({
      where,
      ...skipTake(query.page, query.pageSize),
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      select: QUESTION_SELECT,
    }),
    prisma.courseQuestion.count({ where }),
  ]);

  return paginated(items, total, query.page, query.pageSize);
}

export async function getQuestion(id: bigint) {
  const q = await prisma.courseQuestion.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...QUESTION_SELECT,
      answers: {
        where: { deletedAt: null },
        orderBy: [{ isAccepted: 'desc' }, { createdAt: 'asc' }],
        select: ANSWER_SELECT,
      },
    },
  });
  if (!q) throw HttpError.notFound('ไม่พบคำถาม');
  return q;
}

export async function createQuestion(
  courseId: bigint,
  userId: bigint,
  input: CreateQuestionInput,
) {
  const course = await prisma.course.findFirst({ where: { id: courseId, deletedAt: null } });
  if (!course) throw HttpError.notFound('ไม่พบหลักสูตร');

  return prisma.courseQuestion.create({
    data: { courseId, userId, title: input.title, body: input.body },
    select: QUESTION_SELECT,
  });
}

export async function deleteQuestion(
  id: bigint,
  actorId: bigint,
  roles: string[],
): Promise<void> {
  const q = await prisma.courseQuestion.findFirst({ where: { id, deletedAt: null } });
  if (!q) throw HttpError.notFound('ไม่พบคำถาม');
  if (!canDelete(actorId, q.userId, roles)) throw HttpError.forbidden();
  await prisma.courseQuestion.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ─── answers ─────────────────────────────────────────────────────────────────

export async function createAnswer(
  questionId: bigint,
  userId: bigint,
  input: CreateAnswerInput,
) {
  const q = await prisma.courseQuestion.findFirst({ where: { id: questionId, deletedAt: null } });
  if (!q) throw HttpError.notFound('ไม่พบคำถาม');

  return prisma.courseAnswer.create({
    data: { questionId, userId, body: input.body },
    select: ANSWER_SELECT,
  });
}

export async function acceptAnswer(
  answerId: bigint,
  actorId: bigint,
  roles: string[],
) {
  const answer = await prisma.courseAnswer.findFirst({
    where: { id: answerId, deletedAt: null },
    include: { question: { select: { userId: true } } },
  });
  if (!answer) throw HttpError.notFound('ไม่พบคำตอบ');

  // Only question owner or admin/instructor can accept
  if (!canDelete(actorId, answer.question.userId, roles)) throw HttpError.forbidden();

  // Unaccept all other answers for this question, then accept this one
  await prisma.$transaction([
    prisma.courseAnswer.updateMany({
      where: { questionId: answer.questionId, deletedAt: null },
      data: { isAccepted: false },
    }),
    prisma.courseAnswer.update({
      where: { id: answerId },
      data: { isAccepted: true },
    }),
  ]);

  return prisma.courseAnswer.findFirst({
    where: { id: answerId },
    select: ANSWER_SELECT,
  });
}

export async function deleteAnswer(
  id: bigint,
  actorId: bigint,
  roles: string[],
): Promise<void> {
  const answer = await prisma.courseAnswer.findFirst({ where: { id, deletedAt: null } });
  if (!answer) throw HttpError.notFound('ไม่พบคำตอบ');
  if (!canDelete(actorId, answer.userId, roles)) throw HttpError.forbidden();
  await prisma.courseAnswer.update({ where: { id }, data: { deletedAt: new Date() } });
}
