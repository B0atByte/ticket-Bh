import { api } from '../../lib/api';

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeId?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  locale: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INVITED' | 'DISABLED';
  emailVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  managerId?: string | null;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  items: UserRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function listUsers(params?: {
  q?: string;
  role?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<UserListResponse> {
  const { data } = await api.get<UserListResponse>('/users', { params });
  return data;
}

export async function getUser(id: string): Promise<UserRow> {
  const { data } = await api.get<{ user: UserRow }>(`/users/${id}`);
  return data.user;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  employeeId?: string;
  phone?: string;
  roleKeys?: string[];
  status?: 'ACTIVE' | 'SUSPENDED' | 'INVITED' | 'DISABLED';
  managerId?: string | null;
  departmentId?: string | null;
}

export interface Department {
  id: string;
  name: string;
  code?: string | null;
  parentId?: string | null;
  userCount?: number;
}

export interface DepartmentInput {
  name: string;
  code?: string;
  parentId?: string;
}

export async function listDepartments(): Promise<Department[]> {
  const { data } = await api.get<{ items: Department[] }>('/departments');
  return data.items;
}

export async function createDepartment(input: DepartmentInput): Promise<Department> {
  const { data } = await api.post<{ department: Department }>('/departments', input);
  return data.department;
}

export async function updateDepartment(id: string, input: Partial<DepartmentInput>): Promise<Department> {
  const { data } = await api.patch<{ department: Department }>(`/departments/${id}`, input);
  return data.department;
}

export async function deleteDepartment(id: string): Promise<void> {
  await api.delete(`/departments/${id}`);
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const { data } = await api.post<{ user: UserRow }>('/users', input);
  return data.user;
}

export async function updateUser(
  id: string,
  input: Partial<Omit<CreateUserInput, 'password'>>,
): Promise<UserRow> {
  const { data } = await api.patch<{ user: UserRow }>(`/users/${id}`, input);
  return data.user;
}

export async function changeUserPassword(id: string, password: string): Promise<void> {
  await api.post(`/users/${id}/password`, { password });
}

export interface UserRecord {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    employeeId?: string | null;
    status: string;
    lastLoginAt?: string | null;
    createdAt: string;
    department?: { id: string; name: string; code?: string | null } | null;
    roles: string[];
  };
  level: { level: number; totalXp: number; levelFloorXp: number; nextLevelXp: number | null };
  stars: number;
  coursesCompletedCount: number;
  totalEnrollments: number;
  completedCourses: Array<{ id: string; courseId: string; title: string; completedAt?: string | null }>;
  examSummary: { total: number; passed: number; failed: number };
  recentAttempts: Array<{
    id: string;
    examTitle: string;
    passed: boolean | null;
    status: string;
    scorePct: number | null;
    submittedAt?: string | null;
  }>;
}

export async function getUserRecord(id: string): Promise<UserRecord> {
  const { data } = await api.get<{ record: UserRecord }>(`/users/${id}/record`);
  return data.record;
}

export async function getMyRecord(): Promise<UserRecord> {
  const { data } = await api.get<{ record: UserRecord }>('/users/me/record');
  return data.record;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

export const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR', 'INSTRUCTOR', 'MANAGER', 'EMPLOYEE'] as const;
export type RoleKey = (typeof ALL_ROLES)[number];
