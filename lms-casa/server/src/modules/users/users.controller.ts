import type { Request, Response } from 'express';
import {
  ChangeUserPasswordSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UserListQuerySchema,
} from './users.schema.js';
import * as service from './users.service.js';
import { audit } from '../../utils/audit.js';
import { parseId } from '../../utils/id.js';
import { HttpError } from '../../utils/httpError.js';
import type { Actor } from '../auth/roleHierarchy.js';

function requireActor(req: Request): Actor {
  if (!req.auth) throw HttpError.unauthorized();
  return { id: BigInt(req.auth.userId), roles: req.auth.roles };
}

export async function list(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const query = UserListQuerySchema.parse(req.query);
  res.json(await service.list(query, actor));
}

export async function get(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const id = parseId(req.params.id);
  res.json({ user: await service.getById(id, actor) });
}

export async function getRecord(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const id = parseId(req.params.id);
  res.json({ record: await service.getUserRecord(id, actor) });
}

export async function getMyRecord(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  res.json({ record: await service.getUserRecord(actor.id, actor) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const input = CreateUserSchema.parse(req.body);
  const user = await service.create(input, actor);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'user.create',
    entityType: 'user',
    entityId: user.id,
    req,
  });
  res.status(201).json({ user });
}

export async function update(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const id = parseId(req.params.id);
  const input = UpdateUserSchema.parse(req.body);
  const user = await service.update(id, input, actor);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'user.update',
    entityType: 'user',
    entityId: id,
    changes: input,
    req,
  });
  res.json({ user });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const id = parseId(req.params.id);
  await service.softDelete(id, actor);
  await audit({
    actorId: actor.id,
    action: 'user.delete',
    entityType: 'user',
    entityId: id,
    req,
  });
  res.status(204).end();
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const id = parseId(req.params.id);
  const { password } = ChangeUserPasswordSchema.parse(req.body);
  await service.changePassword(id, password, actor);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'user.password_change',
    entityType: 'user',
    entityId: id,
    req,
  });
  res.status(204).end();
}
