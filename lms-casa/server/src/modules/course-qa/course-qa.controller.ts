import type { Request, Response } from 'express';
import { HttpError } from '../../utils/httpError.js';
import { parseId } from '../../utils/id.js';
import {
  CreateAnswerSchema,
  CreateQuestionSchema,
  QAListQuerySchema,
} from './course-qa.schema.js';
import * as service from './course-qa.service.js';

function actorId(req: Request): bigint {
  if (!req.auth) throw HttpError.unauthorized();
  return BigInt(req.auth.userId);
}
function actorRoles(req: Request): string[] {
  return req.auth?.roles ?? [];
}

// ─── questions ───────────────────────────────────────────────────────────────

export async function listQuestions(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  const query = QAListQuerySchema.parse(req.query);
  res.json(await service.listQuestions(courseId, query));
}

export async function getQuestion(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.questionId, 'questionId');
  res.json({ question: await service.getQuestion(id) });
}

export async function createQuestion(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  const input = CreateQuestionSchema.parse(req.body);
  const question = await service.createQuestion(courseId, actorId(req), input);
  res.status(201).json({ question });
}

export async function deleteQuestion(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.questionId, 'questionId');
  await service.deleteQuestion(id, actorId(req), actorRoles(req));
  res.status(204).end();
}

// ─── answers ─────────────────────────────────────────────────────────────────

export async function createAnswer(req: Request, res: Response): Promise<void> {
  const questionId = parseId(req.params.questionId, 'questionId');
  const input = CreateAnswerSchema.parse(req.body);
  const answer = await service.createAnswer(questionId, actorId(req), input);
  res.status(201).json({ answer });
}

export async function acceptAnswer(req: Request, res: Response): Promise<void> {
  const answerId = parseId(req.params.answerId, 'answerId');
  const answer = await service.acceptAnswer(answerId, actorId(req), actorRoles(req));
  res.json({ answer });
}

export async function deleteAnswer(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.answerId, 'answerId');
  await service.deleteAnswer(id, actorId(req), actorRoles(req));
  res.status(204).end();
}
