import type { Request, Response } from 'express';
import { CreateIssueSchema } from './issues.schema.js';
import * as service from './issues.service.js';

export async function create(req: Request, res: Response): Promise<void> {
  const input = CreateIssueSchema.parse(req.body);
  const reporterId = req.auth ? BigInt(req.auth.userId) : null;
  const issue = await service.create(reporterId, input);
  res.status(201).json(issue);
}

export async function list(req: Request, res: Response): Promise<void> {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const issues = await service.list(limit);
  res.json({ system: 'lms-casa', issues });
}
