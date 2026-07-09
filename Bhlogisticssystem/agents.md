# BH Logistics — Agent Handoff Document

> อ่านไฟล์นี้ก่อนแก้ไขโค้ดใดๆ เพื่อเข้าใจสิ่งที่ทำไปแล้วและข้อตัดสินใจสำคัญต่างๆ

---

## สรุปโปรเจกต์

ระบบจัดการโลจิสติกส์ภายในองค์กร (คล้าย Grab แต่ใช้ภายใน) สำหรับขนส่งสินค้าจากครัวกลางไปยังสาขาต่างๆ มี 4 roles: KITCHEN · ADMIN · DRIVER · BRANCH

---

## Tech Stack

### Backend
| Package | Version | หน้าที่ |
|---|---|---|
| Hono | ^4.6.16 | HTTP framework |
| @hono/node-server | ^1.13.7 | Node.js adapter |
| Prisma ORM | ^6.3.1 | Database ORM |
| MySQL | 8.0 (Docker) | Database |
| bcryptjs | ^2.4.3 | Password hashing (12 rounds) |
| jsonwebtoken | ^9.0.2 | JWT signing |
| zod | ^3.24.1 | Input validation |
| tsx | ^4.19.2 | TypeScript runner (dev) |

### Frontend
| Package | Version | หน้าที่ |
|---|---|---|
| React | ^19.0.0 | UI framework |
| TypeScript | ^5.7.2 | Type safety |
| Vite | ^6.0.5 | Build tool |
| Tailwind CSS | ^4.0.0 | Styling (v4 — ใช้ CSS config ไม่ใช่ JS) |
| @tailwindcss/vite | ^4.0.0 | Tailwind v4 Vite plugin |
| Lucide React | ^0.469.0 | Icons |
| IBM Plex Sans Thai | Google Fonts | Font |

### Infrastructure
| Service | Port | ข้อมูลล็อกอิน |
|---|---|---|
| Backend API | 3000 | — |
| Frontend Dev Server | 5173 | — |
| MySQL (Docker) | 3306 | root / bhlogistics2024 |
| phpMyAdmin (Docker) | 8080 | root / bhlogistics2024 |

---

## โครงสร้างไฟล์

```
Bhlogistics/
├── docker-compose.yml          # MySQL + phpMyAdmin
├── agents.md                   # ← ไฟล์นี้
├── SETUP.md                    # คู่มือติดตั้ง
│
├── backend/
│   ├── .env                    # ตัวแปร environment (อย่า commit)
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── seed.ts             # สร้าง user ทดสอบ
│   ├── src/
│   │   ├── index.ts            # Hono app entry point
│   │   ├── lib/prisma.ts       # PrismaClient singleton
│   │   ├── middleware/auth.ts  # JWT authenticate + RBAC authorize
│   │   ├── routes/
│   │   │   ├── auth.ts         # /api/auth/*
│   │   │   ├── orders.ts       # /api/orders/*
│   │   │   └── uploads.ts      # /api/uploads
│   │   └── schemas/index.ts    # Zod schemas ทุกตัว
│   └── uploads/                # ไฟล์อัปโหลด (สร้างอัตโนมัติ)
│
└── frontend/
    ├── index.html              # มี inline script กัน dark mode flash
    ├── vite.config.ts          # Proxy /api และ /uploads → localhost:3000
    └── src/
        ├── App.tsx             # Root — ThemeProvider > ToastProvider > AuthProvider
        ├── index.css           # Tailwind v4 import + dark mode variant + font
        ├── contexts/
        │   ├── AuthContext.tsx  # user, login(), logout(), isLoading
        │   ├── ThemeContext.tsx # light/dark toggle, persist localStorage (key: bhl_theme)
        │   └── ToastContext.tsx # toast.success/error/info, max 3 toasts, 4s auto-dismiss
        ├── lib/api.ts          # fetch wrapper: auto-attach Bearer, 401 → refresh → retry
        ├── types/index.ts      # TypeScript interfaces ทั้งหมด
        ├── components/
        │   ├── AppLayout.tsx   # Sidebar layout (w-14 mobile / md:w-52 desktop)
        │   ├── ConfirmDialog.tsx
        │   ├── OrderCard.tsx
        │   ├── OrderCardSkeleton.tsx
        │   ├── Pagination.tsx  # Smart ellipsis pagination
        │   ├── PhotoSlots.tsx  # N-slot photo uploader
        │   ├── SearchInput.tsx # Debounced search (350ms)
        │   ├── SignatureCanvas.tsx # Canvas ลายเซ็น (mouse + touch)
        │   └── StatusBadge.tsx
        └── pages/
            ├── LoginPage.tsx
            ├── KitchenPage.tsx
            ├── AdminPage.tsx
            ├── DriverPage.tsx
            └── BranchPage.tsx
```

