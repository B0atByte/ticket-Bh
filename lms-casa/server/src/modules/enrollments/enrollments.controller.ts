import type { Request, Response } from 'express';
import { HttpError } from '../../utils/httpError.js';
import { parseId } from '../../utils/id.js';
import { audit } from '../../utils/audit.js';
import {
  AssignEnrollmentSchema,
  EnrollmentListQuerySchema,
  UpdateEnrollmentStatusSchema,
} from './enrollments.schema.js';
import * as service from './enrollments.service.js';

function userId(req: Request): bigint {
  if (!req.auth) throw HttpError.unauthorized();
  return BigInt(req.auth.userId);
}

export async function selfEnroll(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  const enrollment = await service.selfEnroll(userId(req), courseId);
  await audit({
    actorId: userId(req),
    action: 'enrollment.self_enroll',
    entityType: 'enrollment',
    entityId: enrollment.id,
    req,
    metadata: { courseId: courseId.toString() },
  });
  res.status(201).json({ enrollment });
}

export async function selfUnenroll(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  await service.selfUnenroll(userId(req), courseId);
  res.status(204).send();
}

export async function listMine(req: Request, res: Response): Promise<void> {
  const query = EnrollmentListQuerySchema.parse(req.query);
  res.json(await service.listMine(userId(req), query));
}

export async function getMyEnrollment(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  const enrollment = await service.getMyEnrollment(userId(req), courseId);
  res.json({ enrollment: enrollment ?? null });
}

export async function adminAssign(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  const input = AssignEnrollmentSchema.parse(req.body);
  const enrollment = await service.adminAssign(userId(req), courseId, input);
  res.status(201).json({ enrollment });
}

export async function listByCourse(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  const query = EnrollmentListQuerySchema.parse(req.query);
  res.json(await service.listByCourse(courseId, query));
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const input = UpdateEnrollmentStatusSchema.parse(req.body);
  const enrollment = await service.updateStatus(id, userId(req), input);
  res.json({ enrollment });
}

export async function adminWithdraw(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  await service.adminWithdraw(id);
  res.status(204).send();
}

export async function issueUnlockCode(req: Request, res: Response): Promise<void> {
  const targetUserId = parseId(req.body?.userId, 'userId');
  const courseId = parseId(req.body?.courseId, 'courseId');
  const result = await service.issueUnlockCode(targetUserId, courseId);
  await audit({
    actorId: userId(req),
    action: 'enrollment.issue_unlock_code',
    entityType: 'course',
    entityId: result.courseId,
    req,
    metadata: { forUserId: targetUserId.toString() },
  });
  res.status(201).json(result);
}

export async function redeemUnlockCode(req: Request, res: Response): Promise<void> {
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  if (!code.trim()) throw HttpError.badRequest('กรุณากรอกโค้ด');
  const result = await service.redeemUnlockCode(userId(req), code);
  await audit({
    actorId: userId(req),
    action: 'enrollment.redeem_unlock_code',
    entityType: 'course',
    entityId: result.courseId,
    req,
  });
  res.status(201).json(result);
}

export async function grantStar(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const enrollment = await service.grantStar(id, userId(req));
  await audit({
    actorId: userId(req),
    action: 'enrollment.grant_star',
    entityType: 'enrollment',
    entityId: id,
    req,
    metadata: { courseId: enrollment.courseId.toString(), learnerId: enrollment.userId.toString() },
  });
  res.json({ enrollment });
}

export async function revokeStar(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const enrollment = await service.revokeStar(id);
  await audit({
    actorId: userId(req),
    action: 'enrollment.revoke_star',
    entityType: 'enrollment',
    entityId: id,
    req,
    metadata: { courseId: enrollment.courseId.toString(), learnerId: enrollment.userId.toString() },
  });
  res.json({ enrollment });
}
