/**
 * One-off repair after the "completion downgrade" bug:
 *  1. Any lesson_progress row that has completedAt but isn't COMPLETED → COMPLETED.
 *  2. Recompute every enrollment's progressPct + status from completed required lessons.
 *     (Never downgrades an enrollment that is already COMPLETED.)
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const fixed = await prisma.lessonProgress.updateMany({
    where: { completedAt: { not: null }, status: { not: 'COMPLETED' } },
    data: { status: 'COMPLETED' },
  });
  console.log('lesson_progress rows restored to COMPLETED:', fixed.count);

  const enrollments = await prisma.enrollment.findMany({
    where: { deletedAt: null },
    select: { id: true, userId: true, courseId: true, status: true, startedAt: true },
  });

  let updated = 0;
  for (const e of enrollments) {
    if (e.status === 'WITHDRAWN' || e.status === 'EXPIRED') continue;

    const totalRequired = await prisma.lesson.count({
      where: { module: { courseId: e.courseId }, deletedAt: null, isRequired: true },
    });
    if (totalRequired === 0) continue;

    const completedRequired = await prisma.lessonProgress.count({
      where: {
        userId: e.userId,
        status: 'COMPLETED',
        lesson: { module: { courseId: e.courseId }, deletedAt: null, isRequired: true },
      },
    });

    const progressPct = Math.round((completedRequired / totalRequired) * 100);
    const isDone = completedRequired >= totalRequired;

    if (e.status === 'COMPLETED') {
      if (progressPct !== 100) {
        await prisma.enrollment.update({ where: { id: e.id }, data: { progressPct: 100 } });
        updated++;
      }
      continue;
    }

    await prisma.enrollment.update({
      where: { id: e.id },
      data: {
        status: isDone ? 'COMPLETED' : progressPct > 0 ? 'IN_PROGRESS' : e.status,
        progressPct,
        startedAt: e.startedAt ?? (progressPct > 0 ? new Date() : null),
        completedAt: isDone ? new Date() : null,
      },
    });
    updated++;
  }
  console.log('enrollments recomputed:', updated);
}
main().catch(console.error).finally(() => prisma.$disconnect());
