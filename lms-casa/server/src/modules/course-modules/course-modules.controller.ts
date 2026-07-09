import type { Request, Response } from 'express';
import {
  CreateModuleSchema,
  ReorderModulesSchema,
  UpdateModuleSchema,
} from './course-modules.schema.js';
import * as service from './course-modules.service.js';
import { audit } from '../../utils/audit.js';
import { parseId } from '../../utils/id.js';

export async function listByCourse(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  res.json({ items: await service.listByCourse(courseId) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  const input = CreateModuleSchema.parse(req.body);
  const module_ = await service.create(courseId, input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'module.create',
    entityType: 'module',
    entityId: module_.id,
    req,
  });
  res.status(201).json({ module: module_ });
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const input = UpdateModuleSchema.parse(req.body);
  const module_ = await service.update(id, input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'module.update',
    entityType: 'module',
    entityId: id,
    changes: input,
    req,
  });
  res.json({ module: module_ });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  await service.softDelete(id);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'module.delete',
    entityType: 'module',
    entityId: id,
    req,
  });
  res.status(204).end();
}

export async function reorder(req: Request, res: Response): Promise<void> {
  const courseId = parseId(req.params.courseId, 'courseId');
  const { orderedIds } = ReorderModulesSchema.parse(req.body);
  await service.reorder(courseId, orderedIds);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'module.reorder',
    entityType: 'course',
    entityId: courseId,
    req,
  });
  res.status(204).end();
}
