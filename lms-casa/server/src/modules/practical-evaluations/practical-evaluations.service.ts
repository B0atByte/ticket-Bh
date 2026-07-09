import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import type {
  ReorderCriteriaInput,
  SubmitEvaluationInput,
  UpsertCriterionInput,
} from './practical-evaluations.schema.js';

const GRADE_OVERRIDE_ROLES = ['SUPER_ADMIN', 'ADMIN'];

async function ensureCourse(courseId: bigint) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null },
    select: { id: true },
  });
  if (!course) throw HttpError.notFound('ไม่พบหลักสูตร');
  return course;
}

/** Only the course's author (instructor) or an admin/super-admin can view/grade. */
function ensureCanGrade(
  course: { authorId: bigint | null },
  actorId: bigint,
  actorRoles: string[],
): void {
  if (actorRoles.some((r) => GRADE_OVERRIDE_ROLES.includes(r))) return;
  if (course.authorId != null && course.authorId === actorId) return;
  throw HttpError.forbidden('คุณไม่มีสิทธิ์ประเมินภาคปฏิบัติของหลักสูตรนี้');
}

async function getEnrollmentWithCourse(enrollmentId: bigint) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      courseId: true,
      course: { select: { id: true, authorId: true, title: true } },
    },
  });
  if (!enrollment) throw HttpError.notFound('ไม่พบข้อมูลการลงทะเบียน');
  return enrollment;
}

// ─────────────────────────────────────────────────────────────────────────
// Criteria (checklist) — ตั้งล่วงหน้าโดย admin ต่อคอร์ส
// ─────────────────────────────────────────────────────────────────────────

export async function listCriteria(courseId: bigint) {
  await ensureCourse(courseId);
  return prisma.practicalEvaluationCriterion.findMany({
    where: { courseId, deletedAt: null },
    orderBy: { orderIndex: 'asc' },
  });
}

export async function createCriterion(courseId: bigint, input: UpsertCriterionInput) {
  await ensureCourse(courseId);
  const max = await prisma.practicalEvaluationCriterion.aggregate({
    where: { courseId, deletedAt: null },
    _max: { orderIndex: true },
  });
  return prisma.practicalEvaluationCriterion.create({
    data: {
      courseId,
      title: input.title,
      orderIndex: (max._max.orderIndex ?? -1) + 1,
    },
  });
}

export async function updateCriterion(id: bigint, input: UpsertCriterionInput) {
  const criterion = await prisma.practicalEvaluationCriterion.findFirst({
    where: { id, deletedAt: null },
  });
  if (!criterion) throw HttpError.notFound('ไม่พบหัวข้อประเมิน');
  return prisma.practicalEvaluationCriterion.update({
    where: { id },
    data: { title: input.title },
  });
}

