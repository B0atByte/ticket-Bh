import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const d = (offset: number) => {
  const dt = new Date(); dt.setDate(dt.getDate() + offset)
  return dt.toISOString().slice(0, 10)
}

const suppliers = [
  'บริษัท ผักสดดี จำกัด', 'ร้านเนื้อสด อ.ตลาด', 'บ.นำเข้าเครื่องเทศ จำกัด',
  'ตลาดสดเช้า', 'โรงงานไก่สด จำกัด', 'ฟาร์มเนื้อคุณภาพ', 'ร้านเครื่องดื่มส่ง',
  'บ.เครื่องปรุงไทย จำกัด', 'ฟาร์มผักออร์แกนิค', 'ร้านวัตถุดิบครัว',
  'บ.อาหารทะเลสด จำกัด', 'ตลาดกลางสินค้า', 'ร้านนมและผลิตภัณฑ์',
  'บ.บรรจุภัณฑ์ไทย จำกัด', 'ร้านอุปกรณ์ครัว Pro',
]

const items = [
  { title: 'ผักกาดขาว กะหล่ำปลี ผักบุ้ง', cat: 'ผัก', amt: 3200, vat: 224 },
  { title: 'เนื้อวัวสันนอก 20kg', cat: 'เนื้อ หมู ไก่', amt: 11200, vat: 784 },
  { title: 'หมูสามชั้นและหมูสับ', cat: 'เนื้อ หมู ไก่', amt: 7800, vat: 546 },
  { title: 'ไก่ชำแหละและปีกไก่', cat: 'เนื้อ หมู ไก่', amt: 5400, vat: 378 },
  { title: 'ซอสปรุงรสและน้ำปลา', cat: 'ซอส', amt: 2100, vat: 147 },
  { title: 'น้ำมันพืชและน้ำมันมะกอก', cat: 'ซอส', amt: 4800, vat: 336 },
  { title: 'น้ำอัดลมและน้ำดื่มบรรจุขวด', cat: 'เครื่องดื่ม', amt: 3600, vat: 252 },
  { title: 'กาแฟและชาใบมะขาม', cat: 'เครื่องดื่ม', amt: 2800, vat: 196 },
  { title: 'กระเทียม หอมแดง พริก', cat: 'ซอส', amt: 1500, vat: 105 },
  { title: 'ผลไม้สดประจำสัปดาห์', cat: 'ผัก', amt: 4200, vat: 294 },
  { title: 'ปลาแซลมอนและกุ้งแช่แข็ง', cat: 'เนื้อ หมู ไก่', amt: 15600, vat: 1092 },
  { title: 'นมสดและโยเกิร์ต', cat: 'เครื่องดื่ม', amt: 2400, vat: 168 },
  { title: 'แป้งสาลีและแป้งข้าวโพด', cat: 'ซอส', amt: 1800, vat: 126 },
  { title: 'เครื่องเทศและสมุนไพรนำเข้า', cat: 'ซอส', amt: 3100, vat: 217 },
  { title: 'ถุงบรรจุและกล่องโฟม', cat: 'อื่นๆ', amt: 1200, vat: 84 },
  { title: 'อุปกรณ์ครัวสแตนเลส', cat: 'อื่นๆ', amt: 8900, vat: 623 },
  { title: 'น้ำตาลทรายและน้ำตาลมะพร้าว', cat: 'ซอส', amt: 980, vat: 68.6 },
  { title: 'ข้าวหอมมะลิ 100kg', cat: 'ผัก', amt: 5500, vat: 385 },
  { title: 'เส้นหมี่และเส้นก๋วยเตี๋ยว', cat: 'อื่นๆ', amt: 2600, vat: 182 },
  { title: 'ผักสลัดออร์แกนิค', cat: 'ผัก', amt: 6800, vat: 476 },
  { title: 'มะเขือเทศสด 30kg', cat: 'ผัก', amt: 2100, vat: 147 },
  { title: 'หมูแล่ทอดกรอบ', cat: 'เนื้อ หมู ไก่', amt: 4500, vat: 315 },
  { title: 'เป็ดย่างและเป็ดพะโล้', cat: 'เนื้อ หมู ไก่', amt: 9800, vat: 686 },
  { title: 'ซีฟู้ดรวม (ปลาหมึก ปู หอย)', cat: 'เนื้อ หมู ไก่', amt: 18500, vat: 1295 },
  { title: 'น้ำซุปกระดูกหมูสำเร็จรูป', cat: 'ซอส', amt: 3800, vat: 266 },
  { title: 'ผักโขมและบร็อคโคลี่', cat: 'ผัก', amt: 2900, vat: 203 },
  { title: 'ไส้กรอกและแฮม', cat: 'เนื้อ หมู ไก่', amt: 6200, vat: 434 },
  { title: 'เนยแข็งและครีม', cat: 'เครื่องดื่ม', amt: 7400, vat: 518 },
  { title: 'ผงแกงและพริกแกง', cat: 'ซอส', amt: 1600, vat: 112 },
  { title: 'ถาดอะลูมิเนียมและฟิล์มห่อ', cat: 'อื่นๆ', amt: 850, vat: 59.5 },
  { title: 'หัวกะทิและกะทิสำเร็จรูป', cat: 'ซอส', amt: 2300, vat: 161 },
  { title: 'แตงกวาและมะระ', cat: 'ผัก', amt: 1400, vat: 98 },
  { title: 'น้ำส้มสายชูและซีอิ้วขาว', cat: 'ซอส', amt: 920, vat: 64.4 },
  { title: 'กุ้งแม่น้ำสด 15kg', cat: 'เนื้อ หมู ไก่', amt: 12000, vat: 840 },
  { title: 'ผลไม้แห้งและถั่วรวม', cat: 'ผัก', amt: 3700, vat: 259 },
  { title: 'น้ำมะนาวคั้นสด', cat: 'เครื่องดื่ม', amt: 1100, vat: 77 },
  { title: 'สาหร่ายและวากาเมะ', cat: 'ผัก', amt: 2700, vat: 189 },
  { title: 'ไข่ไก่สด (10 แผง)', cat: 'เนื้อ หมู ไก่', amt: 1800, vat: 126 },
  { title: 'น้ำผึ้งและน้ำเชื่อม', cat: 'ซอส', amt: 2500, vat: 175 },
  { title: 'ขิงและข่า', cat: 'ผัก', amt: 780, vat: 54.6 },
  { title: 'เห็ดหอมและเห็ดนางฟ้า', cat: 'ผัก', amt: 3300, vat: 231 },
  { title: 'ปลาทูและปลากะพง', cat: 'เนื้อ หมู ไก่', amt: 5800, vat: 406 },
  { title: 'ถุงมือและผ้ากันเปื้อน', cat: 'อื่นๆ', amt: 650, vat: 45.5 },
  { title: 'น้ำยาล้างผักและผลไม้', cat: 'อื่นๆ', amt: 480, vat: 33.6 },
  { title: 'ซุปก้อนและผงปรุงรส', cat: 'ซอส', amt: 1350, vat: 94.5 },
  { title: 'วิปครีมและครีมเทียม', cat: 'เครื่องดื่ม', amt: 4100, vat: 287 },
  { title: 'ผักชีและพาร์สลีย์', cat: 'ผัก', amt: 560, vat: 39.2 },
  { title: 'หมูยอและลูกชิ้น', cat: 'เนื้อ หมู ไก่', amt: 3900, vat: 273 },
  { title: 'เครื่องดื่มชูกำลังและสปอร์ต', cat: 'เครื่องดื่ม', amt: 2200, vat: 154 },
  { title: 'ผักเคลและผักร็อคเก็ต', cat: 'ผัก', amt: 4600, vat: 322 },
]

