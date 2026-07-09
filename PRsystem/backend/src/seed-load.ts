import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CATEGORIES = ['ผัก', 'เนื้อ หมู ไก่', 'ซอส', 'เครื่องดื่ม', 'อื่นๆ']
const STATUSES = ['pending', 'purchasing', 'accounting', 'transferred', 'received', 'rejected'] as const
const TITLES = [
  'ซื้อผักสดสำหรับครัว', 'สั่งเนื้อวัวแช่แข็ง', 'ซอสปรุงรสประจำเดือน',
  'เครื่องดื่มสำหรับลูกค้า', 'วัตถุดิบทำขนม', 'หมูสามชั้นและซี่โครง',
  'น้ำมันมะกอกและเนย', 'ผลไม้สดนำเข้า', 'เครื่องเทศและสมุนไพร',
  'บรรจุภัณฑ์และถุงซิป', 'อุปกรณ์ครัวสแตนเลส', 'ไก่สดทั้งตัว',
  'กุ้งแม่น้ำสด', 'ปลาแซลมอนนำเข้า', 'ชีสและเนยแข็ง',
]

const d = (offset: number) => {
  const dt = new Date(); dt.setDate(dt.getDate() + offset)
  return dt.toISOString().slice(0, 10)
}

async function main() {
  const employee = await prisma.user.findFirst({ where: { role: 'employee' } })
  if (!employee) { console.error('No employee found'); process.exit(1) }

  // DATE env: กำหนดวันที่ createdAt เช่น DATE=2025-04-22
  const targetDate = process.env.DATE
    ? new Date(process.env.DATE)
    : new Date()
  const targetDateStr = targetDate.toISOString().slice(0, 10)
  console.log(`Target date: ${targetDateStr}`)

  const year = targetDate.getFullYear() + 543
  const prefix = `PR-${year}-`
  const last = await prisma.purchaseRequest.findFirst({
    where: { reqNo: { startsWith: prefix } },
    orderBy: { reqNo: 'desc' },
    select: { reqNo: true },
  })
  let seq = last ? parseInt(last.reqNo.replace(prefix, ''), 10) : 0

  const COUNT = parseInt(process.env.COUNT || '500')
  console.log(`Creating ${COUNT} records...`)
  const start = Date.now()

  const batch: any[] = []
  for (let i = 0; i < COUNT; i++) {
    const status = STATUSES[i % STATUSES.length]
    const dueOffset = Math.floor(Math.random() * 20) - 10
    // สร้าง timestamp แบบสุ่มเวลาในวันนั้น
    const createdAt = new Date(targetDate)
    createdAt.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60), 0, 0)
    batch.push({
      reqNo: `${prefix}${String(++seq).padStart(4, '0')}`,
      title: `${TITLES[i % TITLES.length]} #${i + 1}`,
      category: CATEGORIES[i % CATEGORIES.length],
      categories: '[]',
      totalAmount: Math.floor(Math.random() * 50000) + 500,
      supplierName: `ร้านค้า ${i + 1}`,
      supplierName2: '',
      paymentMethod: i % 2 === 0 ? 'transfer' : 'cash',
      paymentTiming: 'after',
      orderDate: targetDateStr,
      deliveryDate: d(3),
      dueDate: d(dueOffset),
      contactName: `ผู้ติดต่อ ${i + 1}`,
      signedDate: targetDateStr,
      reason: '',
      status,
      createdAt,
      updatedAt: createdAt,
      prNo: ['purchasing', 'accounting', 'transferred', 'received'].includes(status) ? `PR-${String(seq).padStart(3, '0')}` : null,
      poNo: ['purchasing', 'accounting', 'transferred', 'received'].includes(status) ? `PO-${String(seq).padStart(3, '0')}` : null,
      transferRef: ['transferred', 'received'].includes(status) ? `TRF-${String(seq).padStart(3, '0')}` : null,
      transferDate: ['transferred', 'received'].includes(status) ? d(-2) : null,
      receivedAt: status === 'received' ? d(-1) : null,
      notes: status === 'rejected' ? 'ไม่อยู่ในแผนงบประมาณ' : null,
      createdBy: employee.id,
      createdByName: employee.name,
    })
  }

  // Insert in batches of 50
  for (let i = 0; i < batch.length; i += 50) {
    await prisma.purchaseRequest.createMany({ data: batch.slice(i, i + 50) })
    process.stdout.write(`\r  ${Math.min(i + 50, COUNT)}/${COUNT}`)
  }

  console.log(`\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s`)

  const total = await prisma.purchaseRequest.count()
  console.log(`Total records in DB: ${total}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
