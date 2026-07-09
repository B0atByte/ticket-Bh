import { Prisma, type User } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { hashPassword } from '../auth/tokens.js';
import { levelFromXp } from '../points/points.service.js';
import { getMyCourseProgress } from '../me/me.service.js';
import { paginated, skipTake } from '../../utils/pagination.js';
import {
  assertCanAssignRoles,
  assertCanManageTarget,
  canViewAllUsers,
  type Actor,
} from '../auth/roleHierarchy.js';
import type {
  CreateUserInput,
  UpdateUserInput,
  UserListQuery,
} from './users.schema.js';

const TARGET_ROLES_INCLUDE = {
  userRoles: { select: { role: { select: { key: true } } } },
} satisfies Prisma.UserInclude;

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  employeeId: true,
  phone: true,
  avatarUrl: true,
  locale: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  departmentId: true,
  positionId: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  userRoles: { select: { role: { select: { key: true, name: true } } } },
} satisfies Prisma.UserSelect;

type PublicUser = Prisma.UserGetPayload<{ select: typeof PUBLIC_USER_SELECT }>;

function shape(u: PublicUser) {
  return {
    ...u,
    roles: u.userRoles.map((ur) => ur.role.key),
    userRoles: undefined,
  };
}

export async function list(query: UserListQuery, actor: Actor) {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  // A MANAGER (not ADMIN/HR) may only see their own direct reports.
  if (!canViewAllUsers(actor.roles)) where.managerId = actor.id;
  if (query.status) where.status = query.status;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.role) {
    where.userRoles = { some: { role: { key: query.role } } };
  }
  if (query.q) {
    where.OR = [
      { email: { contains: query.q } },
      { firstName: { contains: query.q } },
      { lastName: { contains: query.q } },
      { employeeId: { contains: query.q } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      ...skipTake(query.page, query.pageSize),
      orderBy: { id: 'desc' },
      select: PUBLIC_USER_SELECT,
    }),
    prisma.user.count({ where }),
  ]);

  return paginated(items.map(shape), total, query.page, query.pageSize);
}

export async function getById(id: bigint, actor: Actor) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: PUBLIC_USER_SELECT,
  });
  if (!user) throw HttpError.notFound('ไม่พบผู้ใช้');
  // A MANAGER (not ADMIN/HR) may only read their own reports (or themselves).
  if (!canViewAllUsers(actor.roles) && id !== actor.id && user.managerId !== actor.id) {
    throw HttpError.forbidden('ไม่มีสิทธิ์ดูข้อมูลผู้ใช้นี้');
  }
  return shape(user);
}

export async function create(input: CreateUserInput, actor: Actor) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw HttpError.conflict('อีเมลนี้ถูกใช้แล้ว');

  const passwordHash = await hashPassword(input.password);
  const roleKeys = input.roleKeys?.length ? input.roleKeys : ['EMPLOYEE'];
  // Privilege ceiling: the actor may only grant roles they strictly outrank.
  assertCanAssignRoles(actor, roleKeys);

  const created = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        employeeId: input.employeeId,
        phone: input.phone,
        departmentId: input.departmentId,
        positionId: input.positionId,
        managerId: input.managerId,
        status: input.status ?? 'ACTIVE',
      },
    });
    const roles = await tx.role.findMany({ where: { key: { in: roleKeys } } });
    if (roles.length === 0) {
      throw HttpError.badRequest(`ไม่พบ role ที่ถูกต้อง: ${roleKeys.join(',')}`);
    }
    await tx.userRole.createMany({
      data: roles.map((r) => ({ userId: u.id, roleId: r.id })),
      skipDuplicates: true,
    });
    return u;
  });

  return getById(created.id, actor);
}

