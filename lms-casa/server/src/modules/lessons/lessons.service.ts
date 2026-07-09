import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import type {
  CreateLessonInput,
  UpdateLessonInput,
  UpsertLessonContentInput,
} from './lessons.schema.js';

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'HR'];

async function ensureModule(moduleId: bigint) {
  const m = await prisma.module.findFirst({ where: { id: moduleId, deletedAt: null } });
  if (!m) throw HttpError.notFound('ไม่พบโมดูล');
  return m;
}

export async function listByModule(moduleId: bigint) {
  await ensureModule(moduleId);
  return prisma.lesson.findMany({
    where: { moduleId, deletedAt: null },
    orderBy: { orderIndex: 'asc' },
    include: {
      contents: {
        where: { deletedAt: null },
        orderBy: { orderIndex: 'asc' },
      },
    },
  });
}

export async function getById(id: bigint, actor?: { userId: bigint; roles: string[] }) {
  const lesson = await prisma.lesson.findFirst({
    where: { id, deletedAt: null },
    include: {
      module: {
        select: { courseId: true, course: { select: { status: true, authorId: true } } },
      },
      contents: {
        where: { deletedAt: null },
        orderBy: { orderIndex: 'asc' },
      },
    },
  });
  if (!lesson) throw HttpError.notFound('ไม่พบบทเรียน');
  const { module, ...rest } = lesson;
  const { courseId, course } = module;

  const isStaff = actor?.roles.some((r) => STAFF_ROLES.includes(r)) ?? false;
  const isAuthor = actor != null && course.authorId === actor.userId;

  if (!isStaff && !isAuthor) {
    if (course.status !== 'PUBLISHED') throw HttpError.notFound('ไม่พบบทเรียน');
    const enrollment = actor
      ? await prisma.enrollment.findFirst({
          where: { userId: actor.userId, courseId, deletedAt: null },
          select: { id: true },
        })
      : null;
    if (!enrollment) throw HttpError.forbidden('ต้องลงทะเบียนเรียนหลักสูตรนี้ก่อน');
  }

  return { ...rest, courseId };
}

export async function create(moduleId: bigint, input: CreateLessonInput) {
  await ensureModule(moduleId);
  const max = await prisma.lesson.aggregate({
    where: { moduleId, deletedAt: null },
    _max: { orderIndex: true },
  });
  return prisma.lesson.create({
    data: {
      moduleId,
      title: input.title,
      summary: input.summary,
      durationSeconds: input.durationSeconds,
      isRequired: input.isRequired ?? true,
      orderIndex: (max._max.orderIndex ?? -1) + 1,
    },
  });
}

export async function update(id: bigint, input: UpdateLessonInput) {
  const lesson = await prisma.lesson.findFirst({ where: { id, deletedAt: null } });
  if (!lesson) throw HttpError.notFound('ไม่พบบทเรียน');
  return prisma.lesson.update({ where: { id }, data: input });
}

export async function softDelete(id: bigint): Promise<void> {
  const lesson = await prisma.lesson.findFirst({ where: { id, deletedAt: null } });
  if (!lesson) throw HttpError.notFound('ไม่พบบทเรียน');
  await prisma.lesson.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function reorder(moduleId: bigint, orderedIds: bigint[]): Promise<void> {
  await ensureModule(moduleId);
  const existing = await prisma.lesson.findMany({
    where: { moduleId, deletedAt: null },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((l) => l.id));
  if (orderedIds.length !== existingIds.size) {
    throw HttpError.badRequest('orderedIds ต้องประกอบด้วย id ของบทเรียนทุกอันพอดี');
  }
  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      throw HttpError.badRequest(`บทเรียน ${id} ไม่ได้อยู่ในโมดูล ${moduleId}`);
    }
  }
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.lesson.update({ where: { id }, data: { orderIndex: idx } }),
    ),
  );
}

export async function addContent(lessonId: bigint, input: UpsertLessonContentInput) {
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, deletedAt: null } });
  if (!lesson) throw HttpError.notFound('ไม่พบบทเรียน');
  const max = await prisma.lessonContent.aggregate({
    where: { lessonId, deletedAt: null },
    _max: { orderIndex: true },
  });
  return prisma.lessonContent.create({
    data: {
      lessonId,
      type: input.type,
      title: input.title,
      body: input.body,
      url: input.url,
      fileId: input.fileId,
      meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      orderIndex: (max._max.orderIndex ?? -1) + 1,
    },
  });
}

export async function removeContent(contentId: bigint): Promise<void> {
  const c = await prisma.lessonContent.findFirst({ where: { id: contentId, deletedAt: null } });
  if (!c) throw HttpError.notFound('ไม่พบเนื้อหา');
  await prisma.lessonContent.update({ where: { id: contentId }, data: { deletedAt: new Date() } });
}
