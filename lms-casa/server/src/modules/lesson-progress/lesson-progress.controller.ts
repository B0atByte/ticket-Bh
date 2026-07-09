import type { Request, Response } from 'express';
import { HttpError } from '../../utils/httpError.js';
import { parseId } from '../../utils/id.js';
import { audit } from '../../utils/audit.js';
import { UpsertProgressSchema } from './lesson-progress.schema.js';
import * as service from './lesson-progress.service.js';

function userId(req: Request): bigint {
  if (!req.auth) throw HttpError.unauthorized();
  return BigInt(req.auth.userId);
}

export async function get(req: Request, res: Response): Promise<void> {
  const lessonId = parseId(req.params.lessonId, 'lessonId');
  const progress = await service.getProgress(lessonId, userId(req));
  res.json({ progress: progress ?? null });
}

export async function listByCourse(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  const items = await service.listByCourse(courseId, userId(req));
  res.json({ items });
}

export async function upsert(req: Request, res: Response): Promise<void> {
  const lessonId = parseId(req.params.lessonId, 'lessonId');
  const input = UpsertProgressSchema.parse(req.body);
  const progress = await service.upsertProgress(lessonId, userId(req), input);
  res.json({ progress });
}

export async function afkFail(req: Request, res: Response): Promise<void> {
  const lessonId = parseId(req.params.lessonId, 'lessonId');
  const uid = userId(req);
  const progress = await service.resetProgress(lessonId, uid);
  await audit({
    actorId: uid,
    action: 'lesson.afk_failed',
    entityType: 'lesson',
    entityId: lessonId.toString(),
    req,
  });
  res.json({ progress });
}

// Records an attempt to seek/skip past the watched portion (client blocks the seek;
// this is for HR visibility). Throttled by the client to avoid spamming.
export async function seekBlocked(req: Request, res: Response): Promise<void> {
  const lessonId = parseId(req.params.lessonId, 'lessonId');
  await audit({
    actorId: userId(req),
    action: 'lesson.seek_blocked',
    entityType: 'lesson',
    entityId: lessonId.toString(),
    req,
  });
  res.status(204).end();
}
