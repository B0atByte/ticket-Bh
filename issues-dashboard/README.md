# issues-dashboard

หน้า dashboard กลางที่รวมรายการ "แจ้งปัญหา" จากทั้ง 5 ระบบ (Bhlogisticssystem, PRsystem, lms-casa, xBloom-sytem, QSC-Sytem) มาแสดงในหน้าเดียว

เป็น **stateless proxy/aggregator** ล้วนๆ — ไม่มี DB ของตัวเอง ทุกครั้งที่เปิดหน้า/กดรีเฟรช จะยิง request ไปดึงข้อมูลสดจาก `GET /issues` ของทั้ง 5 ระบบพร้อมกัน (server-to-server ผ่าน `X-Dashboard-Key`, browser ไม่เห็น key เหล่านี้เลย) แล้วรวม/เรียงเวลาให้

## โครงสร้าง

```
backend/    Hono + @hono/node-server — login ด้วยรหัสผ่าน admin กลาง (JWT ของตัวเอง) + fan-out ไป 5 ระบบ
frontend/   React 19 + Vite + Tailwind v4 — หน้า login + หน้า dashboard (ค้นหา, filter ตามระบบ, รีเฟรช)
```

## Setup

### 1. ตั้งค่า `DASHBOARD_API_KEY` ในทั้ง 5 ระบบก่อน

แต่ละระบบต้องมี env var นี้ตรงกับที่จะกรอกในขั้นตอนที่ 2 (สุ่มค่าเอง เช่น `openssl rand -hex 32`, ใช้คนละค่าต่อระบบได้):

| ระบบ | ตั้งค่าที่ไฟล์ |
|---|---|
| Bhlogisticssystem | `Bhlogisticssystem/backend/.env` → `DASHBOARD_API_KEY` |
| PRsystem | root `.env` (ใช้กับ docker-compose) → `DASHBOARD_API_KEY` |
| lms-casa | `lms-casa/server/.env` → `DASHBOARD_API_KEY` |
| xBloom-sytem | root `.env` (ใช้กับ docker-compose) → `DASHBOARD_API_KEY` |
| QSC-Sytem | `QSC-Sytem/qsc-web/docker-compose.yml` env หรือ `.env` → `DASHBOARD_API_KEY` |

### 2. ตั้งค่า backend ของ dashboard

```bash
cd issues-dashboard/backend
cp .env.example .env
npm install
```

แก้ `.env`:
- `JWT_SECRET` — สุ่มยาวๆ (`openssl rand -base64 48`), **คนละค่ากับ JWT ของทั้ง 5 ระบบเดิม**
- `ADMIN_PASSWORD_HASH` — bcrypt hash ของรหัสผ่าน admin กลาง สร้างด้วย:
  ```bash
  node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
  ```
- `*_BASE_URL` และ `*_API_KEY` ของทั้ง 5 ระบบ — `*_API_KEY` ต้องตรงกับ `DASHBOARD_API_KEY` ที่ตั้งไว้ในขั้นตอนที่ 1 ของระบบนั้นๆ

```bash
npm run dev   # http://localhost:4002
```

### 3. ตั้งค่า frontend

```bash
cd issues-dashboard/frontend
npm install
npm run dev   # http://localhost:5177
```

เปิด http://localhost:5177 แล้ว login ด้วยรหัสผ่าน admin ที่ตั้งไว้

## หมายเหตุ

- **Port ชนกัน**: xBloom-sytem API container default host port `8080` และ QSC-Sytem docker default host port `8080` เหมือนกัน — ถ้าจะรันทั้งคู่พร้อมกันบนเครื่องเดียว ต้องปรับ `API_PORT` ของ xBloom (root `.env`) หรือ port mapping ของ QSC ก่อน
- ถ้าระบบใดปิดอยู่หรือ key ไม่ตรง หน้า dashboard จะยังแสดงข้อมูลจากระบบอื่นได้ตามปกติ พร้อม badge สีแดงบอกว่าระบบไหนดึงไม่สำเร็จ (ไม่ crash ทั้งหน้า)
- Field ที่มี: description, page, ผู้แจ้ง (ชื่อ+role ถ้ามี), เวลา — ไม่มี title/status/severity/category/attachment เพราะทั้ง 5 ระบบต้นทางไม่มีข้อมูลเหล่านี้ (เป็น feedback widget สั้นๆ ไม่ใช่ ticketing system)

## รวม Discord แจ้งเตือนเป็น channel กลาง (ไม่บังคับ, แยกจาก dashboard นี้)

ถ้าต้องการให้ข้อความแจ้งปัญหาจากทั้ง 5 ระบบไปโผล่ที่ Discord channel เดียวกัน (แทนที่จะแยกคนละ channel เหมือนเดิม) แค่สร้าง Discord webhook ใหม่ 1 อัน แล้วชี้ทั้ง 5 ระบบไปที่ URL เดียวกัน — **ไม่ต้องแก้โค้ด** เพราะทุกระบบ label ชื่อระบบต้นทางไว้ในข้อความอยู่แล้ว (title หรือ bot username/footer ต่างกันต่อระบบ):

| ระบบ | ตั้งค่าที่ไหน |
|---|---|
| Bhlogisticssystem | `backend/.env` → `DISCORD_WEBHOOK_URL` |
| PRsystem | **ไม่ใช่ .env** — login เป็น `itsupport` แล้วตั้งค่าในหน้า Site Settings |
| lms-casa | `server/.env` → `DISCORD_WEBHOOK_URL` |
| xBloom-sytem | root `.env` → `DISCORD_WEBHOOK_URL` |
| QSC-Sytem | `qsc-web/docker-compose.yml` env หรือ `.env` → `DISCORD_WEBHOOK` |

Path เดิมของแต่ละระบบ (ปุ่มแจ้งปัญหา → POST → บันทึก DB → notify) ไม่เปลี่ยนแปลง เปลี่ยนแค่ปลายทาง URL