---

## Database Schema (Prisma)

```prisma
enum Role        { KITCHEN | ADMIN | DRIVER | BRANCH }
enum OrderStatus { PENDING | APPROVED | ACCEPTED | IN_TRANSIT | DELIVERED | REJECTED }

User        id, email(unique), password(hashed), name, role, branchId?
Order       id, orderNo(unique), status, branchId, createdById, driverId?,
            notes?, initImageUrl?, pickupPhotos(Json), dropoffPhotos(Json),
            signatureUrl?, deliveredAt?
OrderItem   id, orderId, name, quantity, unit
RefreshToken id, token(unique), userId, expiresAt
```

**Valid status transitions (server enforced):**
```
PENDING → APPROVED (ADMIN) | REJECTED (ADMIN)
APPROVED → ACCEPTED (DRIVER)
ACCEPTED → IN_TRANSIT (DRIVER) — ต้องมี pickupPhotos ≥ 3
IN_TRANSIT → DELIVERED (DRIVER) — ต้องมี dropoffPhotos + signatureUrl
```

---

## API Endpoints

```
POST   /api/auth/login       — public, คืน accessToken + refreshToken
POST   /api/auth/register    — ADMIN only
POST   /api/auth/refresh     — rotate refresh token
POST   /api/auth/logout      — ลบ refresh token
GET    /api/auth/me          — ดึงข้อมูล user ปัจจุบัน

GET    /api/orders           — list (ADMIN=ทั้งหมด, DRIVER=approved+own, BRANCH=branchId, KITCHEN=ตัวเอง)
                               query: page, limit, status, branchId, search
POST   /api/orders           — KITCHEN only
GET    /api/orders/:id       — single order (role-based access check)
PATCH  /api/orders/:id/status — update status (RBAC + transition validation)

POST   /api/uploads          — อัปโหลดรูป, คืน { url: "http://localhost:3000/uploads/xxx.jpg" }
GET    /uploads/:filename    — static file serving (Cross-Origin-Resource-Policy: cross-origin)

GET    /api/health           — { status: "ok", timestamp }
```

---

## Security ที่ implement แล้ว

- **JWT**: accessToken อายุ 15 นาที, refreshToken 7 วัน (stored ใน DB, rotate ทุกครั้ง)
- **Bcrypt**: 12 rounds, dummy hash กัน timing attack ตอน login user ไม่เจอ
- **Zod**: validate ทุก input ก่อนถึง DB
- **RBAC**: `authenticate` middleware + `authorize(...roles)` per-route
- **CORS**: เปิดเฉพาะ `FRONTEND_URL` จาก env
- **secureHeaders**: Hono built-in (ปิด crossOriginResourcePolicy เพราะ handle เอง)
- **Static files**: ตั้ง `Cross-Origin-Resource-Policy: cross-origin` + `Access-Control-Allow-Origin: *`
  - **เหตุผล**: ถ้าไม่ตั้ง browser จะบล็อกรูปจาก localhost:3000 เมื่อเปิดจาก localhost:5173
- **Env validation**: ถ้า JWT_SECRET < 32 chars → crash ตั้งแต่ startup
- **Rate limiter**: ถูก**ปิด**แล้วในไฟล์ routes/auth.ts (เอาออกเพื่อ test) — middleware ยังอยู่ใน auth.ts แต่ไม่ถูกใช้

---

## Frontend Architecture

### Routing
ใช้ `useState` ใน App.tsx แทน router library — role ของ user เป็นตัวตัดสินว่า render page ไหน

### Auth Flow
1. `accessToken` เก็บใน memory (React state ผ่าน `api.ts` module variable)
2. `refreshToken` เก็บใน `localStorage` (key: `bhlogistics_refresh_token`)
3. ถ้า API คืน 401 → `api.ts` เรียก `/refresh` อัตโนมัติ → retry request เดิม
4. ถ้า refresh ล้มเหลว → clear tokens + user = null → กลับหน้า login

### Dark Mode
- Tailwind v4 ใช้ `@variant dark (&:where(.dark, .dark *))` → class-based
- Toggle `.dark` บน `<html>` element
- localStorage key: `bhl_theme`
- inline script ใน `index.html` กัน flash ก่อน React load

