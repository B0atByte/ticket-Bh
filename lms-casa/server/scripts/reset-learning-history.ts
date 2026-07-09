/**
 * One-off: reset ALL learners' training history to a clean slate.
 *
 * Clears (every user, including admins):
 *   - exam_attempts (+ attempt_responses)
 *   - lesson_progress
 *   - point_events  (XP/stars ledger + idempotency keys)
 *   - user_points   (XP totals)
 * Resets (kept, not deleted):
 *   - enrollments → status ASSIGNED, progressPct 0, startedAt/completedAt null
 *
 * SAFETY: a JSON backup of all affected tables is written FIRST. If the backup
 * cannot be written, the script throws and deletes nothing.
 *
 * Run:  npx tsx scripts/reset-learning-history.ts
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

async function main(): Promise<void> {
  console.log('Reading current data for backup…');
  const [enrollments, lessonProgress, examAttempts, attemptResponses, pointEvents, userPoints] =
    await Promise.all([
      prisma.enrollment.findMany(),
      prisma.lessonProgress.findMany(),
      prisma.examAttempt.findMany(),
      prisma.attemptResponse.findMany(),
      prisma.pointEvent.findMany(),
      prisma.userPoints.findMany(),
    ]);

  const before = {
    enrollments: enrollments.length,
    lessonProgress: lessonProgress.length,
    examAttempts: examAttempts.length,
    attemptResponses: attemptResponses.length,
    pointEvents: pointEvents.length,
    userPoints: userPoints.length,
  };

  // ── 1) BACKUP (must succeed before anything is deleted) ──────────────────────
  const dir = path.resolve(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `learning-history-backup-${stamp}.json`);
  const payload = JSON.stringify(
    {
      takenAt: new Date().toISOString(),
      counts: before,
      data: { enrollments, lessonProgress, examAttempts, attemptResponses, pointEvents, userPoints },
    },
    bigintReplacer,
    0,
  );
  writeFileSync(file, payload, 'utf8');
  if (!existsSync(file) || statSync(file).size < 2) {
    throw new Error('Backup file was not written — ABORTING, no data deleted.');
  }
  console.log(`Backup written: ${file} (${payload.length.toLocaleString()} bytes)`);
  console.log('Before counts:', before);

  // ── 2) RESET (atomic) ────────────────────────────────────────────────────────
  const [respDel, attDel, lpDel, peDel, upDel, enrUpd] = await prisma.$transaction([
    prisma.attemptResponse.deleteMany({}),
    prisma.examAttempt.deleteMany({}),
    prisma.lessonProgress.deleteMany({}),
    prisma.pointEvent.deleteMany({}),
    prisma.userPoints.deleteMany({}),
    prisma.enrollment.updateMany({
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

  // ── 3) VERIFY ─────────────────────────────────────────────────────────────────
  const after = {
    lessonProgress: await prisma.lessonProgress.count(),
    examAttempts: await prisma.examAttempt.count(),
    attemptResponses: await prisma.attemptResponse.count(),
    pointEvents: await prisma.pointEvent.count(),
    userPoints: await prisma.userPoints.count(),
    enrollmentsNotReset: await prisma.enrollment.count({
      where: { OR: [{ progressPct: { not: 0 } }, { status: { not: 'ASSIGNED' } }] },
    }),
  };
  console.log('After counts (should be all 0):', after);
  console.log('Done. Restore from the backup file above if needed.');
}

main()
  .catch((err) => {
    console.error('FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
