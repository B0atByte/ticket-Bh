# BH Logistics

ระบบจัดการงานขนส่งภายในองค์กร สำหรับส่งสินค้าจากครัวกลางไปยังสาขา ระบบแบ่งผู้ใช้งานเป็น 4 บทบาท:

- `KITCHEN` สร้าง Order
- `ADMIN` อนุมัติ/ปฏิเสธ Order, จัดการผู้ใช้, ตั้งค่าระบบ
- `DRIVER` รับงาน, ถ่ายรูปหลักฐาน, ส่งสินค้า, เก็บลายเซ็น
- `BRANCH` ดูสถานะและหลักฐานการส่งของสาขาตัวเอง

## Tech Stack

Backend:
- Hono
- Prisma ORM
- MySQL
- JWT authentication
- Zod validation

Frontend:
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide icons

Infrastructure:
- Docker Compose สำหรับ MySQL และ phpMyAdmin

## โครงสร้างโปรเจกต์

```text
Bhlogistics/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── index.ts
│       ├── middleware/
│       ├── routes/
│       └── schemas/
├── frontend/
│   ├── index.html
│   └── src/
│       ├── components/
│       ├── contexts/
│       ├── lib/
│       └── pages/
├── docker-compose.yml
├── SETUP.md
└── agents.md
```

## การทำงานหลัก

1. ครัวกลางสร้าง Order พร้อมรายการสินค้าและสาขาปลายทาง
2. Admin ตรวจสอบแล้วอนุมัติหรือปฏิเสธ
3. Driver รับงานที่อนุมัติแล้ว
4. Driver ถ่ายรูปตอนรับสินค้า
5. Driver ส่งสินค้า ถ่ายรูปปลายทาง และเก็บลายเซ็น
6. Branch และ Admin ดูรายละเอียดการส่งย้อนหลังได้

## สถานะ Order

```text
PENDING -> APPROVED หรือ REJECTED
APPROVED -> ACCEPTED
ACCEPTED -> IN_TRANSIT
IN_TRANSIT -> DELIVERED
```

## วิธีรัน Development

### 1. Start database

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

Backend จะรันที่:

```text
http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend จะรันที่:

```text
http://localhost:5173
```

## Environment Variables

สร้างไฟล์ `backend/.env` จาก `backend/.env.example`

ตัวอย่าง:

```env
DATABASE_URL="mysql://bhuser:bhpassword2024@localhost:3306/bhlogistics"
JWT_SECRET="change-this-to-a-long-secret-at-least-32-characters"
JWT_REFRESH_SECRET="change-this-to-another-long-secret-at-least-32-characters"
FRONTEND_URL="http://localhost:5173"
PORT=3000
UPLOAD_DIR="./uploads"
BACKEND_URL="http://localhost:3000"
```

ห้าม commit ไฟล์ `.env` เพราะมี secret และข้อมูลเชื่อมต่อฐานข้อมูล

## Test Accounts

หลังรัน seed จะมีบัญชีทดสอบ:

| Role | Email | Password |
|---|---|---|
| ADMIN | admin@bhlogistics.com | admin1234 |
| KITCHEN | kitchen@bhlogistics.com | kitchen1234 |
| DRIVER | driver@bhlogistics.com | driver1234 |
| BRANCH | branch1@bhlogistics.com | branch1234 |
| BRANCH | branch2@bhlogistics.com | branch1234 |

## คำสั่งตรวจสอบ

Backend:

```bash
cd backend
npm run build
```

Frontend:

```bash
cd frontend
npm run build
```

## CI/CD

โปรเจกต์มี GitHub Actions workflow ที่ `.github/workflows/ci.yml`

ระบบจะรันอัตโนมัติเมื่อ:

- push ไปที่ `master` หรือ `main`
- เปิด pull request เข้า `master` หรือ `main`

CI จะตรวจ:

- ติดตั้ง dependency ของ backend ด้วย `npm ci`
- generate Prisma client
- build backend
- ติดตั้ง dependency ของ frontend ด้วย `npm ci`
- build frontend

ขั้นตอน deploy จริงยังไม่ได้ผูกไว้ เพราะต้องรู้ปลายทางก่อน เช่น VPS, Docker registry, Render, Railway, Vercel หรือ server ภายในองค์กร

## หมายเหตุด้านความปลอดภัย

- `.env` ถูก ignore แล้ว
- `node_modules`, `dist`, และไฟล์ upload ถูก ignore แล้ว
- รูปที่ upload ระหว่าง development จะอยู่ใน `backend/uploads/` และไม่ควร commit
- JWT secret ต้องยาวอย่างน้อย 32 ตัวอักษร
- ควรเปิด rate limiter กลับมาเมื่อนำขึ้น production