const statuses = [
  ...Array(12).fill('pending'),
  ...Array(8).fill('purchasing'),
  ...Array(8).fill('accounting'),
  ...Array(10).fill('transferred'),
  ...Array(8).fill('received'),
  ...Array(4).fill('rejected'),
] as const

async function main() {
  const users = await prisma.user.findMany({ where: { role: { in: ['employee'] }, active: true } })
  if (!users.length) { console.error('ไม่พบ employee — รัน seed ก่อน'); process.exit(1) }

  const year = new Date().getFullYear() + 543
  const prefix = `PR-${year}-`
  const last = await prisma.purchaseRequest.findFirst({
    where: { reqNo: { startsWith: prefix } }, orderBy: { reqNo: 'desc' }, select: { reqNo: true },
  })
  let seq = last ? parseInt(last.reqNo.replace(prefix, ''), 10) : 0
  const nextNo = () => `${prefix}${String(++seq).padStart(3, '0')}`

  const pmethods = ['bank', 'cash', 'transfer'] as const
  const ptimings = ['before', 'after'] as const
  const dueDates = [d(-10), d(-7), d(-5), d(-3), d(-1), d(1), d(3), d(5), d(7), d(10), 'วันที่ 10', 'วันที่ 25']

  let created = 0
  for (let i = 0; i < 50; i++) {
    const item = items[i % items.length]
    const status = statuses[i]
    const user = users[i % users.length]
    const supplier = suppliers[i % suppliers.length]
    const n = seq + 1
    const prNo = `PR-${String(n).padStart(3, '0')}`
    const poNo = `PO-${String(n).padStart(3, '0')}`

    const hasPRPO = !['pending', 'rejected'].includes(status)
    const hasTransfer = ['transferred', 'received'].includes(status)
    const hasReceived = status === 'received'

    const data: any = {
      reqNo: nextNo(),
      title: item.title,
      category: item.cat,
      categories: '[]',
      totalAmount: item.amt + (item.vat || 0),
      vatAmount: item.vat || 0,
      reason: '',
      supplierName: supplier,
      supplierName2: '',
      paymentMethod: pmethods[i % 3],
      paymentTiming: ptimings[i % 2],
      orderDate: d(-(i % 10 + 1)),
      deliveryDate: d(-(i % 5)),
      dueDate: dueDates[i % dueDates.length],
      contactName: user.name,
      signedDate: d(-(i % 10 + 1)),
      status,
      notes: status === 'rejected' ? ['ราคาสูงเกินงบ', 'ข้อมูลไม่ครบถ้วน', 'ซ้ำกับรายการที่สั่งไปแล้ว'][i % 3] : null,
      createdBy: user.id,
      createdByName: user.name,
      ...(hasPRPO ? { prNo, poNo } : {}),
      ...(hasTransfer ? { transferRef: `TRF-${String(n).padStart(3,'0')}`, transferDate: d(-(i%5+1)) } : {}),
      ...(hasReceived ? { receivedAt: d(-(i%3+1)) } : {}),
    }

    await prisma.purchaseRequest.create({ data })
    console.log(`  [${String(i+1).padStart(2,'0')}] ${data.reqNo}  ${status.padEnd(12)}  ${item.title}`)
    created++
  }

  console.log(`\n✓ สร้างข้อมูลเทส ${created} รายการเรียบร้อย`)
  const summary = await prisma.purchaseRequest.groupBy({ by: ['status'], _count: true })
  console.log('\nสรุปทั้งหมดใน DB:')
  summary.forEach(s => console.log(`  ${s.status.padEnd(14)}: ${s._count} รายการ`))
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
