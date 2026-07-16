# issue-service

Central "แจ้งปัญหา" (report-issue) ingest service — Hono + TypeScript + SQLite
(`node:sqlite`, built-in, ไม่ต้องมี native dependency)

รับ `POST /api/issues` จากทั้ง 5 ระบบ (Bhlogisticssystem, PRsystem, lms-casa,
xBloom, QSC-Sytem) แทนที่แต่ละระบบจะมีตาราง `issues` + endpoint + Discord
webhook แยกกันเอง — **ระบบนี้แทนที่เฉพาะฝั่ง backend/API เท่านั้น** ปุ่ม/modal
ฝั่ง frontend ของแต่ละระบบยังใช้ template เดิม (React component หรือ PHP
partial) เปลี่ยนแค่ปลายทางที่มันยิง POST ไป

## Endpoints

### `POST /api/issues` — ไม่บังคับ auth (เหมือน endpoint เดิมของทุกระบบ)

```json
{
  "system": "xBloom",
  "description": "อธิบายปัญหาอย่างน้อย 5 ตัวอักษร",
  "page": "/coverage/ABC123",
  "reporterName": "สมชาย",
  "reporterRole": "staff"
}
```
- `system` ต้องเป็นหนึ่งใน `Bhlogisticssystem | PRsystem | lms-casa | xBloom | QSC-Sytem` (นิยามที่ `src/systems.ts`)
- `page`, `reporterName`, `reporterRole` ไม่บังคับ
- สำเร็จ → `201 { id, createdAt }`
- ผิด validation → `400 { error }`
- บันทึกลง SQLite (`data/issues.sqlite`, คอลัมน์ `source_system`) แล้วยิง Discord webhook ของระบบนั้นๆ (ถ้าตั้งค่าไว้ ไม่ตั้งไว้ก็ข้ามเงียบๆ ไม่ error)

### `GET /api/issues` — บังคับ header `X-Dashboard-Key`

Query params: `?limit=100` (default 100, สูงสุด 500), `?system=xBloom` (optional, กรองเฉพาะระบบเดียว)

```json
{ "issues": [ { "id": "12", "system": "xBloom", "description": "...", "page": "...", "reporterName": "...", "reporterRole": "...", "createdAt": "2026-07-16T04:20:31Z" } ] }
```

รูปแบบ response เหมือนกับที่แต่ละระบบเคย return ทุกประการ (แค่รวมทุกระบบไว้ที่เดียว) —
ทำให้ `issues-dashboard/backend/src/lib/sources.ts` เปลี่ยนแค่ base URL/key เดียว
มาชี้ที่ service นี้แทน 5 endpoint เดิมได้โดยไม่ต้องแก้ `aggregate.ts` เลย (ขั้นตอนนี้ยังไม่ได้ทำ — รอ step ถัดไป)

### `GET /api/health`

## Setup

```bash
cd issue-service
cp .env.example .env
# ตั้งค่า ALLOWED_ORIGINS, DASHBOARD_API_KEY, DISCORD_WEBHOOK_* ตามต้องการ
npm install
npm run dev   # http://localhost:4003
```

## Env vars

| ตัวแปร | จำเป็น | คำอธิบาย |
|---|---|---|
| `PORT` | ไม่ (default 4003) | port ที่ service รัน |
| `ALLOWED_ORIGINS` | ✅ | comma-separated origin ของ frontend ทุกระบบที่จะยิง POST ตรงมา (CORS allow-list) |
| `DASHBOARD_API_KEY` | ✅ | secret ที่ issues-dashboard ส่งมาใน header `X-Dashboard-Key` ตอนดึง GET |
| `DISCORD_WEBHOOK_BHLOGISTICSSYSTEM` | ไม่ | webhook แยกต่อระบบ ไม่ตั้งไว้ = ไม่แจ้งเตือน |
| `DISCORD_WEBHOOK_PRSYSTEM` | ไม่ | เช่นเดียวกัน |
| `DISCORD_WEBHOOK_LMSCASA` | ไม่ | เช่นเดียวกัน |
| `DISCORD_WEBHOOK_XBLOOM` | ไม่ | เช่นเดียวกัน |
| `DISCORD_WEBHOOK_QSCSYTEM` | ไม่ | เช่นเดียวกัน |

## สถานะ / ขั้นตอนถัดไป

ทำเสร็จแล้ว: **ตัว service กลาง** + **checklist เชื่อมต่อ frontend รายระบบ**
(ดู [FRONTEND_CHECKLIST.md](./FRONTEND_CHECKLIST.md)) — แต่ยังไม่ได้ลงมือแก้
frontend จริงสักระบบ 5 ระบบเดิมยังยิงไปที่ endpoint ของตัวเองเหมือนเดิม,
issues-dashboard ยังดึงจาก 5 ระบบแยกกันเหมือนเดิม ขั้นตอนถัดไป (ยังไม่ทำ):

1. ทำตาม [FRONTEND_CHECKLIST.md](./FRONTEND_CHECKLIST.md) ทีละระบบ (React+Hono 4 ระบบ, PHP 1 ระบบ)
2. สลับ `issues-dashboard/backend/src/lib/sources.ts` ให้ดึงจาก service นี้ที่เดียวแทน 5 endpoint เดิม
3. ทยอยปิด endpoint/ตาราง `issues` เดิมของแต่ละระบบหลังย้ายเสร็จ (ไม่ต้องรีบ ปล่อยคู่ขนานได้ระหว่างเปลี่ยนผ่าน)
