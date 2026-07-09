import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { parseId } from '../../utils/id.js';
import { audit } from '../../utils/audit.js';

const CreateBankSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(2000).optional(),
});

const UpdateBankSchema = CreateBankSchema.partial();

export async function list(_req: Request, res: Response): Promise<void> {
  const banks = await prisma.questionBank.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { questions: { where: { deletedAt: null } } } },
    },
  });
  res.json({
    items: banks.map((b) => ({
      id: b.id.toString(),
      name: b.name,
      description: b.description,
      questionCount: b._count.questions,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    })),
  });
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw HttpError.unauthorized();
  const input = CreateBankSchema.parse(req.body);
  const bank = await prisma.questionBank.create({
    data: { name: input.name, description: input.description },
    select: { id: true, name: true, description: true, createdAt: true, updatedAt: true },
  });
  await audit({
    actorId: BigInt(req.auth.userId),
    action: 'question_bank.create',
    entityType: 'question_bank',
    entityId: bank.id,
    req,
  });
  res.status(201).json({
    bank: { ...bank, id: bank.id.toString(), questionCount: 0 },
  });
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const input = UpdateBankSchema.parse(req.body);
  const existing = await prisma.questionBank.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw HttpError.notFound('ไม่พบชุดคำถาม');

  const bank = await prisma.questionBank.update({
    where: { id },
    data: { name: input.name, description: input.description },
    select: {
      id: true, name: true, description: true, createdAt: true, updatedAt: true,
      _count: { select: { questions: { where: { deletedAt: null } } } },
    },
  });
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'question_bank.update',
    entityType: 'question_bank',
    entityId: id,
    changes: input,
    req,
  });
  res.json({
    bank: {
      id: bank.id.toString(),
      name: bank.name,
      description: bank.description,
      questionCount: bank._count.questions,
      createdAt: bank.createdAt,
      updatedAt: bank.updatedAt,
    },
  });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const existing = await prisma.questionBank.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, _count: { select: { questions: { where: { deletedAt: null } } } } },
  });
  if (!existing) throw HttpError.notFound('ไม่พบชุดคำถาม');
  if (existing._count.questions > 0) {
    throw HttpError.conflict('ไม่สามารถลบชุดคำถามที่ยังมีคำถามอยู่ได้ กรุณาย้ายหรือลบคำถามทั้งหมดก่อน');
  }
  await prisma.questionBank.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'question_bank.delete',
    entityType: 'question_bank',
    entityId: id,
    req,
  });
  res.status(204).end();
}
