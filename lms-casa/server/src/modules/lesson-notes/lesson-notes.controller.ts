import type { Request, Response } from 'express';
import { HttpError } from '../../utils/httpError.js';
import { parseId } from '../../utils/id.js';
import { CreateNoteSchema, NoteListQuerySchema, UpdateNoteSchema } from './lesson-notes.schema.js';
import * as service from './lesson-notes.service.js';

function userId(req: Request): bigint {
  if (!req.auth) throw HttpError.unauthorized();
  return BigInt(req.auth.userId);
}

export async function list(req: Request, res: Response): Promise<void> {
  const lessonId = parseId(req.params.lessonId, 'lessonId');
  const query = NoteListQuerySchema.parse(req.query);
  res.json(await service.list(lessonId, userId(req), query));
}

export async function create(req: Request, res: Response): Promise<void> {
  const lessonId = parseId(req.params.lessonId, 'lessonId');
  const input = CreateNoteSchema.parse(req.body);
  const note = await service.create(lessonId, userId(req), input);
  res.status(201).json({ note });
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.noteId, 'noteId');
  const input = UpdateNoteSchema.parse(req.body);
  const note = await service.update(id, userId(req), input);
  res.json({ note });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.noteId, 'noteId');
  await service.remove(id, userId(req));
  res.status(204).end();
}
