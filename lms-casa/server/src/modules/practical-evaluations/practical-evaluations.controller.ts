import type { Request, Response } from 'express';
import { HttpError } from '../../utils/httpError.js';
import { parseId } from '../../utils/id.js';
import { audit } from '../../utils/audit.js';
import {
  ReorderCriteriaSchema,
  SubmitEvaluationSchema,
  UpsertCriterionSchema,
} from './practical-evaluations.schema.js';
import * as service from './practical-evaluations.service.js';

function userId(req: Request): bigint {
  if (!req.auth) throw HttpError.unauthorized();
  return BigInt(req.auth.userId);
}

function roles(req: Request): string[] {
  if (!req.auth) throw HttpError.unauthorized();
  return req.auth.roles;
}

// ─────────────────────────────────────────────────────────────────────────
// Criteria (admin)
// ─────────────────────────────────────────────────────────────────────────

export async function listCriteria(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  const criteria = await service.listCriteria(courseId);
  res.json({ criteria });
}

export async function createCriterion(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  const input = UpsertCriterionSchema.parse(req.body);
  const criterion = await service.createCriterion(courseId, input);
  res.status(201).json({ criterion });
}

export async function updateCriterion(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const input = UpsertCriterionSchema.parse(req.body);
  const criterion = await service.updateCriterion(id, input);
  res.json({ criterion });
}

export async function deleteCriterion(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  await service.deleteCriterion(id);
  res.status(204).send();
}

export async function reorderCriteria(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  const input = ReorderCriteriaSchema.parse(req.body);
  await service.reorderCriteria(courseId, input);
  res.status(204).send();
}

// ─────────────────────────────────────────────────────────────────────────
// Evaluation (instructor / admin grading, learner self view)
// ─────────────────────────────────────────────────────────────────────────

export async function getEvaluation(req: Request, res: Response): Promise<void> {
  const enrollmentId = parseId(req.params.id);
  const evaluation = await service.getEvaluationForEnrollment(enrollmentId, userId(req), roles(req));
  res.json({ evaluation });
}

export async function submitEvaluation(req: Request, res: Response): Promise<void> {
  const enrollmentId = parseId(req.params.id);
  const input = SubmitEvaluationSchema.parse(req.body);
  const evaluation = await service.submitEvaluation(enrollmentId, userId(req), roles(req), input);
  await audit({
    actorId: userId(req),
    action: 'practical_eval.submit',
    entityType: 'enrollment',
    entityId: enrollmentId,
    req,
    metadata: { result: input.result },
  });
  res.json({ evaluation });
}

export async function getMyEvaluation(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  const evaluation = await service.getMyEvaluation(userId(req), courseId);
  res.json({ evaluation });
}
