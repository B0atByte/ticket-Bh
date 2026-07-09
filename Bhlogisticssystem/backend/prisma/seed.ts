import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await bcrypt.hash('admin1234', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@bhlogistics.com' },
    update: {},
    create: {
      email: 'admin@bhlogistics.com',
      password: adminPassword,
      name: 'Admin',
      role: Role.ADMIN,
    },
  })

  const kitchenPassword = await bcrypt.hash('kitchen1234', 12)
  await prisma.user.upsert({
    where: { email: 'kitchen@bhlogistics.com' },
    update: {},
    create: {
      email: 'kitchen@bhlogistics.com',
      password: kitchenPassword,
      name: 'ครัวกลาง',
      role: Role.KITCHEN,
    },
  })

  const driverPassword = await bcrypt.hash('driver1234', 12)
  await prisma.user.upsert({
    where: { email: 'driver@bhlogistics.com' },
    update: {},
    create: {
      email: 'driver@bhlogistics.com',
      password: driverPassword,
      name: 'คนขับ 1',
      role: Role.DRIVER,
    },
  })

  const branchPassword = await bcrypt.hash('branch1234', 12)
  await prisma.user.upsert({
    where: { email: 'branch1@bhlogistics.com' },
    update: {},
    create: {
      email: 'branch1@bhlogistics.com',
      password: branchPassword,
      name: 'สาขา 1',
      role: Role.BRANCH,
      branchId: 'BRANCH-001',
    },
  })

  await prisma.user.upsert({
    where: { email: 'branch2@bhlogistics.com' },
    update: {},
    create: {
      email: 'branch2@bhlogistics.com',
      password: await bcrypt.hash('branch1234', 12),
      name: 'สาขา 2',
      role: Role.BRANCH,
      branchId: 'BRANCH-002',
    },
  })

  console.log('Seed complete. Admin:', admin.email)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
