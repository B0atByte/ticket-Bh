# LMS Casa

Enterprise Learning Management System รวมเทรนพนักงาน + ระบบสอบ
รองรับผู้ใช้ 500–5,000 คน, ภาษาไทยเป็นหลัก

> **อ่าน `../Agenstimeline.md` ก่อนแก้ไขทุกครั้ง** — เป็น single source of truth สำหรับ agent ทุกตัว

## Quick Start

```bash
# 1. clone & เข้า directory
cd lms-system

# 2. copy env
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. start infrastructure (MySQL + Redis)
docker compose up -d mysql redis

# 4. setup database
cd server
npm install
npx prisma migrate dev
npx prisma db seed

# 5. dev (รัน 2 terminal)
# terminal 1
cd server && npm run dev
# terminal 2
cd client && npm install && npm run dev
```

เปิด:
- Frontend: http://localhost:5173
- API: http://localhost:4000
- Swagger docs: http://localhost:4000/api/docs
- Prisma Studio: `cd server && npx prisma studio`

## Structure

```
lms-system/
├── client/         # React 18 + Vite + TS + Tailwind + shadcn/ui
├── server/         # Express + TS + Prisma + MySQL + Redis + BullMQ
├── docker-compose.yml
└── .env.example
```

## Tech Stack

ดู `../Agenstimeline.md` section 1 (Project Brief)

## Scripts

| Command | Effect |
|---|---|
| `docker compose up -d` | start MySQL + Redis (+ app ถ้าตั้ง profile) |
| `docker compose down` | stop ทั้งหมด |
| `cd server && npm run dev` | start API dev (port 4000) |
| `cd server && npm run typecheck` | TypeScript check |
| `cd server && npm test` | run Vitest |
| `cd server && npx prisma migrate dev` | apply DB migrations |
| `cd server && npx prisma studio` | DB GUI |
| `cd client && npm run dev` | start Vite (port 5173) |
| `cd client && npm run build` | production build |
| `cd client && npm test` | run Vitest |
