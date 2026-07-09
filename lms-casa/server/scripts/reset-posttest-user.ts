/**
 * Clear a single user's POST_TEST history so they can re-test from scratch.
 * Deletes their POST_TEST exam attempts (+ responses) and the XP point events
 * earned from those post-tests. Backs everything up first.
 *
 * Run: npx tsx scripts/reset-posttest-user.ts <userId>   (default 25)
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();
const userId = BigInt(process.argv[2] ?? '25');

async function main(): Promise<void> {
  const attempts = await prisma.examAttempt.findMany({
    where: { userId, exam: { type: 'POST_TEST' } },
    select: { id: true, examId: true, attemptNumber: true, status: true, passed: true, scorePct: true },
  });
  const attemptIds = attempts.map((a) => a.id);
  const examIds = [...new Set(attempts.map((a) => a.examId.toString()))];

  if (attemptIds.length === 0) {
    console.log(`User ${userId} has no POST_TEST attempts. Nothing to clear.`);
    return;
  }

  const responses = await prisma.attemptResponse.findMany({ where: { attemptId: { in: attemptIds } } });

  // XP earned from these post-tests (awardSafely keys: exam:<id> and exam:<id>:perfect)
  const idemKeys = examIds.flatMap((id) => [`exam:${id}`, `exam:${id}:perfect`]);
  const pointEvents = await prisma.pointEvent.findMany({
    where: { userId, type: { in: ['EXAM_PASSED', 'EXAM_PERFECT_SCORE'] }, idempotencyKey: { in: idemKeys } },
  });
  const xpToRemove = pointEvents.reduce((s, e) => s + e.amount, 0);

  // ── BACKUP ──
  const dir = path.resolve(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `posttest-user${userId}-backup-${stamp}.json`);
  const payload = JSON.stringify(
    { takenAt: new Date().toISOString(), userId: userId.toString(), attempts, responses, pointEvents },
    (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
    0,
  );
  writeFileSync(file, payload, 'utf8');
  if (!existsSync(file) || statSync(file).size < 2) throw new Error('Backup failed — ABORTING, nothing deleted.');
  console.log(`Backup written: ${file}`);
  console.log(`Found ${attempts.length} POST_TEST attempts, ${responses.length} responses, ${pointEvents.length} XP events (${xpToRemove} XP).`);

  // ── DELETE (atomic) ──
  const [respDel, attDel, peDel] = await prisma.$transaction([
    prisma.attemptResponse.deleteMany({ where: { attemptId: { in: attemptIds } } }),
    prisma.examAttempt.deleteMany({ where: { id: { in: attemptIds } } }),
    prisma.pointEvent.deleteMany({
      where: { userId, type: { in: ['EXAM_PASSED', 'EXAM_PERFECT_SCORE'] }, idempotencyKey: { in: idemKeys } },
    }),
  ]);

  // Subtract the removed XP from the user's total (never below 0).
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
    pointEvents: peDel.count,
    xpSubtracted: xpToRemove,
  });
  console.log('Done — user can retake the post-test(s) cleanly.');
}

main().catch((e) => { console.error('FAILED:', e); process.exitCode = 1; }).finally(() => void prisma.$disconnect());
