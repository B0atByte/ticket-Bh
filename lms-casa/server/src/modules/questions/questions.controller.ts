import type { Request, Response } from 'express';
import {
  BulkQuestionImportSchema,
  CreateQuestionSchema,
  GenerateFromCourseSchema,
  GenerateQuestionDraftsSchema,
  ParseQuestionTextSchema,
  QuestionListQuerySchema,
  UpdateQuestionSchema,
} from './questions.schema.js';
import * as service from './questions.service.js';
import { answerKeyValid, buildCourseSourceText, csvTemplate, generateQuestionDrafts, parseQuestionFile, parseQuestionText } from './questions.import.js';
import { audit } from '../../utils/audit.js';
import { HttpError } from '../../utils/httpError.js';
import { parseId } from '../../utils/id.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = QuestionListQuerySchema.parse(req.query);
  res.json(await service.list(query));
}

export async function get(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  res.json({ question: await service.getById(id) });
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw HttpError.unauthorized();
  const input = CreateQuestionSchema.parse(req.body);
  const question = await service.create(input, BigInt(req.auth.userId));
  await audit({
    actorId: BigInt(req.auth.userId),
    action: 'question.create',
    entityType: 'question',
    entityId: question.id,
    req,
  });
  res.status(201).json({ question });
}

export function downloadTemplate(_req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="question-import-template.csv"');
  res.send(`\uFEFF${csvTemplate()}`);
}

export async function previewImport(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) throw HttpError.badRequest('Import file is required');
  res.json(await parseQuestionFile(file));
}

export async function commitImport(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw HttpError.unauthorized();
  const input = BulkQuestionImportSchema.parse(req.body);
  // Last-line defense: refuse any question whose answer key is inconsistent
  // (e.g. no correct option, or every option marked correct).
  const badIndex = input.questions.findIndex((q) => !answerKeyValid(q));
  if (badIndex >= 0) {
    throw HttpError.badRequest(`ข้อที่ ${badIndex + 1} มีเฉลยไม่ถูกต้อง (ต้องมีคำตอบที่ถูกอย่างเหมาะสม)`);
  }
  const questions = input.questions.map((question) => ({ ...question, bankId: input.bankId }));
  const created = await service.bulkCreate(questions, BigInt(req.auth.userId));
  await audit({
    actorId: BigInt(req.auth.userId),
    action: 'question.import',
    entityType: 'question_bank',
    entityId: input.bankId,
    changes: { count: created.length },
    req,
  });
  res.status(201).json({ items: created, count: created.length });
}

export async function generateDrafts(req: Request, res: Response): Promise<void> {
  const input = GenerateQuestionDraftsSchema.parse(req.body);
  const result = await generateQuestionDrafts(input);
  res.json(result);
}

export async function parseText(req: Request, res: Response): Promise<void> {
  const { rawText } = ParseQuestionTextSchema.parse(req.body);
  const result = await parseQuestionText(rawText);
  res.json(result);
}

export async function generateFromCourse(req: Request, res: Response): Promise<void> {
  const { courseId, count, difficulty } = GenerateFromCourseSchema.parse(req.body);
  const sourceText = await buildCourseSourceText(courseId);
  if (sourceText.length < 50) {
    throw HttpError.badRequest('เนื้อหาในหลักสูตรนี้น้อยเกินไปสำหรับสร้างข้อสอบ — เพิ่มบทเรียนหรือคำอธิบายก่อน');
  }
  const result = await generateQuestionDrafts({ sourceText, count, difficulty });
  res.json(result);
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const input = UpdateQuestionSchema.parse(req.body);
  const question = await service.update(id, input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'question.update',
    entityType: 'question',
    entityId: id,
    changes: {
      ...input,
      bankId: input.bankId?.toString(),
      categoryId: input.categoryId?.toString(),
    },
    req,
  });
  res.json({ question });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  await service.softDelete(id);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'question.delete',
    entityType: 'question',
    entityId: id,
    req,
  });
  res.status(204).end();
}