export async function update(id: bigint, input: UpdateUserInput, actor: Actor) {
  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: TARGET_ROLES_INCLUDE,
  });
  if (!target) throw HttpError.notFound('User not found');

  const targetRoles = target.userRoles.map((ur) => ur.role.key);
  // Privilege ceiling: cannot modify a user ranked >= you (self is allowed).
  assertCanManageTarget(actor, id, targetRoles);

  if (input.email && input.email !== target.email) {
    const dup = await prisma.user.findUnique({ where: { email: input.email } });
    if (dup) throw HttpError.conflict('อีเมลนี้ถูกใช้แล้ว');
  }

  const { roleKeys, ...userPatch } = input;
  // Role assignment requires ADMIN-tier rank and each role below the actor's.
  if (roleKeys) assertCanAssignRoles(actor, roleKeys);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: userPatch as Prisma.UserUpdateInput,
    });
    if (roleKeys) {
      const roles = await tx.role.findMany({ where: { key: { in: roleKeys } } });
      await tx.userRole.deleteMany({ where: { userId: id } });
      if (roles.length > 0) {
        await tx.userRole.createMany({
          data: roles.map((r) => ({ userId: id, roleId: r.id })),
          skipDuplicates: true,
        });
      }
    }
  });

  return getById(id, actor);
}

/**
 * Per-person training record for Admin/HR: department, learning level (from XP),
 * completed courses, and exam history summary.
 */
export async function getUserRecord(id: bigint, actor: Actor) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      managerId: true,
      department: { select: { id: true, name: true, code: true } },
      userRoles: { select: { role: { select: { key: true } } } },
    },
  });
  if (!user) throw HttpError.notFound('ไม่พบผู้ใช้');
  // Self, or a privileged viewer, or this person's direct manager.
  if (id !== actor.id && !canViewAllUsers(actor.roles) && user.managerId !== actor.id) {
    throw HttpError.forbidden('ไม่มีสิทธิ์ดูข้อมูลผู้ใช้นี้');
  }

  const [points, completed, totalEnrollments, attempts, courseProgress] = await Promise.all([
    prisma.userPoints.findUnique({ where: { userId: id } }),
    prisma.enrollment.findMany({
      where: { userId: id, status: 'COMPLETED', deletedAt: null },
      select: { id: true, completedAt: true, course: { select: { id: true, title: true } } },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.enrollment.count({ where: { userId: id, deletedAt: null } }),
    prisma.examAttempt.findMany({
      where: { userId: id },
      select: {
        id: true,
        passed: true,
        status: true,
        scorePct: true,
        submittedAt: true,
        exam: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    getMyCourseProgress(id),
  ]);

  const level = levelFromXp(points?.totalXp ?? 0);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      employeeId: user.employeeId,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      department: user.department,
      roles: user.userRoles.map((ur) => ur.role.key),
    },
    level,
    stars: courseProgress.stars,
    coursesCompletedCount: completed.length,
    totalEnrollments,
    completedCourses: completed.map((e) => ({
      id: e.id,
      courseId: e.course.id,
      title: e.course.title,
      completedAt: e.completedAt,
    })),
    examSummary: {
      total: attempts.length,
      passed: attempts.filter((a) => a.passed === true).length,
      failed: attempts.filter((a) => a.passed === false).length,
    },
    recentAttempts: attempts.map((a) => ({
      id: a.id,
      examTitle: a.exam.title,
      passed: a.passed,
      status: a.status,
      scorePct: a.scorePct != null ? Number(a.scorePct) : null,
      submittedAt: a.submittedAt,
    })),
  };
}

export async function softDelete(id: bigint, actor: Actor): Promise<void> {
  if (id === actor.id) {
    throw HttpError.badRequest('ไม่สามารถลบบัญชีของตัวเองได้');
  }
  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: TARGET_ROLES_INCLUDE,
  });
  if (!target) throw HttpError.notFound('User not found');
  // Privilege ceiling: cannot delete a user ranked >= you.
  assertCanManageTarget(actor, id, target.userRoles.map((ur) => ur.role.key));

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'DISABLED' },
  });
}

export async function changePassword(
  id: bigint,
  newPassword: string,
  actor: Actor,
): Promise<void> {
  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: TARGET_ROLES_INCLUDE,
  });
  if (!target) throw HttpError.notFound('User not found');
  // Privilege ceiling: cannot reset the password of a user ranked >= you (self allowed).
  assertCanManageTarget(actor, id, target.userRoles.map((ur) => ur.role.key));
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash } }),
    // Revoke all active refresh tokens
    prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
