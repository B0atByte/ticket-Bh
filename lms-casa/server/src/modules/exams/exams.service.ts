import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { paginated, skipTake } from '../../utils/pagination.js';
import type {
  AssignQuestionInput,
  CreateExamInput,
  ExamListQuery,
  UpdateExamInput,
} from './exams.schema.js';

const EXAM_LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  courseId: true,
  type: true,
  status: true,
  timeLimitMinutes: true,
  secondsPerQuestion: true,
  passingScore: true,
  maxAttempts: true,
  cooldownMinutes: true,
  shuffleQuestions: true,
  shuffleOptions: true,
  showResultMode: true,
  randomFromBankId: true,
  randomCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { questions: true, attempts: true } },
} satisfies Prisma.ExamSelect;

async function ensureCourse(courseId?: bigint): Promise<void> {
  if (!courseId) return;
  const course = await prisma.course.findFirst({ where: { id: courseId, deletedAt: null } });
  if (!course) throw HttpError.notFound('ไม่พบหลักสูตร');
}

async function ensureBank(bankId?: bigint): Promise<void> {
  if (!bankId) return;
  const bank = await prisma.questionBank.findFirst({ where: { id: bankId, deletedAt: null } });
  if (!bank) throw HttpError.notFound('ไม่พบชุดคำถาม');
}

export async function list(query: ExamListQuery) {
  const where: Prisma.ExamWhereInput = { deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.courseId) where.courseId = query.courseId;
  if (query.q) {
    where.OR = [{ title: { contains: query.q } }, { description: { contains: query.q } }];
  }

  const [items, total] = await Promise.all([
    prisma.exam.findMany({
      where,
      ...skipTake(query.page, query.pageSize),
      orderBy: { id: 'desc' },
      select: EXAM_LIST_SELECT,
    }),
    prisma.exam.count({ where }),
  ]);

  return paginated(items, total, query.page, query.pageSize);
}

export async function getById(id: bigint) {
  const exam = await prisma.exam.findFirst({
    where: { id, deletedAt: null },
    include: {
      questions: {
        orderBy: { orderIndex: 'asc' },
        include: {
          question: {
            select: {
              id: true,
              type: true,
              difficulty: true,
              text: true,
              explanation: true,
              defaultPoints: true,
              deletedAt: true,
            },
          },
        },
      },
      _count: { select: { attempts: true } },
    },
  });
  if (!exam) throw HttpError.notFound('ไม่พบข้อสอบ');
  return {
    ...exam,
    questions: exam.questions.filter((item) => item.question.deletedAt === null),
  };
}

export async function create(input: CreateExamInput) {
  await ensureCourse(input.courseId);
  await ensureBank(input.randomFromBankId);
  return prisma.exam.create({
    data: {
      title: input.title,
      description: input.description,
      courseId: input.courseId,
      type: input.type ?? 'QUIZ',
      timeLimitMinutes: input.timeLimitMinutes,
      secondsPerQuestion: input.secondsPerQuestion,
      passingScore: input.passingScore ?? 70,
      maxAttempts: input.maxAttempts,
      cooldownMinutes: input.cooldownMinutes,
      shuffleQuestions: input.shuffleQuestions ?? false,
      shuffleOptions: input.shuffleOptions ?? false,
      showResultMode: input.showResultMode ?? 'AFTER_SUBMIT',
      antiCheat: input.antiCheat as Prisma.InputJsonValue | undefined,
      randomFromBankId: input.randomFromBankId,
      randomCount: input.randomCount,
    },
    select: EXAM_LIST_SELECT,
  });
}

export async function update(id: bigint, input: UpdateExamInput) {
  const target = await prisma.exam.findFirst({ where: { id, deletedAt: null } });
  if (!target) throw HttpError.notFound('ไม่พบข้อสอบ');
  await ensureCourse(input.courseId);
  await ensureBank(input.randomFromBankId);
  return prisma.exam.update({
    where: { id },
    data: {
      ...input,
      antiCheat: input.antiCheat as Prisma.InputJsonValue | undefined,
    } as Prisma.ExamUpdateInput,
    select: EXAM_LIST_SELECT,
  });
}

export async function assignQuestion(examId: bigint, input: AssignQuestionInput) {
  const [exam, question] = await Promise.all([
    prisma.exam.findFirst({ where: { id: examId, deletedAt: null } }),
    prisma.question.findFirst({ where: { id: input.questionId, deletedAt: null } }),
  ]);
  if (!exam) throw HttpError.notFound('ไม่พบข้อสอบ');
  if (!question) throw HttpError.notFound('ไม่พบคำถาม');
  if (exam.status === 'ARCHIVED') throw HttpError.badRequest('ไม่สามารถแก้ไขข้อสอบที่ถูกเก็บถาวรแล้ว');

  const orderIndex =
    input.orderIndex ??
    (await prisma.examQuestion.count({ where: { examId } }));

  return prisma.examQuestion.upsert({
    where: { examId_questionId: { examId, questionId: input.questionId } },
    create: {
      examId,
      questionId: input.questionId,
      points: input.points,
      orderIndex,
    },
    update: {
      points: input.points,
      orderIndex,
    },
    include: {
      question: { select: { id: true, type: true, text: true, defaultPoints: true } },
    },
  });
}

export async function publish(id: bigint) {
  const target = await prisma.exam.findFirst({
    where: { id, deletedAt: null },
    include: { _count: { select: { questions: true } } },
  });
  if (!target) throw HttpError.notFound('ไม่พบข้อสอบ');
  if (target.status === 'ARCHIVED') throw HttpError.badRequest('ไม่สามารถเผยแพร่ข้อสอบที่ถูกเก็บถาวรแล้ว');
  if (target._count.questions < 1) throw HttpError.badRequest('ต้องมีคำถามอย่างน้อย 1 ข้อก่อนเผยแพร่');
  return prisma.exam.update({
    where: { id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
    select: EXAM_LIST_SELECT,
  });
}

export async function archive(id: bigint) {
  const target = await prisma.exam.findFirst({ where: { id, deletedAt: null } });
  if (!target) throw HttpError.notFound('ไม่พบข้อสอบ');
  return prisma.exam.update({
    where: { id },
    data: { status: 'ARCHIVED' },
    select: EXAM_LIST_SELECT,
  });
}

export async function softDelete(id: bigint): Promise<void> {
  const target = await prisma.exam.findFirst({ where: { id, deletedAt: null } });
  if (!target) throw HttpError.notFound('ไม่พบข้อสอบ');
  await prisma.exam.update({ where: { id }, data: { deletedAt: new Date() } });
}
