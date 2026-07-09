# Casa Lapin — ระบบขอซื้อสินค้า (Purchase Request System)

ระบบจัดการใบขอซื้อสำหรับร้านอาหาร Casa Lapin รองรับ 5 บทบาท มี workflow อนุมัติ 3 ขั้นตอน ระบบแนบไฟล์จริง tracking สถานะ real-time และแจ้งเตือนผ่าน Discord + Email

---

## สถานะการพัฒนา (Development Progress)

> **ปัจจุบัน: Phase 0–8 เสร็จสิ้นแล้ว — รอ Testing & Deploy**

| Phase | ชื่อ | สถานะ | หมายเหตุ |
|-------|------|--------|---------|
| **0** | Setup & Infrastructure | ✅ เสร็จ | |
| **1** | Authentication | ✅ เสร็จ | |
| **2** | Dashboard | ✅ เสร็จ | Bar chart + Pie chart ใน Dashboard และ Reports |
| **3** | Employee Pages | ✅ เสร็จ | สร้างใบขอซื้อ, แนบรูป, กดรับสินค้า |
| **4** | Purchasing Pages | ✅ เสร็จ | อนุมัติ, ออก PR/PO, ส่งต่อบัญชี, ปฏิเสธพร้อมหมายเหตุ |
| **5** | Accounting Pages | ✅ เสร็จ | เรียง dueDate, filter วันที่, Export CSV |
| **6** | Tracking Page | ✅ เสร็จ | Real-time polling 30s, timeline 5 ขั้น |
| **7** | IT Support Pages | ✅ เสร็จ | Audit filter, Export CSV, Discord notification settings |
| **8** | PDF Generation | ✅ เสร็จ | Print/PDF ใบขอซื้อจาก modal |
| **9** | Testing & QA | ✅ เสร็จ | 64 test cases, Pen test, Security fix |
| **10** | Deploy & Go Live | ⬜ ยังไม่ทำ | ต้องการ VPS + HTTPS |

---

## รายละเอียดแต่ละ Phase

### ✅ Phase 0 — Setup & Infrastructure
- โครงสร้าง Monorepo (frontend + backend แยก folder)
- Docker Compose: MySQL 8.0 + Node.js backend + phpMyAdmin
- Database schema ด้วย Prisma ORM (User, PurchaseRequest, PurchaseItem, AuditLog, Settings)
- Environment config (.env)
- Git repository + .gitignore

---

### ✅ Phase 1 — Authentication
- หน้า Login พร้อม demo account shortcuts
- JWT login / logout จริง (8 ชั่วโมง)
- bcrypt password hash
- Role-based middleware guard ทุก API endpoint
- Auto-login จาก token ใน localStorage
- Redirect ไปหน้า Login เมื่อ session หมดอายุ

---

### ✅ Phase 2 — Dashboard
- Stat cards ดึงข้อมูลจาก DB จริง (จำนวนคำขอ, ยอดรวม, สถานะ)
- Filter ตาม role อัตโนมัติ
- ตารางคำขอล่าสุด 10 รายการ (เรียงตาม updatedAt)
- Bar chart ยอดสั่งซื้อ 6 เดือนล่าสุด (SVG)
- Pie chart สัดส่วนตามหมวดสินค้า (SVG)

---

### ✅ Phase 3 — Employee Pages
**หน้าสร้างใบขอซื้อ**
- แนบรูปใบขอซื้อ (ไม่มีตารางรายการ — ใช้วิธีถ่ายรูปแนบ)
- กรอกยอดเงินรวมด้วยตัวเอง
- Auto-generate เลขใบขอซื้อ (PR-2568-001) — ป้องกัน duplicate
- Toast notification เมื่อสำเร็จ

**หน้าคำขอของฉัน**
- ดึงเฉพาะ request ของ user นั้นจาก DB
- กดดูรายละเอียด + กดแก้ไข (เฉพาะ status pending)
- ปุ่ม "กดรับสินค้า" เมื่อสถานะ transferred พร้อมแนบใบส่งของ + ใบกำกับภาษี

---

### ✅ Phase 4 — Purchasing Pages
**หน้ารออนุมัติ**
- List pending requests จาก DB
- กดดูรายละเอียดในหน้ารายการ
- ปุ่ม Approve (ออก PR/PO) / Reject พร้อมกรอกหมายเหตุ

**หน้าออก PR/PO**
- Upload ไฟล์จริง → บันทึก local disk (`backend/uploads/`)
- แสดงผู้อัปโหลด + role + เวลา
- บันทึก prNo / poNo ลง DB

**หน้าส่งต่อบัญชี**
- Forward status → accounting
- ส่ง Email + Discord แจ้งอัตโนมัติ

---

### ✅ Phase 5 — Accounting Pages
**หน้ารายการรอโอนเงิน**
- เรียงตาม dueDate ใกล้หมดก่อน
- Badge เตือน: เกินกำหนด / ครบวันนี้ / อีก N วัน
- Border แดงถ้าเกินกำหนด

