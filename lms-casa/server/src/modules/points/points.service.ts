import { Prisma, type PointEventType } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { logger } from '../../utils/logger.js';
import {
  LEADERBOARD_DEFAULT_LIMIT,
  LEADERBOARD_MAX_LIMIT,
  LEVEL_THRESHOLDS,
  POINT_AMOUNTS,
} from './points.constants.js';

export interface LevelInfo {
  level: number;
  totalXp: number;
  /** XP at which the current level began. */
  levelFloorXp: number;
  /** XP threshold for the next level, or null if already at max level. */
  nextLevelXp: number | null;
}

/** Derive a learning level from total XP using LEVEL_THRESHOLDS. */
export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (xp >= (LEVEL_THRESHOLDS[i] as number)) level = i + 1;
    else break;
  }
  return {
    level,
    totalXp: xp,
    levelFloorXp: LEVEL_THRESHOLDS[level - 1] ?? 0,
    nextLevelXp: LEVEL_THRESHOLDS[level] ?? null,
  };
}

export interface AwardInput {
  userId: bigint;
  type: PointEventType;
  amount?: number;
  idempotencyKey?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Awards XP to a user. Inserts a PointEvent and bumps UserPoints.totalXp in a single transaction.
 * If `idempotencyKey` is provided and an event with the same (userId, type, key) already exists,
 * the award is silently skipped — safe to call from completion hooks that may fire repeatedly.
 *
 * Returns the inserted event, or `null` if the award was skipped due to idempotency.
 */
export async function award(input: AwardInput) {
  const amount = input.amount ?? POINT_AMOUNTS[input.type];
  if (!Number.isFinite(amount) || amount < 0) {
    throw HttpError.badRequest('Invalid points amount');
  }
  if (amount === 0) return null;

  try {
    return await prisma.$transaction(async (tx) => {
      const event = await tx.pointEvent.create({
        data: {
          userId: input.userId,
          type: input.type,
          amount,
          idempotencyKey: input.idempotencyKey ?? null,
          metadata: input.metadata ?? undefined,
        },
      });
      await tx.userPoints.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId, totalXp: amount },
        update: { totalXp: { increment: amount } },
      });
      return event;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return null;
    }
    throw e;
  }
}

/**
 * Fire-and-forget award helper used inside other domain transactions/services.
 * Logs failures but never throws so it cannot break the primary action.
 */
export function awardSafely(input: AwardInput): void {
  award(input).catch((e) => {
    logger.error('Failed to award points', {
      error: e instanceof Error ? e.message : String(e),
      userId: input.userId.toString(),
      type: input.type,
    });
  });
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  departmentId: string | null;
  departmentName: string | null;
  totalXp: number;
}

export interface LeaderboardQuery {
  scope: 'org' | 'department';
  departmentId?: bigint;
  limit?: number;
}

export async function leaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
  const limit = clampLimit(query.limit);
  const userWhere: Prisma.UserWhereInput = { status: 'ACTIVE', deletedAt: null };
  if (query.scope === 'department') {
    if (!query.departmentId) return [];
    userWhere.departmentId = query.departmentId;
  }

  const rows = await prisma.userPoints.findMany({
    where: { user: userWhere },
    orderBy: [{ totalXp: 'desc' }, { userId: 'asc' }],
    take: limit,
    select: {
      totalXp: true,
      userId: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          avatarUrl: true,
          departmentId: true,
          department: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    userId: row.userId.toString(),
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    avatarUrl: row.user.avatarUrl,
    departmentId: row.user.departmentId?.toString() ?? null,
    departmentName: row.user.department?.name ?? null,
    totalXp: row.totalXp,
  }));
}

export interface MyPointsSummary {
  totalXp: number;
  rankOrg: number | null;
  rankDept: number | null;
  departmentId: string | null;
  departmentName: string | null;
  recentEvents: Array<{
    id: string;
    type: PointEventType;
    amount: number;
    createdAt: Date;
  }>;
}

export async function getMySummary(userId: bigint): Promise<MyPointsSummary> {
  const [user, points, recentEvents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, department: { select: { name: true } } },
    }),
    prisma.userPoints.findUnique({ where: { userId } }),
    prisma.pointEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, type: true, amount: true, createdAt: true },
    }),
  ]);

  const totalXp = points?.totalXp ?? 0;
  const rankOrg = totalXp > 0 ? await computeRank(userId, totalXp, undefined) : null;
  const rankDept =
    totalXp > 0 && user?.departmentId
      ? await computeRank(userId, totalXp, user.departmentId)
      : null;

  return {
    totalXp,
    rankOrg,
    rankDept,
    departmentId: user?.departmentId?.toString() ?? null,
    departmentName: user?.department?.name ?? null,
    recentEvents: recentEvents.map((e) => ({
      id: e.id.toString(),
      type: e.type,
      amount: e.amount,
      createdAt: e.createdAt,
    })),
  };
}

async function computeRank(
  userId: bigint,
  totalXp: number,
  departmentId: bigint | undefined,
): Promise<number> {
  const userFilter: Prisma.UserWhereInput = { status: 'ACTIVE', deletedAt: null };
  if (departmentId) userFilter.departmentId = departmentId;

  const ahead = await prisma.userPoints.count({
    where: {
      user: userFilter,
      OR: [
        { totalXp: { gt: totalXp } },
        { totalXp: totalXp, userId: { lt: userId } },
      ],
    },
  });
  return ahead + 1;
}

function clampLimit(raw: number | undefined): number {
  if (!raw || raw <= 0) return LEADERBOARD_DEFAULT_LIMIT;
  return Math.min(raw, LEADERBOARD_MAX_LIMIT);
}

export async function getUserDepartmentId(userId: bigint): Promise<bigint | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });
  return u?.departmentId ?? null;
}
