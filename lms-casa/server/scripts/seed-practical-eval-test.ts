/**
 * Seed test data for the Practical Evaluation feature.
 *
 * Creates a PUBLISHED course authored by `instructor@lmscasa.local` with
 * 1 module/1 lesson, 3 practical evaluation criteria, and enrolls
 * `employee@lmscasa.local` at 100% progress (COMPLETED) so the practical
 * evaluation result is the only remaining gate for the course "star".
 *
 * Idempotent: safe to re-run.
 *
 * Run: npx tsx scripts/seed-practical-eval-test.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CRITERIA_TITLES = [
  'ชงกาแฟตามสูตรมาตรฐานได้ถูกต้อง',
  'ทำความสะอาดและดูแลเครื่องชงตามขั้นตอน',
  'ปฏิบัติตามมาตรฐานความปลอดภัยและสุขอนามัย',
];

async function main(): Promise<void> {
  const instructor = await prisma.user.findUniqueOrThrow({ where: { email: 'instructor@lmscasa.local' } });
  const employee = await prisma.user.findUniqueOrThrow({ where: { email: 'employee@lmscasa.local' } });

  const course = await prisma.course.upsert({
    where: { slug: 'practical-eval-demo' },
    create: {
      title: 'ทดสอบภาคปฏิบัติ (Demo)',
      slug: 'practical-eval-demo',
      summary: 'คอร์สสำหรับทดสอบระบบประเมินภาคปฏิบัติ',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      authorId: instructor.id,
    },
    update: { authorId: instructor.id, status: 'PUBLISHED' },
  });

  let module_ = await prisma.module.findFirst({ where: { courseId: course.id, deletedAt: null } });
  if (!module_) {
    module_ = await prisma.module.create({
      data: { courseId: course.id, title: 'บทที่ 1: ทดสอบ', orderIndex: 0 },
    });
  }

  let lesson = await prisma.lesson.findFirst({ where: { moduleId: module_.id, deletedAt: null } });
  if (!lesson) {
    lesson = await prisma.lesson.create({
      data: { moduleId: module_.id, title: 'บทเรียนทดสอบ', orderIndex: 0, isRequired: true },
    });
    await prisma.lessonContent.create({
      data: {
        lessonId: lesson.id,
        type: 'TEXT',
        orderIndex: 0,
        title: 'เนื้อหาทดสอบ',
        body: 'เนื้อหาสำหรับทดสอบระบบประเมินภาคปฏิบัติ',
      },
    });
  }

  // Practical evaluation criteria (skip if already seeded for this course)
  const existingCriteria = await prisma.practicalEvaluationCriterion.count({
    where: { courseId: course.id, deletedAt: null },
  });
  if (existingCriteria === 0) {
    for (let i = 0; i < CRITERIA_TITLES.length; i++) {
      await prisma.practicalEvaluationCriterion.create({
        data: { courseId: course.id, title: CRITERIA_TITLES[i]!, orderIndex: i },
      });
    }
  }

  // Enroll employee at 100% progress / COMPLETED so the practical evaluation
  // result is the only thing left to determine the course star.
  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: employee.id, courseId: course.id } },
    create: {
      userId: employee.id,
      courseId: course.id,
      status: 'COMPLETED',
      progressPct: 100,
      startedAt: new Date(),
      completedAt: new Date(),
    },
    update: { status: 'COMPLETED', progressPct: 100, completedAt: new Date(), deletedAt: null },
  });

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: employee.id, lessonId: lesson.id } },
    create: { userId: employee.id, lessonId: lesson.id, status: 'COMPLETED', completedAt: new Date() },
    update: { status: 'COMPLETED', completedAt: new Date() },
  });

  console.log(`Course #${course.id} "${course.title}" — author: instructor@lmscasa.local`);
  console.log(`Criteria: ${CRITERIA_TITLES.length} (skipped if already present)`);
  console.log(`Enrollment #${enrollment.id} — employee@lmscasa.local @ 100% / COMPLETED`);
  console.log('\nทดสอบ:');
  console.log('  1) login เป็น instructor@lmscasa.local / Instructor@12345 -> เปิดคอร์ส "ทดสอบภาคปฏิบัติ (Demo)" -> แท็บ "ภาคปฏิบัติ" -> ประเมิน employee@lmscasa.local');
  console.log('  2) login เป็น employee@lmscasa.local / Employee@12345 -> เปิดคอร์สเดียวกัน -> ดูการ์ด "ผลประเมินภาคปฏิบัติ"');
}

main()
  .catch((e) => { console.error('FAILED:', e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
