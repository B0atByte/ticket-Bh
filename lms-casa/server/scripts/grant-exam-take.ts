/**
 * Grant the 'exam.take' permission to HR, INSTRUCTOR and MANAGER so they can
 * take courses/exams themselves and earn stars (same as EMPLOYEE).
 * Idempotent and surgical: only adds the role↔permission links, touches nothing else.
 *
 * Run: npx tsx scripts/grant-exam-take.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ROLE_KEYS = ['HR', 'INSTRUCTOR', 'MANAGER'] as const;

async function main(): Promise<void> {
  const perm = await prisma.permission.findUnique({ where: { key: 'exam.take' } });
  if (!perm) throw new Error("Permission 'exam.take' not found — run the seed first.");

  for (const key of ROLE_KEYS) {
    const role = await prisma.role.findUnique({ where: { key } });
    if (!role) {
      console.log(`Role ${key} not found, skipping.`);
      continue;
    }
    const res = await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      create: { roleId: role.id, permissionId: perm.id },
      update: {},
    });
    console.log(`${key}: exam.take ensured (rolePermission id ${res.roleId}/${res.permissionId}).`);
  }

  // Verify
  const grants = await prisma.rolePermission.findMany({
    where: { permissionId: perm.id, role: { key: { in: [...ROLE_KEYS] } } },
    select: { role: { select: { key: true } } },
  });
  console.log('Roles now holding exam.take:', grants.map((g) => g.role.key).sort());
  console.log('Done. Affected users must log out and back in for new permissions to take effect.');
}

main().catch((e) => { console.error('FAILED:', e); process.exitCode = 1; }).finally(() => void prisma.$disconnect());
