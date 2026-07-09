import fs from 'node:fs';
import type { Request, Response } from 'express';
import {
  CreateLessonSchema,
  ReorderLessonsSchema,
  UpdateLessonSchema,
  UpsertLessonContentSchema,
} from './lessons.schema.js';
import * as service from './lessons.service.js';
import { audit } from '../../utils/audit.js';
import { parseId } from '../../utils/id.js';
import { HttpError } from '../../utils/httpError.js';
import { matchesSignature, readHeader } from '../../utils/fileSignature.js';

export async function listByModule(req: Request, res: Response): Promise<void> {
  const moduleId = parseId(req.params.moduleId, 'moduleId');
  res.json({ items: await service.listByModule(moduleId) });
}

export async function get(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const actor = req.auth ? { userId: BigInt(req.auth.userId), roles: req.auth.roles } : undefined;
  res.json({ lesson: await service.getById(id, actor) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const moduleId = parseId(req.params.moduleId, 'moduleId');
  const input = CreateLessonSchema.parse(req.body);
  const lesson = await service.create(moduleId, input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'lesson.create',
    entityType: 'lesson',
    entityId: lesson.id,
    req,
  });
  res.status(201).json({ lesson });
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const input = UpdateLessonSchema.parse(req.body);
  const lesson = await service.update(id, input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'lesson.update',
    entityType: 'lesson',
    entityId: id,
    changes: input,
    req,
  });
  res.json({ lesson });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  await service.softDelete(id);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'lesson.delete',
    entityType: 'lesson',
    entityId: id,
    req,
  });
  res.status(204).end();
}

export async function reorder(req: Request, res: Response): Promise<void> {
  const moduleId = parseId(req.params.moduleId, 'moduleId');
  const { orderedIds } = ReorderLessonsSchema.parse(req.body);
  await service.reorder(moduleId, orderedIds);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'lesson.reorder',
    entityType: 'module',
    entityId: moduleId,
    req,
  });
  res.status(204).end();
}

export async function addContent(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const input = UpsertLessonContentSchema.parse(req.body);
  const content = await service.addContent(id, input);
  res.status(201).json({ content });
}

export async function removeContent(req: Request, res: Response): Promise<void> {
  const contentId = parseId(req.params.contentId, 'contentId');
  await service.removeContent(contentId);
  res.status(204).end();
}

export async function uploadMaterial(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'ต้องแนบไฟล์ PDF' } });
    return;
  }
  if (!matchesSignature(readHeader(file.path), ['pdf'])) {
    fs.unlinkSync(file.path);
    throw HttpError.badRequest('รองรับเฉพาะไฟล์ PDF');
  }
  res.status(201).json({ url: `/uploads/materials/${file.filename}` });
}
