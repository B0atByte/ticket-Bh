# BH Logistics - Setup Guide

## Prerequisites
- Node.js 20+
- MySQL 8+

## 1. Database Setup

```sql
CREATE DATABASE bhlogistics CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 2. Backend Setup

```bash
cd backend
cp .env.example .env
# แก้ไข DATABASE_URL ใน .env ให้ตรงกับ MySQL ของคุณ

npm install
npx prisma db push       # สร้าง schema ใน DB
npx prisma db seed       # สร้าง user ทดสอบ (optional)
npm run dev              # รันที่ http://localhost:3000
```

## 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev              # รันที่ http://localhost:5173
```

## Test Accounts (after seed)

| Role   | Email                      | Password     |
|--------|----------------------------|--------------|
| Admin  | admin@bhlogistics.com      | admin1234    |
| ครัว   | kitchen@bhlogistics.com    | kitchen1234  |
| คนขับ  | driver@bhlogistics.com     | driver1234   |
| สาขา 1 | branch1@bhlogistics.com   | branch1234   |
| สาขา 2 | branch2@bhlogistics.com   | branch1234   |

## Environment Variables (backend/.env)

| Variable           | Description                          |
|--------------------|--------------------------------------|
| DATABASE_URL       | MySQL connection string              |
| JWT_SECRET         | JWT signing secret (min 32 chars)    |
| JWT_REFRESH_SECRET | Refresh token secret (min 32 chars)  |
| FRONTEND_URL       | CORS allowed origin                  |
| PORT               | Server port (default 3000)           |
| UPLOAD_DIR         | Directory for uploaded files         |
| BACKEND_URL        | Used for generating upload URLs      |
