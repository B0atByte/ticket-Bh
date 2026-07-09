# CLAUDE.md — ระบบขอซื้อ (Purchase Request System)

ระบบจัดการใบขอซื้อสำหรับธุรกิจขนาดเล็ก
มี 5 roles, workflow อนุมัติ 3 ขั้น, มี backend จริงพร้อม database

---

## Stack

### Frontend
- React 19 + TypeScript + Vite
- Tailwind CSS v4 (ผ่าน `@tailwindcss/vite`)
- Lucide React (icons)
- ไม่มี router library — routing ทำด้วย `useState<Page>` ใน `App.tsx`
- JWT token เก็บใน `localStorage`

### Backend
- Node.js + Hono framework + TypeScript
- Prisma ORM + MySQL
- bcryptjs (password hashing)
- jsonwebtoken (JWT auth)
- **Zod** (input validation — ทุก route ใช้ schema validation)
- nodemailer (email notifications)

---

## โครงสร้างไฟล์

```
C:\tmp\
├── server.js                        # Node HTTP server เสิร์ฟ dist/ บน port 3456
└── prs\
    ├── app\                         # Frontend (React)
    │   ├── src\
    │   │   ├── main.tsx
    │   │   ├── App.tsx              # Components ทั้งหมดอยู่ที่นี่
    │   │   ├── data.ts              # Types, constants
    │   │   ├── index.css
    │   │   └── lib\api.ts           # API client (fetch wrapper)
    │   ├── dist\                    # Build output
    │   └── package.json
    ├── backend\                     # Backend (Hono + Prisma)
    │   ├── src\
    │   │   ├── index.ts             # Entry point, CORS, routes
    │   │   ├── routes\
    │   │   │   ├── auth.ts          # POST /login, GET /me
    │   │   │   ├── requests.ts      # CRUD ใบขอซื้อ + status workflow
    │   │   │   ├── users.ts         # CRUD users (itsupport only)
    │   │   │   ├── settings.ts      # GET public, PUT itsupport only
    │   │   │   ├── audit.ts         # Audit log
    │   │   │   └── files.ts         # Upload/serve files (max 20MB)
    │   │   ├── middleware\
    │   │   │   └── auth.ts          # authMiddleware, requireRole()
    │   │   └── lib\
    │   │       ├── jwt.ts           # signToken, verifyToken
    │   │       ├── prisma.ts        # Prisma client singleton
    │   │       ├── validate.ts      # parseBody() helper สำหรับ Zod
    │   │       └── mailer.ts        # Email templates
    │   ├── prisma\schema.prisma
    │   └── package.json
    └── docker-compose.yml
```

---

## Roles และสิทธิ์

| Role | ชื่อไทย | เมนูที่เข้าถึงได้ |
|------|---------|------------------|
| `owner` | ผู้ประกอบการ | Dashboard, AllRequests, Reports |
| `employee` | พนักงาน | Dashboard, MyRequests, CreateRequest |
| `purchasing` | ฝ่ายจัดซื้อ | Dashboard, PendingApproval, IssuePRPO, ForwardAccounting |
| `accounting` | บัญชี | Dashboard, PaymentList, RecordPayment, PaymentHistory |
| `itsupport` | IT Support | Dashboard, UserManagement, AddUser, AuditLog, SiteSettings |

Demo users (password ทุกคนคือ `1234`):
- `owner` / `employee` / `purchasing` / `accounting` / `itsupport`

---

## Workflow ใบขอซื้อ

```
Employee: สร้างใบขอซื้อ
    ↓
[pending] — รอฝ่ายจัดซื้อ
    ↓ Purchasing: PendingApprovalPage → IssuePRPOPage (ออก PR/PO)
[purchasing] — รอฝ่ายบัญชี
    ↓ Purchasing: ForwardAccountingPage
[accounting] — รอโอนเงิน
    ↓ Accounting: RecordPaymentPage (บันทึก Transfer Ref)
[transferred] — เสร็จสิ้น

(ปฏิเสธได้ทุกขั้น → [rejected])
```

---

