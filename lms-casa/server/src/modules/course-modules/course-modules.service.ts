import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import type { CreateModuleInput, UpdateModuleInput } from './course-modules.schema.js';

async function ensureCourse(courseId: bigint) {
  const course = await prisma.course.findFirst({ where: { id: courseId, deletedAt: null } });
  if (!course) throw HttpError.notFound('Course not found');
  return course;
}

export async function listByCourse(courseId: bigint) {
  await ensureCourse(courseId);
  return prisma.module.findMany({
    where: { courseId, deletedAt: null },
    orderBy: { orderIndex: 'asc' },
    include: {
      _count: { select: { lessons: true } },
    },
  });
}

export async function create(courseId: bigint, input: CreateModuleInput) {
  await ensureCourse(courseId);
  const max = await prisma.module.aggregate({
    where: { courseId, deletedAt: null },
    _max: { orderIndex: true },
  });
  const next = (max._max.orderIndex ?? -1) + 1;
  return prisma.module.create({
    data: {
      courseId,
      title: input.title,
      description: input.description,
      orderIndex: next,
    },
  });
}

export async function update(id: bigint, input: UpdateModuleInput) {
  const m = await prisma.module.findFirst({ where: { id, deletedAt: null } });
  if (!m) throw HttpError.notFound('Module not found');
  return prisma.module.update({ where: { id }, data: input });
}

export async function softDelete(id: bigint): Promise<void> {
  const m = await prisma.module.findFirst({ where: { id, deletedAt: null } });
  if (!m) throw HttpError.notFound('Module not found');
  await prisma.module.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function reorder(courseId: bigint, orderedIds: bigint[]): Promise<void> {
  await ensureCourse(courseId);
  const existing = await prisma.module.findMany({
    where: { courseId, deletedAt: null },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((m) => m.id));
  if (orderedIds.length !== existingIds.size) {
    throw HttpError.badRequest('orderedIds must contain all module ids exactly once');
  }
  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      throw HttpError.badRequest(`Module ${id} does not belong to course ${courseId}`);
    }
  }
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.module.update({ where: { id }, data: { orderIndex: idx } }),
    ),
  );
}
