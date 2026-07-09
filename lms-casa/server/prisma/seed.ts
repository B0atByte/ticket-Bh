import { PrismaClient, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ROLES = [
  { key: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full system access' },
  { key: 'ADMIN', name: 'Admin', description: 'Administrative access' },
  { key: 'HR', name: 'HR', description: 'Manage users and assignments' },
  { key: 'INSTRUCTOR', name: 'Instructor', description: 'Author courses and exams' },
  { key: 'MANAGER', name: 'Manager', description: 'View direct reports progress' },
  { key: 'EMPLOYEE', name: 'Employee', description: 'Take courses and exams' },
];

const PERMISSIONS = [
  // User management
  'user.read', 'user.create', 'user.update', 'user.delete', 'user.import',
  // Department / org structure (IT/admin only)
  'department.manage',
  // Course management
  'course.read', 'course.create', 'course.update', 'course.delete', 'course.publish',
  // Lesson
  'lesson.read', 'lesson.create', 'lesson.update', 'lesson.delete',
  // Exam
  'exam.read', 'exam.create', 'exam.update', 'exam.delete', 'exam.publish', 'exam.grade', 'exam.take',
  // Question bank
  'question.read', 'question.create', 'question.update', 'question.delete',
  // Enrollment
  'enrollment.read', 'enrollment.assign', 'enrollment.withdraw', 'enrollment.grant_star',
  // Practical evaluation (ภาคปฏิบัติ)
  'practical_eval.manage', 'practical_eval.grade',
  // Reports
  'report.read', 'report.export',
  // Audit
  'audit.read',
  // Settings
  'settings.read', 'settings.update',
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS, // all
  // ADMIN gets everything except full audit access and the SUPER_ADMIN-only manual star grant.
  ADMIN: PERMISSIONS.filter(
    (p) => (!p.startsWith('audit.') || p === 'audit.read') && p !== 'enrollment.grant_star',
  ),
  // User creation is reserved for IT/admin. HR can view and edit existing users
  // (and manage enrollments/reports) but cannot create or bulk-import accounts.
  // All staff roles can also take courses/exams themselves to earn stars,
  // so each non-employee role includes 'exam.take' alongside its job duties.
  HR: [
    'user.read', 'user.update',
    'course.read', 'lesson.read', 'exam.read', 'exam.take',
    'enrollment.read', 'enrollment.assign', 'enrollment.withdraw',
    'report.read', 'report.export',
  ],
  INSTRUCTOR: [
    'course.read', 'course.create', 'course.update', 'course.publish',
    'lesson.read', 'lesson.create', 'lesson.update', 'lesson.delete',
    'exam.read', 'exam.create', 'exam.update', 'exam.publish', 'exam.grade', 'exam.take',
    'question.read', 'question.create', 'question.update',
    'enrollment.read', 'practical_eval.grade',
  ],
  MANAGER: [
    'user.read', 'course.read', 'lesson.read', 'exam.read', 'exam.take',
    'enrollment.read', 'report.read', 'report.export',
  ],
  EMPLOYEE: [
    'course.read', 'lesson.read', 'exam.read', 'exam.take',
  ],
};

async function main() {
  console.log('Seeding...');

  // Roles
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { key: r.key },
      create: { ...r, isSystem: true },
      update: { name: r.name, description: r.description, isSystem: true },
    });
  }

  // Permissions
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description: key },
      update: {},
    });
  }

  // Role-permissions
  const allRoles = await prisma.role.findMany();
  const allPerms = await prisma.permission.findMany();
  const permByKey = new Map(allPerms.map((p) => [p.key, p.id]));

  for (const role of allRoles) {
    const keys = ROLE_PERMISSIONS[role.key] ?? [];
    const desiredIds = keys
      .map((k) => permByKey.get(k))
      .filter((id): id is bigint => id != null);
    for (const permId of desiredIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
        create: { roleId: role.id, permissionId: permId },
        update: {},
      });
    }
    // Seed is the source of truth for these system roles: prune any permission
    // that is no longer in the role's list (e.g. user.create removed from HR).
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: desiredIds } },
    });
  }

  // Departments
  const itDept = await prisma.department.upsert({
    where: { code: 'IT' },
    create: { name: 'Information Technology', code: 'IT' },
    update: {},
  });
  await prisma.department.upsert({
    where: { code: 'HR' },
    create: { name: 'Human Resources', code: 'HR' },
    update: {},
  });

  // Positions
  const engPos = await prisma.position.upsert({
    where: { code: 'ENG' },
    create: { name: 'Engineer', code: 'ENG', level: 3 },
    update: {},
  });

  // Default admin user
  const adminEmail = 'admin@lmscasa.local';
  const adminPass = await bcrypt.hash('Admin@12345', 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash: adminPass,
      firstName: 'Super',
      lastName: 'Admin',
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      departmentId: itDept.id,
      positionId: engPos.id,
    },
    update: {},
  });

  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    create: { userId: admin.id, roleId: superAdminRole.id },
    update: {},
  });

  // Dev test users (1 per role) — used by frontend quick-login panel.
  // Passwords are predictable for dev convenience; never seed these in production.
  const DEV_USERS: Array<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    roleKey: string;
  }> = [
    { email: 'hr@lmscasa.local',         password: 'Hr@12345',         firstName: 'HR',         lastName: 'Officer',  roleKey: 'HR' },
    { email: 'manager@lmscasa.local',    password: 'Manager@12345',    firstName: 'Manager',    lastName: 'Lead',     roleKey: 'MANAGER' },
    { email: 'instructor@lmscasa.local', password: 'Instructor@12345', firstName: 'Instructor', lastName: 'Teacher',  roleKey: 'INSTRUCTOR' },
    { email: 'employee@lmscasa.local',   password: 'Employee@12345',   firstName: 'Employee',   lastName: 'Member',   roleKey: 'EMPLOYEE' },
  ];

  const userIdByRole = new Map<string, bigint>();
  for (const u of DEV_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        departmentId: itDept.id,
      },
      update: {},
    });
    const role = await prisma.role.findUniqueOrThrow({ where: { key: u.roleKey } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    });
    userIdByRole.set(u.roleKey, user.id);
  }

  // Link Manager → Employee so ManagerDashboardPage has data
  const managerId = userIdByRole.get('MANAGER');
  const employeeId = userIdByRole.get('EMPLOYEE');
  if (managerId && employeeId) {
    await prisma.user.update({
      where: { id: employeeId },
      data: { managerId },
    });
  }

  // Default settings
  await prisma.setting.upsert({
    where: { key: 'system.branding' },
    create: {
      key: 'system.branding',
      value: { name: 'LMS Casa', primaryColor: '#2563eb', logoUrl: null },
      description: 'Branding settings',
    },
    update: {},
  });

  console.log(`Seed done. Admin: ${adminEmail} / Admin@12345`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
