import { PrismaClient, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { name: 'Branch - x Ratchathewi',          code: 'BRANCH_RATCHATHEWI' },
  { name: 'Branch - x Casa ATT U',            code: 'BRANCH_CASA_ATT_U' },
  { name: 'Branch - x Central World',         code: 'BRANCH_CENTRAL_WORLD' },
  { name: 'Branch - x Space Ladprao Hill',    code: 'BRANCH_SPACE_LADPRAO_HILL' },
  { name: 'Branch - x Casa Silom13',          code: 'BRANCH_CASA_SILOM13' },
  { name: 'Branch - x Mega Bangna',           code: 'BRANCH_MEGA_BANGNA' },
  { name: 'Branch - x Casa Kubon',            code: 'BRANCH_CASA_KUBON' },
  { name: 'Branch - x Casa Sukhumvit 31',     code: 'BRANCH_CASA_SUKHUMVIT_31' },
  { name: 'Branch - x Casa Silom 6',          code: 'BRANCH_CASA_SILOM_6' },
  { name: 'Branch - x Casa Ploenchit',        code: 'BRANCH_CASA_PLOENCHIT' },
  { name: 'Branch - x Siri Sathon',           code: 'BRANCH_SIRI_SATHON' },
  { name: 'Branch - x Casa Sukhumvit Hills',  code: 'BRANCH_CASA_SUKHUMVIT_HILLS' },
  { name: 'Branch - x Casa Ratchathewi 2',    code: 'BRANCH_CASA_RATCHATHEWI_2' },
  { name: 'Branch - x Casa Sukhumvit 20',     code: 'BRANCH_CASA_SUKHUMVIT_20' },
  { name: 'Branch - x Casa Chao phraya',      code: 'BRANCH_CASA_CHAO_PHRAYA' },
  { name: 'Branch - x Casa AIA Ratchada',     code: 'BRANCH_CASA_AIA_RATCHADA' },
  { name: 'Branch - x Casa Siam Paragon',     code: 'BRANCH_CASA_SIAM_PARAGON' },
  { name: 'Branch - x Casa Jas Ram',          code: 'BRANCH_CASA_JAS_RAM' },
  { name: 'Branch - x Casa Jaymart HQ',       code: 'BRANCH_CASA_JAYMART_HQ' },
  { name: 'Branch - x Casa Ratchayothin Hills', code: 'BRANCH_CASA_RATCHAYOTHIN_HILLS' },
  { name: 'Branch - x Casa Ramkhamhaeng Hills', code: 'BRANCH_CASA_RAMKHAMHAENG_HILLS' },
  { name: 'Branch - x Casa Pradiphat',        code: 'BRANCH_CASA_PRADIPHAT' },
];