### Sidebar Navigation (AppLayout)
- `w-14` (56px) mobile — icon only + tooltip on hover
- `md:w-52` (208px) desktop — icon + label
- Badge บน nav item (pending count, available jobs)
- Dark mode toggle + logout ที่ sidebar ล่าง

### Navigation per Role
| Role | Tabs |
|---|---|
| Kitchen | สร้าง Order · ประวัติ |
| Admin | Orders ทั้งหมด · รออนุมัติ (badge) · ผู้ใช้งาน |
| Driver | งานที่รอรับ (badge) · งานของฉัน · ประวัติ |
| Branch | ทั้งหมด · กำลังมา · ส่งแล้ว |

---

## Test Accounts (จาก seed)

| Role | Email | Password |
|---|---|---|
| ADMIN | admin@bhlogistics.com | admin1234 |
| KITCHEN | kitchen@bhlogistics.com | kitchen1234 |
| DRIVER | driver@bhlogistics.com | driver1234 |
| BRANCH (สาขา 1) | branch1@bhlogistics.com | branch1234 |
| BRANCH (สาขา 2) | branch2@bhlogistics.com | branch1234 |
| DRIVER (เพิ่มมาทีหลัง) | driver2@bhlogistics.com | driver21234 |

---

## Bug ที่แก้ไปแล้ว

### 1. รูปภาพไม่ขึ้นทุกหน้า
**ปัญหา:** `secureHeaders()` ของ Hono ตั้ง `Cross-Origin-Resource-Policy: same-origin` ให้ทุก route — browser บล็อกรูปจาก port 3000 ในหน้าที่รันบน port 5173

**แก้:** ใน `backend/src/index.ts`:
```typescript
app.use('*', secureHeaders({ crossOriginResourcePolicy: false }))
app.use('/uploads/*', async (c, next) => {
  c.header('Cross-Origin-Resource-Policy', 'cross-origin')
  c.header('Access-Control-Allow-Origin', '*')
  await next()
})
```

### 2. BranchPage ไม่เห็นรูปและข้อมูล
**ปัญหา:** click handler เดิมเปิด detail view เฉพาะ order ที่ status = `DELIVERED` เท่านั้น

**แก้:** ทุก order กด open detail ได้ + เพิ่ม `GET /api/orders/:id` endpoint สำหรับโหลดข้อมูลสดทุกครั้ง

### 3. Rate limiter block การ test
**ปัญหา:** ทดสอบ login หลายครั้งติดกัน → 429 Too Many Requests

**แก้:** เอา `authRateLimit` middleware ออกจาก routes (middleware ยังอยู่ใน code แต่ไม่ได้ใช้งาน)

---

## สิ่งที่ยังไม่ได้ทำ / ทำต่อได้

- [ ] Rate limiter ควรเปิดใช้ใน production
- [ ] Real-time notifications (WebSocket / SSE) — ตอนนี้ Driver page poll ทุก 30 วินาที
- [ ] Push notifications สำหรับ mobile
- [ ] Upload images ไปยัง cloud storage (S3/Cloudflare R2) — ตอนนี้เก็บที่ disk
- [ ] Export รายงาน PDF/Excel
- [ ] Admin dashboard สถิติแยกตามสาขา/วันที่
- [ ] Multi-language support
- [ ] Production Docker setup (Nginx reverse proxy)

---

## วิธีรัน Development

```bash
# 1. Start database
cd Bhlogistics && docker compose up -d

# 2. Backend
cd backend && npm install
npx prisma db push
npx prisma db seed   # สร้าง test users
npm run dev          # port 3000

# 3. Frontend (terminal ใหม่)
cd frontend && npm install
npm run dev          # port 5173
```

**หมายเหตุ:** backend ใช้ `tsx` (ไม่ใช่ `ts-node`) — ถ้า restart ต้อง kill process เก่าก่อน เพราะรัน background ด้วย `nohup`

---

## Environment Variables (backend/.env)

```env
DATABASE_URL="mysql://bhuser:bhpassword2024@localhost:3306/bhlogistics"
JWT_SECRET="bhlogistics-jwt-secret-key-must-be-32-chars-minimum-2024"
JWT_REFRESH_SECRET="bhlogistics-refresh-secret-key-must-be-32-chars-minimum-2024"
FRONTEND_URL="http://localhost:5173"
PORT=3000
UPLOAD_DIR="./uploads"
BACKEND_URL="http://localhost:3000"
```

> **สำคัญ:** `JWT_SECRET` และ `JWT_REFRESH_SECRET` ต้องยาว ≥ 32 ตัวอักษร ไม่งั้น server crash ตั้งแต่ start
