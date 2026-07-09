/**
 * Create the 4 Digital Training sets as Categories + matching empty Question Banks.
 * Idempotent: re-running won't duplicate. Fill each bank with ~100 questions via the
 * Question Bank page, then build a course + exam (random 20) per set.
 *
 * Run: npx tsx scripts/seed-training-sets.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const SETS = [
  { name: 'Interview Set', slug: 'interview-set', description: 'ประเมินทัศนคติ — ใช้วันสัมภาษณ์งาน ข้อสอบง่าย 5-10 ข้อ วัดความสนใจและทัศนคติพื้นฐาน' },
  { name: 'Set 1 Basic & Service', slug: 'set-1-basic-service', description: 'พนักงานใหม่ (15 วันแรก) — เน้นพื้นฐานกาแฟและงานบริการ' },
  { name: 'Set 2 Intense Coffee', slug: 'set-2-intense-coffee', description: 'เดือนที่ 2 — เน้นทฤษฎีกาแฟเชิงลึก' },
  { name: 'Class 3 & Up Skill', slug: 'class-3-up-skill', description: 'เดือนที่ 3 เป็นต้นไป — สอบอัปเลเวล รับดาวสะสม/เงินพิเศษ' },
] as const;

async function main(): Promise<void> {
  for (const s of SETS) {
    const category = await prisma.category.upsert({
      where: { slug: s.slug },
      create: { name: s.name, slug: s.slug, description: s.description },
      update: { name: s.name, description: s.description },
    });

    // Question bank (no unique key) — find by name, else create.
    let bank = await prisma.questionBank.findFirst({ where: { name: s.name, deletedAt: null } });
    if (!bank) {
      bank = await prisma.questionBank.create({
        data: { name: s.name, description: `คลังข้อสอบสำรองของ "${s.name}" — เติมได้ถึง 100 ข้อ แล้วตั้งข้อสอบสุ่ม 20 ข้อ` },
      });
    }
    console.log(`OK  category #${category.id} + bank #${bank.id}  — ${s.name}`);
  }
  console.log('\nDone. ขั้นต่อไป: เติมคำถามในแต่ละคลัง → สร้างหลักสูตร (เลือกหมวด) → สร้างข้อสอบ (สุ่มจากคลัง 20 ข้อ) → ตั้ง "หลักสูตรถัดไป" เพื่อปลดล็อกเป็นลำดับ');
}

main().catch((e) => { console.error('FAILED:', e); process.exitCode = 1; }).finally(() => void prisma.$disconnect());
