import type { PointEventType } from '@prisma/client';

export const POINT_AMOUNTS: Record<PointEventType, number> = {
  LESSON_COMPLETED: 10,
  COURSE_COMPLETED: 50,
  EXAM_PASSED: 30,
  EXAM_PERFECT_SCORE: 50,
  ADJUSTMENT: 0,
};

export const LEADERBOARD_DEFAULT_LIMIT = 50;
export const LEADERBOARD_MAX_LIMIT = 100;

// XP needed to reach each level. Index 0 = level 1 (0 XP). A user with totalXp >=
// LEVEL_THRESHOLDS[i] is at least level i+1. Past the last threshold = max level.
export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000];
