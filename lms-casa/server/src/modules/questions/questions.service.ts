import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { paginated, skipTake } from '../../utils/pagination.js';
import { sanitizeRichHtml } from '../../utils/sanitizeHtml.js';
import type {
  CreateQuestionInput,
  QuestionListQuery,
  UpdateQuestionInput,
} from './questions.schema.js';

const DEFAULT_BANK_NAME = 'Default Bank';
const CHOICE_TYPES = new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE']);

const QUESTION_LIST_SELECT = {
  id: true,
  bankId: true,
  type: true,
  difficulty: true,
  text: true,
  explanation: true,
  defaultPoints: true,
  categoryId: true,
  authorId: true,
  meta: true,
  createdAt: true,
  updatedAt: true,
  options: {
    orderBy: { orderIndex: 'asc' },
    select: {
      id: true,
      text: true,
      imageUrl: true,
      isCorrect: true,
      orderIndex: true,
      meta: true,
    },
  },
} satisfies Prisma.QuestionSelect;

async function ensureBank(bankId?: bigint): Promise<bigint> {
  if (bankId) {
    const bank = await prisma.questionBank.findFirst({ where: { id: bankId, deletedAt: null } });
    if (!bank) throw HttpError.notFound('ไม่พบชุดคำถาม');
    return bank.id;
  }
  const existing = await prisma.questionBank.findFirst({
    where: { name: DEFAULT_BANK_NAME, deletedAt: null },
    select: { id: true },
  });
  if (existing) return existing.id;
  const bank = await prisma.questionBank.create({ data: { name: DEFAULT_BANK_NAME } });
  return bank.id;
}

function validateOptions(input: CreateQuestionInput | UpdateQuestionInput): void {
  if (!input.type || !CHOICE_TYPES.has(input.type)) return;
  if (!input.options || input.options.length < 2) {
    throw HttpError.badRequest('คำถามแบบเลือกตอบต้องมีตัวเลือกอย่างน้อย 2 ข้อ');
  }
  const correctCount = input.options.filter((option) => option.isCorrect).length;
  if (input.type === 'SINGLE_CHOICE' || input.type === 'TRUE_FALSE') {
    if (correctCount !== 1) {
      throw HttpError.badRequest('คำถามแบบเลือกตอบเดียวและถูก/ผิด ต้องมีคำตอบที่ถูกต้องพอดี 1 ข้อ');
    }
  }
  if (input.type === 'MULTIPLE_CHOICE' && correctCount < 1) {
    throw HttpError.badRequest('คำถามแบบเลือกหลายข้อต้องมีคำตอบที่ถูกต้องอย่างน้อย 1 ข้อ');
  }
}

function optionCreateMany(options: NonNullable<CreateQuestionInput['options']>) {
  return options.map((option, index) => ({
    text: option.text,
    imageUrl: option.imageUrl,
    isCorrect: option.isCorrect,
    orderIndex: option.orderIndex ?? index,
    meta: option.meta as Prisma.InputJsonValue | undefined,
  }));
}

export async function list(query: QuestionListQuery) {
  const where: Prisma.QuestionWhereInput = { deletedAt: null };
  if (query.bankId) where.bankId = query.bankId;
  if (query.type) where.type = query.type;
  if (query.difficulty) where.difficulty = query.difficulty;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.q) where.text = { contains: query.q };

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      ...skipTake(query.page, query.pageSize),
      orderBy: { id: 'desc' },
      select: QUESTION_LIST_SELECT,
    }),
    prisma.question.count({ where }),
  ]);

  return paginated(items, total, query.page, query.pageSize);
}

export async function getById(id: bigint) {
  const question = await prisma.question.findFirst({
    where: { id, deletedAt: null },
    select: QUESTION_LIST_SELECT,
  });
  if (!question) throw HttpError.notFound('ไม่พบคำถาม');
  return question;
}

export async function create(input: CreateQuestionInput, authorId: bigint) {
  validateOptions(input);
  const bankId = await ensureBank(input.bankId);
  const question = await prisma.question.create({
    data: {
      bankId,
      type: input.type,
      difficulty: input.difficulty ?? 'MEDIUM',
      text: sanitizeRichHtml(input.text) ?? input.text,
      explanation: sanitizeRichHtml(input.explanation) ?? undefined,
      defaultPoints: input.defaultPoints ?? 1,
      categoryId: input.categoryId,
      authorId,
      meta: input.meta as Prisma.InputJsonValue | undefined,
      options: input.options ? { create: optionCreateMany(input.options) } : undefined,
    },
    select: QUESTION_LIST_SELECT,
  });
  return question;
}

export async function bulkCreate(inputs: CreateQuestionInput[], authorId: bigint) {
  if (inputs.length < 1) return [];
  if (inputs.length > 500) throw HttpError.badRequest('ไม่สามารถนำเข้าเกิน 500 คำถามในครั้งเดียว');

  const prepared = await Promise.all(
    inputs.map(async (input) => {
      validateOptions(input);
      return {
        input,
        bankId: await ensureBank(input.bankId),
      };
    }),
  );

  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const item of prepared) {
      const question = await tx.question.create({
        data: {
          bankId: item.bankId,
          type: item.input.type,
          difficulty: item.input.difficulty ?? 'MEDIUM',
          text: sanitizeRichHtml(item.input.text) ?? item.input.text,
          explanation: sanitizeRichHtml(item.input.explanation) ?? undefined,
          defaultPoints: item.input.defaultPoints ?? 1,
          categoryId: item.input.categoryId,
          authorId,
          meta: item.input.meta as Prisma.InputJsonValue | undefined,
          options: item.input.options ? { create: optionCreateMany(item.input.options) } : undefined,
        },
        select: QUESTION_LIST_SELECT,
      });
      created.push(question);
    }
    return created;
  });
}

export async function update(id: bigint, input: UpdateQuestionInput) {
  const target = await prisma.question.findFirst({ where: { id, deletedAt: null } });
  if (!target) throw HttpError.notFound('Question not found');

  const nextType = input.type ?? target.type;
  validateOptions({ ...input, type: nextType });
  const bankId = input.bankId ? await ensureBank(input.bankId) : undefined;
  const { options, ...patch } = input;
  if (patch.text !== undefined) {
    patch.text = sanitizeRichHtml(patch.text) ?? patch.text;
  }
  if (patch.explanation !== undefined) {
    patch.explanation = sanitizeRichHtml(patch.explanation) ?? undefined;
  }

  await prisma.$transaction(async (tx) => {
    await tx.question.update({
      where: { id },
      data: {
        ...patch,
        bankId,
        meta: input.meta as Prisma.InputJsonValue | undefined,
      } as Prisma.QuestionUpdateInput,
    });
    if (options) {
      await tx.questionOption.deleteMany({ where: { questionId: id } });
      if (options.length > 0) {
        await tx.questionOption.createMany({
          data: options.map((option, index) => ({
            questionId: id,
            text: option.text,
            imageUrl: option.imageUrl,
            isCorrect: option.isCorrect,
            orderIndex: option.orderIndex ?? index,
            meta: option.meta as Prisma.InputJsonValue | undefined,
          })),
        });
      }
    }
  });

  return getById(id);
}

export async function softDelete(id: bigint): Promise<void> {
  const target = await prisma.question.findFirst({ where: { id, deletedAt: null } });
  if (!target) throw HttpError.notFound('Question not found');
  await prisma.question.update({ where: { id }, data: { deletedAt: new Date() } });
}
