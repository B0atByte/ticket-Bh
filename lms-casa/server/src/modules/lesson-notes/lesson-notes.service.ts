import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { paginated, skipTake } from '../../utils/pagination.js';
import type { CreateNoteInput, NoteListQuery, UpdateNoteInput } from './lesson-notes.schema.js';

const NOTE_SELECT = {
  id: true,
  lessonId: true,
  userId: true,
  type: true,
  content: true,
  timestampSec: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LessonNoteSelect;

export async function list(lessonId: bigint, userId: bigint, query: NoteListQuery) {
  const where: Prisma.LessonNoteWhereInput = { lessonId, userId, deletedAt: null };
  if (query.type) where.type = query.type;

  const [items, total] = await Promise.all([
    prisma.lessonNote.findMany({
      where,
      ...skipTake(query.page, query.pageSize),
      orderBy: [{ timestampSec: 'asc' }, { createdAt: 'desc' }],
      select: NOTE_SELECT,
    }),
    prisma.lessonNote.count({ where }),
  ]);

  return paginated(items, total, query.page, query.pageSize);
}

export async function create(lessonId: bigint, userId: bigint, input: CreateNoteInput) {
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, deletedAt: null } });
  if (!lesson) throw HttpError.notFound('Lesson not found');

  return prisma.lessonNote.create({
    data: {
      lessonId,
      userId,
      type: input.type,
      content: input.content,
      timestampSec: input.timestampSec,
    },
    select: NOTE_SELECT,
  });
}

export async function update(id: bigint, userId: bigint, input: UpdateNoteInput) {
  const note = await prisma.lessonNote.findFirst({ where: { id, userId, deletedAt: null } });
  if (!note) throw HttpError.notFound('Note not found');

  return prisma.lessonNote.update({
    where: { id },
    data: { content: input.content },
    select: NOTE_SELECT,
  });
}

export async function remove(id: bigint, userId: bigint): Promise<void> {
  const note = await prisma.lessonNote.findFirst({ where: { id, userId, deletedAt: null } });
  if (!note) throw HttpError.notFound('Note not found');
  await prisma.lessonNote.update({ where: { id }, data: { deletedAt: new Date() } });
}