const USERS: { employeeId: string; firstName: string; lastName: string; deptCode?: string }[] = [
  { employeeId: '6105286', firstName: 'สุวรรณรัตน์',      lastName: 'ผลาเกษ',              deptCode: 'BRANCH_RATCHATHEWI' },
  { employeeId: '6507403', firstName: 'จิราพร',           lastName: 'ปินตาเป็ง' },
  { employeeId: '6804402', firstName: 'เพียงฟ้า',         lastName: 'จะแล' },
  { employeeId: '6808421', firstName: 'กัญญาณัฐ',         lastName: 'มาตุรินทร์' },
  { employeeId: '6810418', firstName: 'อธิรัตน์',         lastName: 'วงษ์คำผุย' },
  { employeeId: '6901420', firstName: 'จุลจักร',          lastName: 'อินทรปาสาณ' },
  { employeeId: '6605411', firstName: 'กชมน',             lastName: 'เรืองสุขสุด',         deptCode: 'BRANCH_CASA_ATT_U' },
  { employeeId: '6606418', firstName: 'ธีรพัฒน์',         lastName: 'สุขสมัคร' },
  { employeeId: '6711408', firstName: 'จิรกรณ์',          lastName: 'พัดอ่อน' },
  { employeeId: '6809419', firstName: 'เกียรติศักดิ์',    lastName: 'สว่างจิตร' },
  { employeeId: '6412403', firstName: 'วีณา',             lastName: 'ธรรมครองอาตม์',       deptCode: 'BRANCH_CENTRAL_WORLD' },
  { employeeId: '6510401', firstName: 'กันทนากร',         lastName: 'สนธิกาล' },
  { employeeId: '6511407', firstName: 'ปิยภรณ์',          lastName: 'ทะวะลัย' },
  { employeeId: '6704418', firstName: 'โชติรส',           lastName: 'โตประทีป' },
  { employeeId: '6705401', firstName: 'ศศินา',            lastName: 'ศกกลาง' },
  { employeeId: '6507412', firstName: 'ฟ้าใส',            lastName: 'จันทร์แฉ่ง',          deptCode: 'BRANCH_SPACE_LADPRAO_HILL' },
  { employeeId: '6901407', firstName: 'สุธิดา',           lastName: 'ดิษฐ์เย็น' },
  { employeeId: '6608411', firstName: 'ศรณ์จันทร์',       lastName: 'จุฑาเกียรติ',         deptCode: 'BRANCH_CASA_SILOM13' },
  { employeeId: '6804401', firstName: 'ชนกนันท์',         lastName: 'พ่วงจินดา' },
  { employeeId: '6706416', firstName: 'ปฐมพร',            lastName: 'สุขคุ้ม' },
  { employeeId: '6901424', firstName: 'ปัณฑารีย์',        lastName: 'วรบุตร' },
  { employeeId: '6109273', firstName: 'จริยา',            lastName: 'นิลละออ',             deptCode: 'BRANCH_MEGA_BANGNA' },
  { employeeId: '6804424', firstName: 'ณัฐติยา',          lastName: 'งามโนนทอง' },
  { employeeId: '6805403', firstName: 'อิทธิพัทธ์',       lastName: 'แก้วใส' },
  { employeeId: '6807406', firstName: 'ณัฐพล',            lastName: 'อิ่มลอย' },
  { employeeId: '6904405', firstName: 'อารยา',            lastName: 'ภิรมย์เอม' },
  { employeeId: '6904410', firstName: 'ธนาพร',            lastName: 'โสภานิตย์' },
  { employeeId: '6411406', firstName: 'วลัยภรณ์',         lastName: 'นางสันเทียะ',         deptCode: 'BRANCH_CASA_KUBON' },
  { employeeId: '6605421', firstName: 'วรรณทนา',          lastName: 'แสงแก้ว' },
  { employeeId: '6607405', firstName: 'ปพิชญา',           lastName: 'ปานทอง' },
  { employeeId: '6705412', firstName: 'ปนัดดา',           lastName: 'วรกฎ' },
  { employeeId: '6410405', firstName: 'วสันต์',           lastName: 'นามเมืองคุณ',         deptCode: 'BRANCH_CASA_SUKHUMVIT_31' },
  { employeeId: '6611404', firstName: 'พรรณนิภา',         lastName: 'พรหมติยา' },
  { employeeId: '6501413', firstName: 'เกตินัยต์',        lastName: 'ไชยงาม',              deptCode: 'BRANCH_CASA_SILOM_6' },
  { employeeId: '6705403', firstName: 'พิศุทธ์',          lastName: 'สายบัว' },
  { employeeId: '6705415', firstName: 'ณิชาภัทร',         lastName: 'ทุมพันธ์' },
  { employeeId: '6706421', firstName: 'ทินภัทร',          lastName: 'จารุธานิยานนท์' },
  { employeeId: '6707407', firstName: 'ชนิตา',            lastName: 'พ่วงจินดา' },
  { employeeId: '6509407', firstName: 'ธรรมาภรณ์',        lastName: 'ฉันท์มากร',           deptCode: 'BRANCH_CASA_PLOENCHIT' },
  { employeeId: '6707402', firstName: 'สุดารัตน์',        lastName: 'นันทะจันทร์' },
  { employeeId: '6711402', firstName: 'ธนพล',             lastName: 'แย้มนุช' },
  { employeeId: '6803402', firstName: 'ธนพงษ์',           lastName: 'อึ้งบรรจง' },
  { employeeId: '6605406', firstName: 'อุไรวรรณ',         lastName: 'ศรีสุข',              deptCode: 'BRANCH_SIRI_SATHON' },
  { employeeId: '6712405', firstName: 'ชลินธร',           lastName: 'เพียรทอง' },
  { employeeId: '6804405', firstName: 'งามพงศ์',          lastName: 'พณะสรรพ์' },
  { employeeId: '6502404', firstName: 'ธัญพร',            lastName: 'วิเชียร',             deptCode: 'BRANCH_CASA_SUKHUMVIT_HILLS' },
  { employeeId: '6605408', firstName: 'วัชรพงศ์',         lastName: 'รพีเจริญวงศ์' },
  { employeeId: '6801401', firstName: 'วรรณิษา',          lastName: 'วงค์ภักดี' },
  { employeeId: '6902404', firstName: 'นภาพร',            lastName: 'ทะไตย์' },
  { employeeId: '6903413', firstName: 'จินดารัตน์',       lastName: 'ขำน้อย' },
  { employeeId: '6904411', firstName: 'รัฐตะวัน',         lastName: 'กัณหทัต' },
  { employeeId: '6105290', firstName: 'ณัฐนารี',          lastName: 'ธนวณิชตระกูล',        deptCode: 'BRANCH_CASA_RATCHATHEWI_2' },
  { employeeId: '6010276', firstName: 'สาวิตรี',          lastName: 'เสนคราม',             deptCode: 'BRANCH_CASA_SUKHUMVIT_20' },
  { employeeId: '6701405', firstName: 'สันติภาพ',         lastName: 'ทองน้อย' },
  { employeeId: '6812401', firstName: 'ณัตพร',            lastName: 'เรืองถ่าย' },
  { employeeId: '6411410', firstName: 'ภีร์คสินท์',       lastName: 'ศรีพนมธร',            deptCode: 'BRANCH_CASA_CHAO_PHRAYA' },
  { employeeId: '6610410', firstName: 'ภูวไนย',           lastName: 'ปรีชา' },
  { employeeId: '6707403', firstName: 'อรนิช',            lastName: 'สีหากุล' },
  { employeeId: '6811428', firstName: 'ศุภาพิชญ์',        lastName: 'รตางศุ' },
  { employeeId: '6412401', firstName: 'มณฑา',             lastName: 'เทพสวัสดิ์',          deptCode: 'BRANCH_CASA_AIA_RATCHADA' },
  { employeeId: '6510404', firstName: 'อภิวัฒน์',         lastName: 'พิลาสุข' },
  { employeeId: '6807410', firstName: 'วิชชุดา',          lastName: 'ศิริลักษณ์' },
  { employeeId: '6808415', firstName: 'พนิดา',            lastName: 'ท้าวนันทะ' },
  { employeeId: '6811425', firstName: 'แพรวพรรณ์',        lastName: 'มาศขาว' },
  { employeeId: '6503402', firstName: 'ปัณณวิชญ์',        lastName: 'ภิรมย์วสุธนากุล',     deptCode: 'BRANCH_CASA_SIAM_PARAGON' },
  { employeeId: '6608405', firstName: 'ณัฐชานันท์',       lastName: 'วงษ์จิราวุฒิ' },
  { employeeId: '6808418', firstName: 'ตะวัน',            lastName: 'นาคานตกะ' },
  { employeeId: '6903414', firstName: 'ชนาภัทร',          lastName: 'เหลี่ยมใส' },
  { employeeId: '6302421', firstName: 'จันทร์จิรา',       lastName: 'สุขทองแก้ว',          deptCode: 'BRANCH_CASA_JAS_RAM' },
  { employeeId: '6701414', firstName: 'สิริมาศ',          lastName: 'โพธิ์เพชร' },
  { employeeId: '6812413', firstName: 'สุทธิภัทร',        lastName: 'ธรรมขจรศักดิ์' },
  { employeeId: '6904407', firstName: 'นริศรา',           lastName: 'คงเสมอ' },
  { employeeId: '6706411', firstName: 'กัณธิมา',          lastName: 'ยะเราะ',              deptCode: 'BRANCH_CASA_JAYMART_HQ' },
  { employeeId: '6904406', firstName: 'กนกวรรณ',          lastName: 'น้อยลา' },
  { employeeId: '6509401', firstName: 'วิทวัส',           lastName: 'ปองดี',               deptCode: 'BRANCH_CASA_RATCHAYOTHIN_HILLS' },
  { employeeId: '6612404', firstName: 'สิริชัย',          lastName: 'ประเสริฐชัยพร' },
  { employeeId: '6710410', firstName: 'กัญญารัตน์',       lastName: 'ม่วมกระโทก' },
  { employeeId: '6808416', firstName: 'พิมพ์ชนก',         lastName: 'ทนันชัย' },
  { employeeId: '6903411', firstName: 'สุภัจฉรีย์',       lastName: 'สุทธิบุตร' },
  { employeeId: '6610415', firstName: 'พิมพกานต์',        lastName: 'อินทมล',              deptCode: 'BRANCH_CASA_RAMKHAMHAENG_HILLS' },
  { employeeId: '6808413', firstName: 'ญาณาธิป',          lastName: 'เหล่าเจริญ' },
  { employeeId: '6809414', firstName: 'เมธัช',            lastName: 'พยุงพันธ์' },
  { employeeId: '6809418', firstName: 'สิริวิมล',         lastName: 'แสนตอ' },
  { employeeId: '6504401', firstName: 'กาญจนา',           lastName: 'จันทร์เงิน',          deptCode: 'BRANCH_CASA_PRADIPHAT' },
  { employeeId: '6702411', firstName: 'วิภาวดี',          lastName: 'เขียนบุตร' },
  { employeeId: '6806429', firstName: 'พิมพ์รดา',         lastName: 'หอมหวล' },
  { employeeId: '6809401', firstName: 'เนตรดาว',          lastName: 'สอนกระสินธ์' }
];

