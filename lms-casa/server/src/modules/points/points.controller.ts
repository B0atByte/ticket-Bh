import type { Request, Response } from 'express';
import { HttpError } from '../../utils/httpError.js';
import { LeaderboardQuerySchema } from './points.schema.js';
import * as service from './points.service.js';

function currentUserId(req: Request): bigint {
  if (!req.auth) throw HttpError.unauthorized();
  return BigInt(req.auth.userId);
}

export async function me(req: Request, res: Response): Promise<void> {
  const userId = currentUserId(req);
  const summary = await service.getMySummary(userId);
  res.json(summary);
}

export async function getLeaderboard(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw HttpError.unauthorized();
  const parsed = LeaderboardQuerySchema.parse(req.query);

  let departmentId = parsed.departmentId;
  if (parsed.scope === 'department' && !departmentId) {
    const own = await service.getUserDepartmentId(BigInt(req.auth.userId));
    departmentId = own ?? undefined;
  }

  const entries = await service.leaderboard({
    scope: parsed.scope,
    departmentId,
    limit: parsed.limit,
  });
  res.json({ scope: parsed.scope, departmentId: departmentId?.toString() ?? null, entries });
}