**หน้าบันทึกการโอน**
- บันทึก transferRef + transferDate + แนบสลิป
- อัปเดต status → transferred
- ส่ง Email + Discord แจ้งผู้ขอ

**หน้าประวัติการโอน**
- ตาราง + search + filter ช่วงวันที่
- Export CSV

---

### ✅ Phase 6 — Tracking Page
- Timeline 5 ขั้น: สร้างคำขอ → ฝ่ายจัดซื้อ → ออก PR/PO → โอนเงิน → รับสินค้า
- ดึงจาก DB จริง พร้อมสถานะแต่ละขั้น
- Employee เห็นเฉพาะของตัวเอง
- กดการ์ดเพื่อดูรายละเอียดเต็ม + เอกสารแนบแบบ Timeline
- **Real-time polling ทุก 30 วินาที** — อัปเดตสถานะอัตโนมัติ

---

### ✅ Phase 7 — IT Support Pages
**หน้าจัดการผู้ใช้**
- CRUD user ลง DB (เพิ่ม / แก้ไข / ลบ)
- Reset password (รีเซ็ตเป็น 1234)
- Toggle active / inactive

**หน้า Audit Log**
- บันทึก log ทุก action ลง DB
- แสดง user, action, module, เวลา, IP
- Filter by action (dropdown) + ช่วงวันที่ + search
- Export CSV

**หน้ารายงาน**
- กราฟ Bar/Pie จากข้อมูลจริง
- Export CSV รายงานทุกใบขอซื้อ

**หน้าตั้งค่าเว็บไซต์**
- เปลี่ยนโลโก้ + ชื่อร้าน + subtitle ผ่าน UI
- มีผลทันทีทั้ง Login page, Sidebar, Favicon, Title

**หน้า Discord แจ้งเตือน** *(ใหม่)*
- ตั้งค่า Webhook URL
- Toggle แต่ละ event (6 events)
- ปุ่มทดสอบส่ง embed message

---

### ✅ Phase 8 — PDF Generation
- ปุ่ม "พิมพ์ / บันทึก PDF" ใน RequestDetailModal
- เปิดหน้าต่างใหม่พร้อม layout ใบขอซื้อ (header, รายการ, ยอดรวม, ช่องเซ็น)
- trigger `window.print()` อัตโนมัติ → บันทึกเป็น PDF ผ่าน browser

---

### ⬜ Phase 9 — Testing & QA
- ทดสอบ workflow ทุก role ครบทุก path
- Edge cases: file ใหญ่, network error, session หมดอายุ
- UAT กับผู้ใช้จริงในทีม
- Bug fix จาก feedback

---

### ⬜ Phase 10 — Deploy & Go Live
- Setup VPS + Nginx + SSL
- Docker Compose production mode
- Import ข้อมูลเก่า (ถ้ามี)
- สร้าง user จริงทุก account
- Monitor + รับ feedback สัปดาห์แรก

---

## ภาพรวม Workflow

```
พนักงาน: สร้างใบขอซื้อ (แนบรูป)
    ↓
[pending] — รอฝ่ายจัดซื้อ
    ↓ ฝ่ายจัดซื้อ: ออก PR/PO + แนบเอกสาร
[purchasing] — รอส่งต่อบัญชี
    ↓ ฝ่ายจัดซื้อ: Forward ไปบัญชี
[accounting] — รอโอนเงิน
    ↓ ฝ่ายบัญชี: บันทึก Transfer Ref + แนบสลิป
[transferred] — รอพนักงานรับสินค้า
    ↓ พนักงาน: กดรับสินค้า + แนบใบส่งของ + ใบกำกับภาษี
[received] ✓ เสร็จสิ้น

(ปฏิเสธได้ทุกขั้น → rejected พร้อมหมายเหตุ)
```

---

## Discord Notifications

แจ้งเตือนอัตโนมัติทุก event พร้อม embed message สวยงาม:

| Event | ผู้รับแจ้ง | สี |
|-------|-----------|-----|
| ใบขอซื้อใหม่ | ฝ่ายจัดซื้อ | 🟡 Amber |
| ออก PR/PO | ฝ่ายบัญชี | 🔵 Blue |
| ส่งต่อบัญชี | ฝ่ายบัญชี | 🟣 Purple |
| โอนเงินสำเร็จ | พนักงาน | 🟢 Green |
| ปฏิเสธ | พนักงาน | 🔴 Red |
| รับสินค้าแล้ว | ทุกคน | 🟢 Green |

---

## Tech Stack

### Frontend
| ส่วน | เทคโนโลยี | หมายเหตุ |
|------|----------|---------|
| Framework | React 19 + TypeScript | |
| Build Tool | Vite 8 | |
| Styling | Tailwind CSS v4 | |
| Icons | Lucide React | |

