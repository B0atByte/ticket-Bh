import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const USERS = [
  { username: 'owner',     name: 'คุณสมชาย วงศ์ใหญ่',      email: 'owner@company.com',     role: 'owner'      },
  { username: 'employee',  name: 'นางสาวสมหญิง ใจดี',      email: 'employee@company.com',  role: 'employee'   },
  { username: 'emp2',      name: 'นายประสิทธิ์ มานะ',       email: 'emp2@company.com',      role: 'employee'   },
  { username: 'purchasing',name: 'นายวิชัย จัดซื้อดี',      email: 'purchasing@company.com',role: 'purchasing' },
  { username: 'accounting',name: 'นางสาวบัญชี ตัวเลขดี',   email: 'accounting@company.com',role: 'accounting' },
  { username: 'itsupport', name: 'นายไอที ซัพพอร์ต',       email: 'it@company.com',        role: 'itsupport'  },
] as const

async function main() {
  console.log('🌱 Seeding database...')

  for (const u of USERS) {
    const hashed = await bcrypt.hash('1234', 10)
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { ...u, password: hashed },
    })
    console.log(`  ✓ ${u.username} (${u.role})`)
  }

  console.log('✅ Seed completed! รหัสผ่านทุก account: 1234')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
