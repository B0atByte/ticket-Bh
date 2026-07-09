import fs from 'node:fs';
import type { Request, Response } from 'express';
import {
  CourseListQuerySchema,
  CreateCourseSchema,
  UpdateCourseSchema,
} from './courses.schema.js';
import * as service from './courses.service.js';
import { audit } from '../../utils/audit.js';
import { parseId } from '../../utils/id.js';
import { HttpError } from '../../utils/httpError.js';
import { matchesSignature, readHeader } from '../../utils/fileSignature.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = CourseListQuerySchema.parse(req.query);
  res.json(await service.list(query));
}

export async function get(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const actor = req.auth ? { userId: BigInt(req.auth.userId), roles: req.auth.roles } : undefined;
  res.json({ course: await service.getById(id, actor) });
}

export async function uploadCover(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Image file is required' } });
    return;
  }
  if (!matchesSignature(readHeader(file.path), ['png', 'jpeg', 'webp'])) {
    fs.unlinkSync(file.path);
    throw HttpError.badRequest('Cover must be PNG, JPG, or WEBP');
  }
  res.status(201).json({ url: `/uploads/courses/${file.filename}` });
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw HttpError.unauthorized();
  const input = CreateCourseSchema.parse(req.body);
  const course = await service.create(input, BigInt(req.auth.userId));
  await audit({
    actorId: BigInt(req.auth.userId),
    action: 'course.create',
    entityType: 'course',
    entityId: course.id,
    req,
  });
  res.status(201).json({ course });
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const input = UpdateCourseSchema.parse(req.body);
  const course = await service.update(id, input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'course.update',
    entityType: 'course',
    entityId: id,
    changes: input,
    req,
  });
  res.json({ course });
}

export async function publish(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const course = await service.publish(id);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'course.publish',
    entityType: 'course',
    entityId: id,
    req,
  });
  res.json({ course });
}

export async function archive(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const course = await service.archive(id);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'course.archive',
    entityType: 'course',
    entityId: id,
    req,
  });
  res.json({ course });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  await service.softDelete(id);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'course.delete',
    entityType: 'course',
    entityId: id,
    req,
  });
  res.status(204).end();
}