export async function deleteCriterion(id: bigint): Promise<void> {
  const criterion = await prisma.practicalEvaluationCriterion.findFirst({
    where: { id, deletedAt: null },
  });
  if (!criterion) throw HttpError.notFound('ไม่พบหัวข้อประเมิน');
  await prisma.practicalEvaluationCriterion.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function reorderCriteria(courseId: bigint, input: ReorderCriteriaInput): Promise<void> {
  await ensureCourse(courseId);
  const existing = await prisma.practicalEvaluationCriterion.findMany({
    where: { courseId, deletedAt: null },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((c) => c.id));
  if (input.orderedIds.length !== existingIds.size) {
    throw HttpError.badRequest('orderedIds ต้องประกอบด้วยหัวข้อประเมินทุกอันพอดี');
  }
  for (const id of input.orderedIds) {
    if (!existingIds.has(id)) {
      throw HttpError.badRequest(`หัวข้อประเมิน ${id} ไม่ได้อยู่ในหลักสูตรนี้`);
    }
  }
  await prisma.$transaction(
    input.orderedIds.map((id, idx) =>
      prisma.practicalEvaluationCriterion.update({ where: { id }, data: { orderIndex: idx } }),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Evaluation — ผู้สอน (course author) หรือ admin ประเมินผู้เรียนแต่ละคน
// ─────────────────────────────────────────────────────────────────────────

interface EnrollmentRef {
  id: bigint;
  userId: bigint;
  courseId: bigint;
}

async function buildEvaluationView(enrollment: EnrollmentRef) {
  const [criteria, evaluation] = await Promise.all([
    prisma.practicalEvaluationCriterion.findMany({
      where: { courseId: enrollment.courseId, deletedAt: null },
      orderBy: { orderIndex: 'asc' },
    }),
    prisma.practicalEvaluation.findUnique({
      where: { enrollmentId: enrollment.id },
      include: { items: true },
    }),
  ]);

  const checkedMap = new Map(
    (evaluation?.items ?? []).map((item) => [item.criterionId.toString(), item.checked]),
  );

  return {
    enrollmentId: enrollment.id,
    courseId: enrollment.courseId,
    learnerId: enrollment.userId,
    result: evaluation?.result ?? 'PENDING',
    starRating: evaluation?.starRating ?? null,
    comment: evaluation?.comment ?? null,
    evaluatedById: evaluation?.evaluatedById ?? null,
    evaluatedAt: evaluation?.evaluatedAt ?? null,
    criteria: criteria.map((c) => ({
      id: c.id,
      title: c.title,
      orderIndex: c.orderIndex,
      checked: checkedMap.get(c.id.toString()) ?? false,
    })),
  };
}

export async function getEvaluationForEnrollment(
  enrollmentId: bigint,
  actorId: bigint,
  actorRoles: string[],
) {
  const enrollment = await getEnrollmentWithCourse(enrollmentId);
  ensureCanGrade(enrollment.course, actorId, actorRoles);
  return buildEvaluationView(enrollment);
}

export async function submitEvaluation(
  enrollmentId: bigint,
  actorId: bigint,
  actorRoles: string[],
  input: SubmitEvaluationInput,
) {
  const enrollment = await getEnrollmentWithCourse(enrollmentId);
  ensureCanGrade(enrollment.course, actorId, actorRoles);

  const criteria = await prisma.practicalEvaluationCriterion.findMany({
    where: { courseId: enrollment.courseId, deletedAt: null },
    select: { id: true },
  });
  const validIds = new Set(criteria.map((c) => c.id.toString()));
  const items = input.items.filter((item) => validIds.has(item.criterionId.toString()));

  const evaluation = await prisma.practicalEvaluation.upsert({
    where: { enrollmentId },
    create: {
      enrollmentId,
      result: input.result,
      starRating: input.starRating ?? null,
      comment: input.comment || null,
      evaluatedById: actorId,
      evaluatedAt: new Date(),
    },
    update: {
      result: input.result,
      starRating: input.starRating ?? null,
      comment: input.comment || null,
      evaluatedById: actorId,
      evaluatedAt: new Date(),
    },
  });

  if (items.length > 0) {
    await prisma.$transaction(
      items.map((item) =>
        prisma.practicalEvaluationItem.upsert({
          where: {
            evaluationId_criterionId: {
              evaluationId: evaluation.id,
              criterionId: item.criterionId,
            },
          },
          create: {
            evaluationId: evaluation.id,
            criterionId: item.criterionId,
            checked: item.checked,
          },
          update: { checked: item.checked },
        }),
      ),
    );
  }

  return buildEvaluationView(enrollment);
}

/** Read-only view for the learner themselves. */
export async function getMyEvaluation(userId: bigint, courseId: bigint) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId, deletedAt: null },
    select: { id: true, userId: true, courseId: true },
  });
  if (!enrollment) throw HttpError.notFound('ไม่พบข้อมูลการลงทะเบียน');
  return buildEvaluationView(enrollment);
}
