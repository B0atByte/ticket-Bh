import type { Request, Response } from 'express';
import * as service from './stats.service.js';
import { HttpError } from '../../utils/httpError.js';

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw HttpError.unauthorized();
  res.json(await service.personalStats(BigInt(req.auth.userId)));
}

export async function manager(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw HttpError.unauthorized();
  const reports = await service.managerStats(BigInt(req.auth.userId));
  res.json({ reports });
}

export async function admin(_req: Request, res: Response): Promise<void> {
  res.json(await service.adminStats());
}
