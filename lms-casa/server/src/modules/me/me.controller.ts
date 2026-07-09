import type { Request, Response } from 'express';
import { HttpError } from '../../utils/httpError.js';
import { audit } from '../../utils/audit.js';
import { EmptyBodySchema } from './me.schema.js';
import * as service from './me.service.js';

function currentUserId(req: Request): bigint {
  if (!req.auth) throw HttpError.unauthorized();
  return BigInt(req.auth.userId);
}

export async function courseProgress(req: Request, res: Response): Promise<void> {
  const userId = currentUserId(req);
  res.json(await service.getMyCourseProgress(userId));
}

export async function exportData(req: Request, res: Response): Promise<void> {
  const userId = currentUserId(req);
  const zip = await service.exportMyData(userId);
  await audit({
    actorId: userId,
    action: 'me.data_export',
    entityType: 'user',
    entityId: userId,
    req,
  });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="lms-casa-data-export.zip"');
  res.send(zip);
}

export async function anonymize(req: Request, res: Response): Promise<void> {
  EmptyBodySchema.parse(req.body ?? {});
  const userId = currentUserId(req);
  const result = await service.anonymizeMe(userId);
  await audit({
    actorId: null,
    action: 'me.anonymize',
    entityType: 'user',
    entityId: result.id,
    req,
    metadata: { deletedAt: result.deletedAt.toISOString() },
  });
  res.status(204).end();
}