## API Endpoints

| Method | Path | Auth | หน้าที่ |
|--------|------|------|---------|
| POST | `/api/auth/login` | public | Login รับ JWT token |
| GET | `/api/auth/me` | JWT | ดึงข้อมูล user ปัจจุบัน |
| GET | `/api/settings` | public | ดึง branding (ใช้ก่อน login) |
| PUT | `/api/settings` | itsupport | อัปเดต branding |
| GET | `/api/requests` | JWT | ดึงใบขอซื้อ (employee เห็นเฉพาะของตัวเอง) |
| POST | `/api/requests` | employee | สร้างใบขอซื้อ |
| PATCH | `/api/requests/:id/status` | JWT+role | อัปเดต status ตาม role |
| GET | `/api/users` | itsupport | รายชื่อ users ทั้งหมด |
| POST | `/api/users` | itsupport | สร้าง user ใหม่ |
| PUT | `/api/users/:id` | itsupport | แก้ไข user |
| DELETE | `/api/users/:id` | itsupport | ลบ user |
| POST | `/api/files` | JWT | อัปโหลดไฟล์ (max 20MB) |
| GET | `/api/files/:filename` | public | ดึงไฟล์ |
| GET | `/api/audit` | owner/itsupport | ดู audit log |

---

## Zod Input Validation

ทุก route ที่รับ body ใช้ Zod schema validation ผ่าน `parseBody()` helper ใน `src/lib/validate.ts`

```typescript
// ตัวอย่างการใช้ใน route
const result = await parseBody(c, mySchema)
if (!(result as any).data) return result as unknown as Response
const body = (result as any).data
```

Schemas หลัก:
- **auth.ts** — `loginSchema` (username min 1, password min 1)
- **users.ts** — `createUserSchema` (username regex, password min 6, email format, role enum), `updateUserSchema`
- **requests.ts** — `createRequestSchema` (items min 1, qty/price nonnegative), `updateStatusSchema` (status enum)
- **settings.ts** — `updateSettingsSchema` (siteName max 200, logoUrl nullable)
- **audit.ts** — `createAuditSchema` (action/module max 100, detail max 1000)
- **files.ts** — ตรวจ extension whitelist + max 20MB (ไม่ใช้ Zod เพราะเป็น multipart)

---

## Authorization Notes

- `GET /api/requests/:id` — employee เห็นเฉพาะ request ของตัวเอง (403 ถ้าพยายามดูของคนอื่น)
- `PATCH /api/requests/:id/status` — ใช้ `allowedActions` map; ถ้า status ไม่อยู่ใน map → 403 ทันที (แก้ไขจากเดิมที่มี bypass)
- `GET /api/settings` — public (ไม่ต้อง auth เพื่อโหลด branding ในหน้า login)

---

## Commands

```bash
# Frontend
cd prs/app
npm run dev        # dev server (Vite HMR)
npm run build      # build → dist/
npm run preview    # preview build

# Backend
cd prs/backend
npm run dev        # dev server (tsx watch)
npm run build      # compile TypeScript

# เสิร์ฟ frontend build
node server.js     # port 3456

# Docker (full stack)
docker compose up -d
```

---

## หมายเหตุสำหรับ Agent

- **มี backend จริง** — Hono + Prisma + MySQL ไม่ใช่ mock data
- **ไม่มี router** — เปลี่ยนหน้าด้วย `setPage(...)` ใน App.tsx เท่านั้น
- **component ทั้งหมดอยู่ใน `App.tsx` ไฟล์เดียว** — ถ้าจะเพิ่ม component ใหม่ใส่ก่อน `export default function App()`
- **Tailwind v4** — ไม่มี `tailwind.config.js`, config อยู่ใน CSS (`@theme`) และ `vite.config.ts`
- **Zod ทุก route** — อย่าลืมเพิ่ม schema เมื่อเพิ่ม endpoint ใหม่
- **Settings โหลดก่อน login** — App.tsx ดึง `GET /api/settings` ตั้งแต่ mount เพื่อแสดง branding ที่ถูกต้องในหน้า login
