import type { Request, Response } from 'express';
import { AttemptListQuerySchema, SaveResponseSchema, LogEventSchema } from './attempts.schema.js';
import * as service from './attempts.service.js';
import { audit } from '../../utils/audit.js';
import { HttpError } from '../../utils/httpError.js';
import { parseId } from '../../utils/id.js';

function userId(req: Request): bigint {
  if (!req.auth) throw HttpError.unauthorized();
  return BigInt(req.auth.userId);
}

export async function listMine(req: Request, res: Response): Promise<void> {
  const query = AttemptListQuerySchema.parse(req.query);
  res.json(await service.listMine(userId(req), query));
}

export async function start(req: Request, res: Response): Promise<void> {
  const examId = parseId(req.params.examId, 'examId');
  const roles = req.auth?.roles ?? [];
  const result = await service.start(examId, userId(req), roles);
  await audit({
    actorId: userId(req),
    action: 'attempt.start',
    entityType: 'exam',
    entityId: examId,
    req,
  });
  res.json(result);
}

export async function get(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  res.json({ attempt: await service.getById(id, userId(req)) });
}

export async function saveResponse(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const input = SaveResponseSchema.parse(req.body);
  const response = await service.saveResponse(id, userId(req), input);
  await audit({
    actorId: userId(req),
    action: 'attempt.response.save',
    entityType: 'attempt',
    entityId: id,
    changes: {
      questionId: input.questionId.toString(),
      selectedOptionIds: (input.selectedOptionIds ?? []).map((v) => v.toString()),
      hasTextAnswer: Boolean(input.textAnswer),
    },
    req,
  });
  res.json({ response });
}

export async function submit(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const result = await service.submit(id, userId(req));
  await audit({
    actorId: userId(req),
    action: 'attempt.submit',
    entityType: 'attempt',
    entityId: id,
    req,
  });
  res.json(result);
}

/** Phase 2: anti-cheat event logging */
export async function logEvent(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const input = LogEventSchema.parse(req.body);
  const result = await service.logEvent(id, userId(req), input);
  res.json(result);
}
