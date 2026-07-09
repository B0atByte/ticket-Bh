import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  txn: vi.fn(),
  pointEventCreate: vi.fn(),
  userPointsUpsert: vi.fn(),
  userPointsFindMany: vi.fn(),
  userPointsFindUnique: vi.fn(),
  userPointsCount: vi.fn(),
  pointEventFindMany: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    $transaction: mocks.txn,
    pointEvent: { findMany: mocks.pointEventFindMany },
    userPoints: {
      findMany: mocks.userPointsFindMany,
      findUnique: mocks.userPointsFindUnique,
      count: mocks.userPointsCount,
    },
    user: { findUnique: mocks.userFindUnique },
  },
}));

import { award, leaderboard, getMySummary, levelFromXp } from './points.service.js';

describe('levelFromXp', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, levelFloorXp: 0, nextLevelXp: 100 });
  });

  it('stays level 1 just below the level-2 threshold', () => {
    expect(levelFromXp(99).level).toBe(1);
  });

  it('reaches level 2 exactly at the threshold', () => {
    expect(levelFromXp(100)).toMatchObject({ level: 2, levelFloorXp: 100, nextLevelXp: 250 });
  });

  it('caps at the max level past the last threshold', () => {
    const out = levelFromXp(999999);
    expect(out.level).toBe(10);
    expect(out.nextLevelXp).toBeNull();
  });

  it('treats negative XP as level 1', () => {
    expect(levelFromXp(-50).level).toBe(1);
  });
});

describe('points.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  describe('award', () => {
    it('inserts event + bumps total in a transaction with default amount', async () => {
      const txClient = {
        pointEvent: { create: mocks.pointEventCreate },
        userPoints: { upsert: mocks.userPointsUpsert },
      };
      mocks.txn.mockImplementation(async (fn: (tx: typeof txClient) => unknown) => fn(txClient));
      mocks.pointEventCreate.mockResolvedValueOnce({ id: 1n });
      mocks.userPointsUpsert.mockResolvedValueOnce({});

      const result = await award({ userId: 5n, type: 'LESSON_COMPLETED' });

      expect(result).toEqual({ id: 1n });
      expect(mocks.pointEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 5n, type: 'LESSON_COMPLETED', amount: 10 }),
      });
      expect(mocks.userPointsUpsert).toHaveBeenCalledWith({
        where: { userId: 5n },
        create: { userId: 5n, totalXp: 10 },
        update: { totalXp: { increment: 10 } },
      });
    });

    it('returns null silently on duplicate idempotency key (P2002)', async () => {
      mocks.txn.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5' }),
      );
      const result = await award({
        userId: 5n,
        type: 'EXAM_PASSED',
        idempotencyKey: 'exam:1',
      });
      expect(result).toBeNull();
    });

    it('returns null when amount is zero (ADJUSTMENT default)', async () => {
      const result = await award({ userId: 5n, type: 'ADJUSTMENT' });
      expect(result).toBeNull();
      expect(mocks.txn).not.toHaveBeenCalled();
    });

    it('rejects negative amount', async () => {
      await expect(award({ userId: 5n, type: 'ADJUSTMENT', amount: -1 })).rejects.toThrow();
    });
  });

  describe('leaderboard', () => {
    it('returns ranked entries for org scope', async () => {
      mocks.userPointsFindMany.mockResolvedValueOnce([
        {
          totalXp: 200,
          userId: 1n,
          user: {
            firstName: 'A',
            lastName: 'B',
            avatarUrl: null,
            departmentId: null,
            department: null,
          },
        },
        {
          totalXp: 100,
          userId: 2n,
          user: {
            firstName: 'C',
            lastName: 'D',
            avatarUrl: 'x.png',
            departmentId: 7n,
            department: { name: 'Eng' },
          },
        },
      ]);
      const out = await leaderboard({ scope: 'org' });
      expect(out).toHaveLength(2);
      expect(out[0]).toMatchObject({ rank: 1, userId: '1', totalXp: 200 });
      expect(out[1]).toMatchObject({ rank: 2, departmentName: 'Eng', departmentId: '7' });
    });

    it('returns empty when department scope without departmentId', async () => {
      const out = await leaderboard({ scope: 'department' });
      expect(out).toEqual([]);
      expect(mocks.userPointsFindMany).not.toHaveBeenCalled();
    });

    it('filters by department when provided', async () => {
      mocks.userPointsFindMany.mockResolvedValueOnce([]);
      await leaderboard({ scope: 'department', departmentId: 9n });
      const call = mocks.userPointsFindMany.mock.calls[0][0];
      expect(call.where.user.departmentId).toBe(9n);
    });
  });

  describe('getMySummary', () => {
    it('returns zero state when user has no points', async () => {
      mocks.userFindUnique.mockResolvedValueOnce({ departmentId: null, department: null });
      mocks.userPointsFindUnique.mockResolvedValueOnce(null);
      mocks.pointEventFindMany.mockResolvedValueOnce([]);

      const out = await getMySummary(1n);
      expect(out.totalXp).toBe(0);
      expect(out.rankOrg).toBeNull();
      expect(out.rankDept).toBeNull();
      expect(out.recentEvents).toEqual([]);
    });

    it('computes org rank as ahead+1', async () => {
      mocks.userFindUnique.mockResolvedValueOnce({ departmentId: null, department: null });
      mocks.userPointsFindUnique.mockResolvedValueOnce({ totalXp: 150 });
      mocks.pointEventFindMany.mockResolvedValueOnce([]);
      mocks.userPointsCount.mockResolvedValueOnce(4); // 4 users ahead → rank 5

      const out = await getMySummary(1n);
      expect(out.totalXp).toBe(150);
      expect(out.rankOrg).toBe(5);
      expect(out.rankDept).toBeNull();
    });

    it('computes dept rank when user has a department', async () => {
      mocks.userFindUnique.mockResolvedValueOnce({
        departmentId: 9n,
        department: { name: 'Sales' },
      });
      mocks.userPointsFindUnique.mockResolvedValueOnce({ totalXp: 80 });
      mocks.pointEventFindMany.mockResolvedValueOnce([
        { id: 1n, type: 'EXAM_PASSED', amount: 30, createdAt: new Date(0) },
      ]);
      mocks.userPointsCount.mockResolvedValueOnce(2).mockResolvedValueOnce(0);

      const out = await getMySummary(1n);
      expect(out.departmentName).toBe('Sales');
      expect(out.rankOrg).toBe(3);
      expect(out.rankDept).toBe(1);
      expect(out.recentEvents[0]).toMatchObject({ id: '1', type: 'EXAM_PASSED', amount: 30 });
    });
  });
});
