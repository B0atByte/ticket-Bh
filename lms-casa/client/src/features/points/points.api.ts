import { api } from '../../lib/api';

export type PointEventType =
  | 'LESSON_COMPLETED'
  | 'COURSE_COMPLETED'
  | 'EXAM_PASSED'
  | 'EXAM_PERFECT_SCORE'
  | 'ADJUSTMENT';

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
    createdAt: string;
  }>;
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

export interface LeaderboardResponse {
  scope: 'org' | 'department';
  departmentId: string | null;
  entries: LeaderboardEntry[];
}

export async function getMyPoints(): Promise<MyPointsSummary> {
  const res = await api.get<MyPointsSummary>('/points/me');
  return res.data;
}

export async function getLeaderboard(params: {
  scope: 'org' | 'department';
  limit?: number;
}): Promise<LeaderboardResponse> {
  const res = await api.get<LeaderboardResponse>('/points/leaderboard', { params });
  return res.data;
}