async function main() {
  // Create departments
  console.log('Creating departments...');
  const deptMap = new Map<string, bigint>();
  for (const d of DEPARTMENTS) {
    const dept = await prisma.department.upsert({
      where: { code: d.code },
      create: { name: d.name, code: d.code },
      update: { name: d.name },
    });
    deptMap.set(d.code, dept.id);
    console.log(`  Dept: ${d.name}`);
  }

  // Create users
  console.log('\nCreating users...');
  const employeeRole = await prisma.role.findUniqueOrThrow({ where: { key: 'EMPLOYEE' } });
  let created = 0;
  let updated = 0;

  for (const u of USERS) {
    const email = `${u.employeeId}@lmscasa.local`;
    const passwordHash = await bcrypt.hash(u.employeeId, 12);
    const departmentId = u.deptCode ? deptMap.get(u.deptCode) : undefined;

    const existing = await prisma.user.findUnique({ where: { email } });
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
        ...(departmentId ? { departmentId } : {}),
      },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        employeeId: u.employeeId,
        ...(departmentId ? { departmentId } : {}),
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: employeeRole.id } },
      create: { userId: user.id, roleId: employeeRole.id },
      update: {},
    });

    if (existing) {
      console.log(`  Updated: ${u.employeeId} - ${u.firstName} ${u.lastName}${u.deptCode ? ` [${u.deptCode}]` : ''}`);
      updated++;
    } else {
      console.log(`  Created: ${u.employeeId} - ${u.firstName} ${u.lastName}${u.deptCode ? ` [${u.deptCode}]` : ''}`);
      created++;
    }
  }

  console.log(`\nDone. Created: ${created}, Updated: ${updated}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
