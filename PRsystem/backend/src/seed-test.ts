import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const today = new Date().toISOString().slice(0, 10)
const d = (offset: number) => {
  const dt = new Date()
  dt.setDate(dt.getDate() + offset)
  return dt.toISOString().slice(0, 10)
}

async function main() {
  console.log('Creating test purchase requests...')

  const employee = await prisma.user.findFirst({ where: { role: 'employee' } })
  const emp2     = await prisma.user.findFirst({ where: { username: 'emp2' } })
  if (!employee || !emp2) { console.error('No employee users found — run seed first'); process.exit(1) }

  const year = new Date().getFullYear() + 543
  const prefix = `PR-${year}-`
  const last = await prisma.purchaseRequest.findFirst({
    where: { reqNo: { startsWith: prefix } },
    orderBy: { reqNo: 'desc' },
    select: { reqNo: true },
  })
  let seq = last ? parseInt(last.reqNo.replace(prefix, ''), 10) : 0
  const nextNo = () => `${prefix}${String(++seq).padStart(3, '0')}`

  const base = {
    reason: '',
    categories: '[]',
    supplierName: 'บริษัท ทดสอบ จำกัด',
    supplierName2: '',
    paymentMethod: 'transfer' as const,
    paymentTiming: 'after' as const,
    orderDate: d(-5),
    deliveryDate: d(3),
    contactName: 'ผู้ทดสอบ',
    signedDate: d(-5),
    createdBy: employee.id,
    createdByName: employee.name,
  }

  const requests = [
    // pending — รอฝ่ายจัดซื้อ 3 รายการ
    { ...base, reqNo: nextNo(), title: 'ซื้อผักสดสำหรับครัว', category: 'ผัก', totalAmount: 3500, status: 'pending' as const, dueDate: d(5) },
    { ...base, reqNo: nextNo(), title: 'สั่งเนื้อวัวแช่แข็ง 10kg', category: 'เนื้อ หมู ไก่', totalAmount: 8200, status: 'pending' as const, dueDate: d(2) },
    { ...base, reqNo: nextNo(), title: 'ซอสปรุงรสประจำเดือน', category: 'ซอส', totalAmount: 1800, status: 'pending' as const, dueDate: d(-1), createdBy: emp2.id, createdByName: emp2.name },

    // purchasing — ออก PR/PO แล้ว 2 รายการ
    { ...base, reqNo: nextNo(), title: 'เครื่องดื่มสำหรับลูกค้า', category: 'เครื่องดื่ม', totalAmount: 5600, status: 'purchasing' as const, dueDate: d(4), prNo: `PR-${String(seq).padStart(3,'0')}`, poNo: `PO-${String(seq).padStart(3,'0')}` },
    { ...base, reqNo: nextNo(), title: 'วัตถุดิบทำขนม', category: 'อื่นๆ', totalAmount: 2900, status: 'purchasing' as const, dueDate: d(-3), prNo: `PR-${String(seq).padStart(3,'0')}`, poNo: `PO-${String(seq).padStart(3,'0')}` },

    // accounting — รอโอนเงิน 2 รายการ
    { ...base, reqNo: nextNo(), title: 'หมูสามชั้นและซี่โครง', category: 'เนื้อ หมู ไก่', totalAmount: 12000, status: 'accounting' as const, dueDate: d(-2), prNo: `PR-${String(seq).padStart(3,'0')}`, poNo: `PO-${String(seq).padStart(3,'0')}` },
    { ...base, reqNo: nextNo(), title: 'น้ำมันมะกอกและเนย', category: 'ซอส', totalAmount: 4500, status: 'accounting' as const, dueDate: d(1), prNo: `PR-${String(seq).padStart(3,'0')}`, poNo: `PO-${String(seq).padStart(3,'0')}` },

    // transferred — รอรับสินค้า 1 รายการ
    { ...base, reqNo: nextNo(), title: 'ผลไม้สดนำเข้า', category: 'ผัก', totalAmount: 7800, status: 'transferred' as const, dueDate: d(-4), prNo: `PR-${String(seq).padStart(3,'0')}`, poNo: `PO-${String(seq).padStart(3,'0')}`, transferRef: 'TRF-001', transferDate: d(-1) },

    // received — รับสินค้าแล้ว 2 รายการ
    { ...base, reqNo: nextNo(), title: 'เครื่องเทศและสมุนไพร', category: 'ซอส', totalAmount: 2100, status: 'received' as const, dueDate: d(-10), prNo: `PR-${String(seq).padStart(3,'0')}`, poNo: `PO-${String(seq).padStart(3,'0')}`, transferRef: 'TRF-002', transferDate: d(-7), receivedAt: d(-5) },
    { ...base, reqNo: nextNo(), title: 'บรรจุภัณฑ์และถุงซิป', category: 'อื่นๆ', totalAmount: 980, status: 'received' as const, dueDate: d(-8), prNo: `PR-${String(seq).padStart(3,'0')}`, poNo: `PO-${String(seq).padStart(3,'0')}`, transferRef: 'TRF-003', transferDate: d(-6), receivedAt: d(-4) },

    // rejected — ปฏิเสธ 1 รายการ
    { ...base, reqNo: nextNo(), title: 'อุปกรณ์ครัวราคาแพง', category: 'อื่นๆ', totalAmount: 45000, status: 'rejected' as const, dueDate: d(-6), notes: 'ราคาเกินงบประมาณที่ตั้งไว้' },
  ]

  let created = 0
  for (const r of requests) {
    await prisma.purchaseRequest.create({ data: r })
    console.log(`  + ${r.reqNo}  [${r.status.padEnd(12)}]  ${r.title}  ฿${r.totalAmount.toLocaleString()}`)
    created++
  }

  const summary = await prisma.purchaseRequest.groupBy({ by: ['status'], _count: true })
  console.log('\nสรุปข้อมูลใน DB:')
  summary.forEach(s => console.log(`  ${s.status.padEnd(12)} : ${s._count} รายการ`))
  console.log(`\nสร้าง ${created} รายการเรียบร้อย`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
