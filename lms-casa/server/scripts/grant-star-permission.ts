/**
 * Add the 'enrollment.grant_star' permission and grant it to SUPER_ADMIN only.
 * Also removes it from any other role (keeps it SUPER_ADMIN-exclusive). Idempotent.
 *
 * Run: npx tsx scripts/grant-star-permission.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PERM_KEY = 'enrollment.grant_star';
const ALLOWED_ROLE = 'SUPER_ADMIN';

async function main(): Promise<void> {
  const perm = await prisma.permission.upsert({
    where: { key: PERM_KEY },
    create: { key: PERM_KEY, description: PERM_KEY },
    update: {},
  });

  const superAdmin = await prisma.role.findUnique({ where: { key: ALLOWED_ROLE } });
  if (!superAdmin) throw new Error('SUPER_ADMIN role not found — run the seed first.');

  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: perm.id } },
    create: { roleId: superAdmin.id, permissionId: perm.id },
    update: {},
  });

  // Keep it exclusive: strip from every other role.
  const removed = await prisma.rolePermission.deleteMany({
    where: { permissionId: perm.id, roleId: { not: superAdmin.id } },
  });

  const holders = await prisma.rolePermission.findMany({
    where: { permissionId: perm.id },
    select: { role: { select: { key: true } } },
  });
  console.log(`'${PERM_KEY}' granted to: ${holders.map((h) => h.role.key).join(', ')}`);
  console.log(`Removed from ${removed.count} other role(s).`);
  console.log('Done. SUPER_ADMIN users must log out and back in for the new permission to take effect.');
}

main().catch((e) => { console.error('FAILED:', e); process.exitCode = 1; }).finally(() => void prisma.$disconnect());
