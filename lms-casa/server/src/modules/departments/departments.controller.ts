import type { Request, Response } from 'express';
import { CreateDepartmentSchema, UpdateDepartmentSchema } from './departments.schema.js';
import * as service from './departments.service.js';
import { audit } from '../../utils/audit.js';
import { parseId } from '../../utils/id.js';

export async function list(_req: Request, res: Response): Promise<void> {
  const items = await service.listDepartments();
  res.json({ items });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = CreateDepartmentSchema.parse(req.body);
  const department = await service.createDepartment(input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'department.create',
    entityType: 'department',
    entityId: department?.id.toString(),
    req,
  });
  res.status(201).json({ department });
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const input = UpdateDepartmentSchema.parse(req.body);
  const department = await service.updateDepartment(id, input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'department.update',
    entityType: 'department',
    entityId: id.toString(),
    req,
  });
  res.json({ department });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  await service.deleteDepartment(id);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'department.delete',
    entityType: 'department',
    entityId: id.toString(),
    req,
  });
  res.status(204).end();
}
