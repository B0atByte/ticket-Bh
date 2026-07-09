import type { Request, Response } from 'express';
import { HttpError } from '../../utils/httpError.js';
import { CreateIssueSchema } from './issues.schema.js';
import * as service from './issues.service.js';

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw HttpError.unauthorized();
  const input = CreateIssueSchema.parse(req.body);
  const issue = await service.create(BigInt(req.auth.userId), input);
  res.status(201).json(issue);
}