### Backend
| ส่วน | เทคโนโลยี | หมายเหตุ |
|------|----------|---------|
| Runtime | Node.js 20 | |
| Framework | Hono | |
| ORM | Prisma 5 | |
| Database | MySQL 8.0 | |
| Auth | JWT (8h) + bcryptjs | Token blacklist on logout |
| Validation | Zod | ทุก route |
| File Storage | Local disk + sharp | Auto-compress รูป → WebP (ลด ~88%) |
| Excel Export | ExcelJS | Export รายงานใบขอซื้อ |
| Email | Nodemailer | ตั้งค่า SMTP ได้จากใน UI (Gmail / Outlook / อื่นๆ) |
| Discord | Discord Webhooks + discord.js Bot | แจ้งเตือน + รายงานประจำวัน |
| Scheduler | node-cron | ส่งรายงาน Discord ตามเวลาที่กำหนด |

### Security
| ส่วน | เทคโนโลยี | หมายเหตุ |
|------|----------|---------|
| Rate Limiting | In-memory (custom) | Lock IP หลัง login ผิด 5 ครั้ง |
| Token Blacklist | In-memory (custom) | JWT ใช้ไม่ได้ทันทีหลัง logout |
| Security Headers | Hono middleware | X-Frame-Options, X-Content-Type-Options, X-XSS-Protection ฯลฯ |
| Workflow Guard | Prisma + role check | ตรวจ current status ก่อน transition |

### Infrastructure
| ส่วน | เทคโนโลยี | หมายเหตุ |
|------|----------|---------|
| Container | Docker + Docker Compose | Backend + MySQL + phpMyAdmin |
| DB Admin | phpMyAdmin | Bind localhost เท่านั้น ต้องใส่ password |
| Process Manager | PM2 | Frontend restart อัตโนมัติ |
| Dev Proxy | Vite proxy (`/api` → `localhost:3000`) | |

---

## วิธีรัน (Development)

### ต้องติดตั้งก่อน
- Docker Desktop
- Node.js 20+

### 1. Clone และตั้งค่า
```bash
git clone https://github.com/B0atByte/PRsystem.git
cd PRsystem
```

สร้างไฟล์ `.env` ที่ root:
```env
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=pr_system
MYSQL_USER=pruser
MYSQL_PASSWORD=prpassword
JWT_SECRET=your-secret-key
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=Casa Lapin PR System <your-gmail@gmail.com>
SITE_URL=http://your-server-ip:5173
```

### 2. รัน Backend + Database
```bash
docker compose up -d
```

### 3. Seed ข้อมูลตัวอย่าง (ครั้งแรก)
```bash
docker exec pr_backend npx prisma db push
docker exec pr_backend npm run db:seed
```

### 4. รัน Frontend
```bash
cd app
npm install
npm run dev
```

เปิดที่ `http://localhost:5173`

### LAN Access
Vite ตั้งค่า `host: true` ไว้แล้ว — เปิด `http://<IP เครื่อง>:5173` จากเครื่องอื่นในวงได้เลย

> Windows ต้องเพิ่ม Firewall rule ก่อน:
> ```powershell
> New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow
> ```

---

## Services และ Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend API (Hono) | 3000 | http://localhost:3000 |
| MySQL | 3306 | — |
| phpMyAdmin | 8080 | http://localhost:8080 |

---

## บัญชีผู้ใช้เริ่มต้น

> รหัสผ่านทุก account: **1234**

| Username | บทบาท | สิทธิ์หลัก |
|----------|-------|-----------|
| `owner` | ผู้ประกอบการ | ดูภาพรวม, รายงาน, คำขอทั้งหมด |
| `employee` | พนักงาน | สร้างใบขอซื้อ, ติดตามสถานะ, กดรับสินค้า |
| `emp2` | พนักงาน | สร้างใบขอซื้อ, ติดตามสถานะ, กดรับสินค้า |
| `purchasing` | ฝ่ายจัดซื้อ | อนุมัติ, ออก PR/PO, แนบเอกสาร, ส่งต่อบัญชี |
| `accounting` | บัญชี | บันทึกการโอนเงิน, แนบสลิป, ประวัติการโอน |
| `itsupport` | IT Support | จัดการผู้ใช้, Audit Log, ตั้งค่าเว็บไซต์, Discord |

---

## โครงสร้างโปรเจ็ค

```
prs/
├── docker-compose.yml
├── .env                        # credentials (git ignored)
├── README.md
├── CLAUDE.md                   # สารบัญสำหรับ AI agent
├── app/                        # Frontend
│   ├── src/
│   │   ├── App.tsx             # Components ทั้งหมด
│   │   ├── data.ts             # Types + constants
│   │   ├── lib/api.ts          # API client
│   │   └── index.css
│   ├── public/
│   │   └── favicon.png
│   └── package.json
└── backend/                    # Backend
    ├── src/
    │   ├── index.ts            # Hono server entry
    │   ├── routes/             # auth, requests, users, audit, files, settings
    │   ├── middleware/         # JWT auth + requireRole
    │   └── lib/                # prisma, jwt, mailer, discord, validate
    ├── prisma/
    │   └── schema.prisma
    ├── uploads/                # ไฟล์ที่ผู้ใช้อัปโหลด (git ignored)
    └── Dockerfile
```
