/**
 * Reset ONE user's training history to a clean slate.
 * Clears their exam attempts (+responses), lesson progress, and XP/points ledger;
 * resets their enrollments back to ASSIGNED / 0%. Backs everything up first.
 *
 * Run: npx tsx scripts/reset-learning-user.ts <userId>   (default 7 = Employee Member)
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();
const userId = BigInt(process.argv[2] ?? '7');

function bigintReplacer(_k: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v;
}

async function main(): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  if (!user) throw new Error(`User ${userId} not found.`);
  console.log(`Target: ${user.firstName} ${user.lastName} <${user.email}> (id ${user.id})`);

  const attempts = await prisma.examAttempt.findMany({ where: { userId }, select: { id: true } });
  const attemptIds = attempts.map((a) => a.id);

  // ── snapshot for backup ──
  const [responses, lessonProgress, pointEvents, userPoints, enrollments] = await Promise.all([
    attemptIds.length ? prisma.attemptResponse.findMany({ where: { attemptId: { in: attemptIds } } }) : [],
    prisma.lessonProgress.findMany({ where: { userId } }),
    prisma.pointEvent.findMany({ where: { userId } }),
    prisma.userPoints.findMany({ where: { userId } }),
    prisma.enrollment.findMany({ where: { userId } }),
  ]);
  const fullAttempts = await prisma.examAttempt.findMany({ where: { userId } });

  const before = {
    examAttempts: fullAttempts.length,
    attemptResponses: responses.length,
    lessonProgress: lessonProgress.length,
    pointEvents: pointEvents.length,
    userPoints: userPoints.length,
    enrollments: enrollments.length,
  };

  // ── BACKUP (must succeed before any delete) ──
  const dir = path.resolve(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `learning-user${userId}-backup-${stamp}.json`);
  const payload = JSON.stringify(
    { takenAt: new Date().toISOString(), user, counts: before,
      data: { examAttempts: fullAttempts, attemptResponses: responses, lessonProgress, pointEvents, userPoints, enrollments } },
    bigintReplacer, 0,
  );
  writeFileSync(file, payload, 'utf8');
  if (!existsSync(file) || statSync(file).size < 2) throw new Error('Backup failed — ABORTING, nothing deleted.');
  console.log(`Backup written: ${file}`);
  console.log('Before:', before);

  // ── RESET (atomic) ──
  const [respDel, attDel, lpDel, peDel, upDel, enrUpd] = await prisma.$transaction([
    attemptIds.length
      ? prisma.attemptResponse.deleteMany({ where: { attemptId: { in: attemptIds } } })
      : prisma.attemptResponse.deleteMany({ where: { attemptId: { in: [] } } }),
    prisma.examAttempt.deleteMany({ where: { userId } }),
    prisma.lessonProgress.deleteMany({ where: { userId } }),
    prisma.pointEvent.deleteMany({ where: { userId } }),
    prisma.userPoints.deleteMany({ where: { userId } }),
    prisma.enrollment.updateMany({
      where: { userId },
      data: { status: 'ASSIGNED', progressPct: 0, startedAt: null, completedAt: null },
    }),
  ]);

  console.log('Cleared:', {
    attemptResponses: respDel.count,
    examAttempts: attDel.count,
    lessonProgress: lpDel.count,
    pointEvents: peDel.count,
    userPoints: upDel.count,
    enrollmentsReset: enrUpd.count,
  });
  console.log('Done — Employee Member can start fresh.');
}

main().catch((e) => { console.error('FAILED:', e); process.exitCode = 1; }).finally(() => void prisma.$disconnect());
