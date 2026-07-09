import { api } from '../../lib/api';

export interface PersonalStats {
  enrollments: { total: number; inProgress: number; completed: number };
  hoursWatched: number;
  attempts: { total: number; passed: number; passRate: number };
  recentAttempts: Array<{
    id: string;
    examTitle: string;
    scorePct: string | null;
    passed: boolean | null;
    submittedAt: string | null;
  }>;
  progressOverTime: Array<{ date: string; minutes: number }>;
}

export interface ManagerReport {
  userId: string;
  name: string;
  email: string;
  enrollments: { total: number; completed: number; overdue: number };
  avgProgress: number;
  attempts: { total: number; passed: number };
}

export interface AdminStats {
  totals: {
    users: number;
    courses: number;
    publishedCourses: number;
    exams: number;
    enrollments: number;
    attempts: number;
  };
  averages: { progressPct: number; examScorePct: number };
  enrollmentStatus: Array<{ status: string; count: number }>;
  enrollmentsOverTime: Array<{ date: string; count: number }>;
  topCourses: Array<{ id: string; title: string; enrollments: number }>;
}

export async function getPersonalStats(): Promise<PersonalStats> {
  const res = await api.get('/stats/me');
  return res.data;
}

export async function getManagerStats(): Promise<{ reports: ManagerReport[] }> {
  const res = await api.get('/stats/manager');
  return res.data;
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await api.get('/stats/admin');
  return res.data;
}
