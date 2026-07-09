import type { Request, Response } from 'express';
import {
  AssignQuestionSchema,
  CreateExamSchema,
  ExamListQuerySchema,
  UpdateExamSchema,
} from './exams.schema.js';
import * as service from './exams.service.js';
import { audit } from '../../utils/audit.js';
import { parseId } from '../../utils/id.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = ExamListQuerySchema.parse(req.query);
  res.json(await service.list(query));
}

export async function get(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  res.json({ exam: await service.getById(id) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = CreateExamSchema.parse(req.body);
  const exam = await service.create(input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'exam.create',
    entityType: 'exam',
    entityId: exam.id,
    req,
  });
  res.status(201).json({ exam });
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const input = UpdateExamSchema.parse(req.body);
  const exam = await service.update(id, input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'exam.update',
    entityType: 'exam',
    entityId: id,
    changes: input,
    req,
  });
  res.json({ exam });
}

export async function assignQuestion(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const input = AssignQuestionSchema.parse(req.body);
  const examQuestion = await service.assignQuestion(id, input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'exam.question.assign',
    entityType: 'exam',
    entityId: id,
    changes: { ...input, questionId: input.questionId.toString() },
    req,
  });
  res.status(201).json({ examQuestion });
}

export async function publish(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const exam = await service.publish(id);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'exam.publish',
    entityType: 'exam',
    entityId: id,
    req,
  });
  res.json({ exam });
}

export async function archive(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const exam = await service.archive(id);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'exam.archive',
    entityType: 'exam',
    entityId: id,
    req,
  });
  res.json({ exam });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  await service.softDelete(id);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'exam.delete',
    entityType: 'exam',
    entityId: id,
    req,
  });
  res.status(204).end();
}
