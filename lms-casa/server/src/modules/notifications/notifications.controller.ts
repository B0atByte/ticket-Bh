import type { Request, Response } from 'express';
import { audit } from '../../utils/audit.js';
import { HttpError } from '../../utils/httpError.js';
import { parseId } from '../../utils/id.js';
import { addClient } from './notifications.hub.js';
import { CreateNotificationSchema, NotificationQuerySchema } from './notifications.schema.js';
import * as service from './notifications.service.js';

function authUserId(req: Request): bigint {
  if (!req.auth) throw HttpError.unauthorized();
  return BigInt(req.auth.userId);
}

export async function listMine(req: Request, res: Response): Promise<void> {
  const query = NotificationQuerySchema.parse(req.query);
  res.json(await service.listMine(authUserId(req), query));
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = CreateNotificationSchema.parse(req.body);
  const notification = await service.create(input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'notification.create',
    entityType: 'notification',
    entityId: notification.id,
    changes: { ...input, userId: input.userId.toString() },
    req,
  });
  res.status(201).json({ notification });
}

export async function createSelfTest(req: Request, res: Response): Promise<void> {
  const notification = await service.createSelfTest(authUserId(req));
  await audit({
    actorId: authUserId(req),
    action: 'notification.self_test',
    entityType: 'notification',
    entityId: notification.id,
    req,
  });
  res.status(201).json({ notification });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const notification = await service.markRead(authUserId(req), id);
  res.json({ notification });
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  const count = await service.markAllRead(authUserId(req));
  res.json({ count });
}

export function stream(req: Request, res: Response): void {
  if (!req.auth) throw HttpError.unauthorized();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const write = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  write('ready', { ok: true, ts: new Date().toISOString() });
  const remove = addClient(req.auth.userId, write);
  const ping = setInterval(() => write('ping', { ts: new Date().toISOString() }), 25_000);
  req.on('close', () => {
    clearInterval(ping);
    remove();
    res.end();
  });
}
