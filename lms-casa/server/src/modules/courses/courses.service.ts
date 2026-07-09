import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { paginated, skipTake } from '../../utils/pagination.js';
import { sanitizeRichHtml } from '../../utils/sanitizeHtml.js';
import type {
  CourseListQuery,
  CreateCourseInput,
  UpdateCourseInput,
} from './courses.schema.js';

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'HR'];

const COURSE_SUMMARY_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  coverImageUrl: true,
  status: true,
  visibility: true,
  estimatedMinutes: true,
  passingScore: true,
  antiAfkEnabled: true,
  unlockNextCourseId: true,
  authorId: true,
  categoryId: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { modules: true, enrollments: true } },
} satisfies Prisma.CourseSelect;

const COURSE_LIST_SELECT = {
  ...COURSE_SUMMARY_SELECT,
  author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  category: { select: { id: true, name: true, slug: true } },
  modules: {
    where: { deletedAt: null },
    select: { _count: { select: { lessons: { where: { deletedAt: null } } } } },
  },
} satisfies Prisma.CourseSelect;

type RawCourseListItem = Prisma.CourseGetPayload<{ select: typeof COURSE_LIST_SELECT }>;

function shapeCourseListItem(course: RawCourseListItem) {
  const { modules, ...rest } = course;
  const lessonCount = modules.reduce((sum, m) => sum + m._count.lessons, 0);
  return { ...rest, lessonCount };
}

export async function list(query: CourseListQuery) {
  const where: Prisma.CourseWhereInput = { deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.visibility) where.visibility = query.visibility;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.authorId) where.authorId = query.authorId;
  if (query.q) {
    where.OR = [
      { title: { contains: query.q } },
      { slug: { contains: query.q } },
      { summary: { contains: query.q } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.course.findMany({
      where,
      ...skipTake(query.page, query.pageSize),
      orderBy: { id: 'desc' },
      select: COURSE_LIST_SELECT,
    }),
    prisma.course.count({ where }),
  ]);

  return paginated(rows.map(shapeCourseListItem), total, query.page, query.pageSize);
}

async function loadCourseDetail(id: bigint) {
  const course = await prisma.course.findFirst({
    where: { id, deletedAt: null },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      category: { select: { id: true, name: true, slug: true } },
      tags: { include: { tag: { select: { id: true, name: true } } } },
      modules: {
        where: { deletedAt: null },
        orderBy: { orderIndex: 'asc' },
        include: {
          lessons: {
            where: { deletedAt: null },
            orderBy: { orderIndex: 'asc' },
            select: {
              id: true,
              title: true,
              summary: true,
              orderIndex: true,
              durationSeconds: true,
              isRequired: true,
            },
          },
        },
      },
      _count: { select: { enrollments: true, exams: true } },
    },
  });
  if (!course) throw HttpError.notFound('ไม่พบหลักสูตร');

  // Gated when another course unlocks this one (must redeem a code to enroll).
  const requiresUnlockCode =
    (await prisma.course.count({ where: { unlockNextCourseId: id, deletedAt: null } })) > 0;
  return { ...course, requiresUnlockCode };
}

export async function getById(id: bigint, actor?: { userId: bigint; roles: string[] }) {
  const course = await loadCourseDetail(id);

  if (course.status !== 'PUBLISHED') {
    const isStaff = actor?.roles.some((r) => STAFF_ROLES.includes(r)) ?? false;
    const isAuthor = actor != null && course.authorId === actor.userId;
    if (!isStaff && !isAuthor) throw HttpError.notFound('ไม่พบหลักสูตร');
  }

  return course;
}

/** Turn a title into a URL-safe base; falls back to "course" when there are no ASCII word chars (e.g. Thai titles). */
function slugifyBase(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
  return base || 'course';
}

/** Generate a slug that is unique in the courses table. */
async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugifyBase(title);
  // Try the bare base first, then append short suffixes until it's free.
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Date.now().toString(36)}${attempt}`;
    const dup = await prisma.course.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!dup) return candidate;
  }
  // Extremely unlikely fallback.
  return `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function create(input: CreateCourseInput, authorId: bigint) {
  let slug: string;
  if (input.slug) {
    const dup = await prisma.course.findUnique({ where: { slug: input.slug } });
    if (dup) throw HttpError.conflict('ชื่อ slug นี้ถูกใช้แล้ว');
    slug = input.slug;
  } else {
    slug = await generateUniqueSlug(input.title);
  }

  const created = await prisma.course.create({
    data: {
      title: input.title,
      slug,
      summary: input.summary,
      description: sanitizeRichHtml(input.description) ?? undefined,
      coverImageUrl: input.coverImageUrl,
      visibility: input.visibility ?? 'INTERNAL',
      estimatedMinutes: input.estimatedMinutes,
      recurringMonths: input.recurringMonths,
      passingScore: input.passingScore,
      antiAfkEnabled: input.antiAfkEnabled ?? true,
      unlockNextCourseId: input.unlockNextCourseId ?? undefined,
      categoryId: input.categoryId,
      authorId,
      tags: input.tagIds
        ? { create: input.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
    select: COURSE_SUMMARY_SELECT,
  });
  return created;
}

export async function update(id: bigint, input: UpdateCourseInput) {
  const target = await prisma.course.findFirst({ where: { id, deletedAt: null } });
  if (!target) throw HttpError.notFound('ไม่พบหลักสูตร');

  if (input.slug && input.slug !== target.slug) {
    const dup = await prisma.course.findUnique({ where: { slug: input.slug } });
    if (dup) throw HttpError.conflict('ชื่อ slug นี้ถูกใช้แล้ว');
  }

  const { tagIds, ...patch } = input;
  if (patch.description !== undefined) {
    patch.description = sanitizeRichHtml(patch.description) ?? undefined;
  }

  await prisma.$transaction(async (tx) => {
    await tx.course.update({ where: { id }, data: patch as Prisma.CourseUpdateInput });
    if (tagIds) {
      await tx.courseTag.deleteMany({ where: { courseId: id } });
      if (tagIds.length > 0) {
        await tx.courseTag.createMany({
          data: tagIds.map((tagId) => ({ courseId: id, tagId })),
          skipDuplicates: true,
        });
      }
    }
  });

  return loadCourseDetail(id);
}

export async function publish(id: bigint) {
  const target = await prisma.course.findFirst({ where: { id, deletedAt: null } });
  if (!target) throw HttpError.notFound('ไม่พบหลักสูตร');
  if (target.status === 'PUBLISHED') return target;
  if (target.status === 'ARCHIVED') {
    throw HttpError.badRequest('ไม่สามารถเผยแพร่หลักสูตรที่ถูกเก็บถาวรแล้ว');
  }
  return prisma.course.update({
    where: { id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
    select: COURSE_SUMMARY_SELECT,
  });
}

export async function archive(id: bigint) {
  const target = await prisma.course.findFirst({ where: { id, deletedAt: null } });
  if (!target) throw HttpError.notFound('ไม่พบหลักสูตร');
  return prisma.course.update({
    where: { id },
    data: { status: 'ARCHIVED' },
    select: COURSE_SUMMARY_SELECT,
  });
}

export async function softDelete(id: bigint): Promise<void> {
  const target = await prisma.course.findFirst({ where: { id, deletedAt: null } });
  if (!target) throw HttpError.notFound('ไม่พบหลักสูตร');
  await prisma.course.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
