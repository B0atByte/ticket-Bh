/**
 * Clear ONE user's exam history only: all exam attempts (any type) + responses,
 * and the XP earned from exams. Does NOT touch lesson progress or enrollments.
 * Course "star" status recomputes automatically (it derives from post-test attempts).
 * Backs everything up first.
 *
 * Run: npx tsx scripts/reset-exams-user.ts <userId>   (default 7 = Employee Member)
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

  const attempts = await prisma.examAttempt.findMany({ where: { userId } });
  const attemptIds = attempts.map((a) => a.id);
  if (attemptIds.length === 0) {
    console.log('No exam attempts — nothing to clear.');
    return;
  }

  const responses = await prisma.attemptResponse.findMany({ where: { attemptId: { in: attemptIds } } });
  const examPointEvents = await prisma.pointEvent.findMany({
    where: { userId, type: { in: ['EXAM_PASSED', 'EXAM_PERFECT_SCORE'] } },
  });
  const xpToRemove = examPointEvents.reduce((s, e) => s + e.amount, 0);

  // ── BACKUP (must succeed before any delete) ──
  const dir = path.resolve(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `exams-user${userId}-backup-${stamp}.json`);
  const payload = JSON.stringify(
    { takenAt: new Date().toISOString(), user, attempts, responses, examPointEvents },
    bigintReplacer, 0,
  );
  writeFileSync(file, payload, 'utf8');
  if (!existsSync(file) || statSync(file).size < 2) throw new Error('Backup failed — ABORTING, nothing deleted.');
  console.log(`Backup written: ${file}`);
  console.log(`Found ${attempts.length} attempts, ${responses.length} responses, ${examPointEvents.length} XP events (${xpToRemove} XP).`);

  // ── DELETE (atomic) ──
  const [respDel, attDel, peDel] = await prisma.$transaction([
    prisma.attemptResponse.deleteMany({ where: { attemptId: { in: attemptIds } } }),
    prisma.examAttempt.deleteMany({ where: { id: { in: attemptIds } } }),
    prisma.pointEvent.deleteMany({ where: { userId, type: { in: ['EXAM_PASSED', 'EXAM_PERFECT_SCORE'] } } }),
  ]);

  if (xpToRemove > 0) {
    const up = await prisma.userPoints.findUnique({ where: { userId }, select: { totalXp: true } });
    if (up) {
      await prisma.userPoints.update({
        where: { userId },
        data: { totalXp: Math.max(0, up.totalXp - xpToRemove) },
      });
    }
  }

  console.log('Cleared:', {
    attemptResponses: respDel.count,
    examAttempts: attDel.count,
    examPointEvents: peDel.count,
    xpSubtracted: xpToRemove,
  });
  console.log('Done — exam history cleared; lessons/enrollments untouched.');
}

main().catch((e) => { console.error('FAILED:', e); process.exitCode = 1; }).finally(() => void prisma.$disconnect());
