import { PrismaClient, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const USERS = [
  { employeeId: '6105286', firstName: 'สุวรรณรัตน์', lastName: 'ผลาเกษ' },
  { employeeId: '6412403', firstName: 'วีณา',        lastName: 'ธรรมครองอาตม์' },
  { employeeId: '6507412', firstName: 'ฟ้าใส',       lastName: 'จันทร์แฉ่ง' },
  { employeeId: '6809419', firstName: 'เกียรติศักดิ์', lastName: 'สว่างจิตร' },
  { employeeId: '6608411', firstName: 'ศรณ์จันทร์',  lastName: 'จุฑาเกียรติ' },
  { employeeId: '6109273', firstName: 'จริยา',       lastName: 'นิลละออ' },
  { employeeId: '6411406', firstName: 'วลัยภรณ์',   lastName: 'นางสันเทียะ' },
  { employeeId: '6410405', firstName: 'วสันต์',      lastName: 'นามเมืองคุณ' },
  { employeeId: '6501413', firstName: 'เกตินัยต์',  lastName: 'ไชยงาม' },
  { employeeId: '6509407', firstName: 'ธรรมาภรณ์',  lastName: 'ฉันท์มากร' },
  { employeeId: '6502404', firstName: 'ธัญพร',      lastName: 'วิเชียร' },
];

async function main() {
  const employeeRole = await prisma.role.findUniqueOrThrow({ where: { key: 'EMPLOYEE' } });

  for (const u of USERS) {
    const email = `${u.employeeId}@lmscasa.local`;
    const passwordHash = await bcrypt.hash(u.employeeId, 12);

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        employeeId: u.employeeId,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        employeeId: u.employeeId,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: employeeRole.id } },
      create: { userId: user.id, roleId: employeeRole.id },
      update: {},
    });

    console.log(`Created: ${u.employeeId} - ${u.firstName} ${u.lastName} (id=${user.id})`);
  }

  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
