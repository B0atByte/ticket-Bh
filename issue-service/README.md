# issue-service

Central "แจ้งปัญหา" (report-issue) ingest service — Hono + TypeScript + SQLite
(`node:sqlite`, built-in, ไม่ต้องมี native dependency)

รับ `POST /api/issues` จากทั้ง 5 ระบบ (Bhlogisticssystem, PRsystem, lms-casa,
xBloom, QSC-Sytem) แทนที่แต่ละระบบจะมีตาราง `issues` + endpoint + Discord
webhook แยกกันเอง — **ระบบนี้แทนที่เฉพาะฝั่ง backend/API เท่านั้น** ปุ่ม/modal
ฝั่ง frontend ของแต่ละระบบยังใช้ template เดิม (React component หรือ PHP
partial) เปลี่ยนแค่ปลายทางที่มันยิง POST ไป

**ปุ่มแจ้งปัญหาต้องอยู่หลัง login เสมอ** — service นี้บังคับรับ `reporterId`/
`reporterName` เป็นข้อมูลจำเป็น (ไม่ใช่ optional เหมือนเวอร์ชันแรก) เพราะฉะนั้น
frontend ของแต่ละระบบต้องซ่อนปุ่มนี้ไว้หลัง auth ของตัวเอง แล้วส่งข้อมูลผู้ใช้ที่
login อยู่มาด้วยทุกครั้ง — ดู [FRONTEND_CHECKLIST.md](./FRONTEND_CHECKLIST.md)

## Endpoints

### `POST /api/issues` — ไม่บังคับ auth ระดับ service (แต่ frontend ต้องบังคับ login เอง)

`multipart/form-data` (ไม่ใช่ JSON แล้ว — เพื่อให้แนบไฟล์ในคำขอเดียวกันได้):

| field | บังคับ | คำอธิบาย |
|---|---|---|
| `system` | ✅ | หนึ่งใน `Bhlogisticssystem \| PRsystem \| lms-casa \| xBloom \| QSC-Sytem` |
| `description` | ✅ | อย่างน้อย 5 ตัวอักษร |
| `severity` | ✅ | หนึ่งใน `critical \| high \| normal` (🔴 ด่วนที่สุด / 🟡 ด่วน / 🟢 ทั่วไป — นิยามที่ `src/constants.ts`) |
| `reporterId` | ✅ | id ผู้ใช้ที่ login อยู่ในระบบต้นทาง (opaque string — ไม่ verify ค่านี้ ดูหัวข้อ Security ด้านล่าง) |
| `reporterName` | ✅ | ชื่อผู้แจ้ง |
| `reporterRole` | ไม่ | role ผู้แจ้ง |
| `page` | ไม่ | path ของหน้าที่เจอปัญหา |
| `attachment` | ไม่ | ไฟล์แนบ (ภาพหน้าจอ/PDF), สูงสุด 10MB, รองรับ PNG/JPEG/GIF/WEBP/PDF |

สำเร็จ → `201` คืน issue object เต็ม (ดูรูปแบบด้านล่าง) — สร้าง status
history เริ่มต้นเป็น `submitted` ให้อัตโนมัติ แล้วยิง Discord webhook ของระบบนั้นๆ
ถ้าตั้งค่าไว้ (ไม่ตั้งไว้ก็ข้ามเงียบๆ ไม่ error) — ผิด validation หรือไฟล์แนบไม่ผ่าน →
`400 { error }`

**Issue object** (รูปแบบที่ endpoint ทุกตัวคืนกลับ):
```json
{
  "id": "12", "system": "xBloom", "description": "...", "page": "...",
  "severity": "critical", "status": "acknowledged",
  "statusLabel": "รับเรื่องแล้ว", "statusEmoji": "🔵",
  "reporterId": "...", "reporterName": "...", "reporterRole": "...",
  "hasAttachment": true, "attachmentUrl": "/api/issues/12/attachment",
  "createdAt": "2026-07-16T04:20:31Z", "updatedAt": "2026-07-17T08:00:00Z"
}
```

### `GET /api/issues` — บังคับ header `X-Dashboard-Key` (admin/dashboard)

Query: `?limit=100` (สูงสุด 500), `?system=xBloom`, `?status=pending_user` (ทั้งหมด optional, กรองร่วมกันได้)
→ `{ "issues": [ <issue object>, ... ] }`

### `GET /api/issues/:id` — บังคับ `X-Dashboard-Key`
detail ของ issue เดียว พร้อม `history` เต็ม (ดูรูปแบบ history ด้านล่าง)

### `PATCH /api/issues/:id/status` — บังคับ `X-Dashboard-Key`
ให้แอดมินเปลี่ยนสถานะ — body `{ "status": "acknowledged", "note": "..." }` (`note` optional)
`status` ต้องเป็นหนึ่งใน `submitted | acknowledged | pending_user | resolved` —
เปลี่ยนได้ทุกทิศทาง ไม่บังคับลำดับ แต่ละครั้งจะถูกบันทึกลง status history
→ คืน issue object + `history` เต็ม

### `GET /api/issues/mine?system=xBloom&reporterId=user-42` — ให้ user ดูรายการของตัวเอง

ไม่บังคับ `X-Dashboard-Key` (เจตนา — ดูหัวข้อ Security) ต้องส่ง `system` +
`reporterId` ตรงกับตอนแจ้ง → คืน `{ "issues": [ <issue object + "history">, ... ] }`
เรียงจากใหม่ไปเก่า พร้อม timeline เต็มของแต่ละ issue:
```json
"history": [
  { "status": "submitted", "label": "ส่งเรื่องแล้ว", "emoji": "⚪", "note": null, "createdAt": "..." },
  { "status": "acknowledged", "label": "รับเรื่องแล้ว", "emoji": "🔵", "note": "กำลังตรวจสอบให้", "createdAt": "..." }
]
```

### `GET /api/issues/:id/attachment` — เปิดได้ 2 ทาง
1. แอดมิน: header `X-Dashboard-Key` ถูกต้อง, หรือ
2. เจ้าของ report เอง: query `?system=xBloom&reporterId=user-42` ตรงกับตอนแจ้ง

ไม่ตรงทั้งสองทาง → `401` ไม่มีไฟล์แนบสำหรับ issue นั้น → `404`

### `GET /api/health`

## Security model (สำคัญ — อ่านก่อนต่อระบบใหม่)

- `system`, `reporterId`, `reporterName`, `reporterRole` เป็น **input ที่ไม่ verify** —
  service นี้เชื่อค่าที่ frontend ส่งมาตรงๆ ไม่มีทางเช็คว่า JWT/session ของระบบต้นทาง
  ถูกต้องจริงไหม (คนละ secret กัน 5 ระบบ) เพราะงั้น "บังคับ login" ที่แท้จริงต้องเกิด
  ที่ frontend ของแต่ละระบบเอง — service นี้แค่บังคับว่า field พวกนี้ห้ามว่าง (reject ถ้า
  ไม่มี) แต่ไม่ได้ยืนยันตัวตนอะไรเพิ่มเติม
- `GET /mine` และ `GET /:id/attachment` (แบบ owner) ใช้หลักการเดียวกัน: ใครก็ตามที่รู้
  `system` + `reporterId` ที่ถูกต้อง (ปกติควรมีแค่เจ้าของ/ระบบต้นทางเท่านั้นที่รู้) จะดูได้
  — เป็น soft-trust ระดับเดียวกับ POST ไม่ใช่ hardened auth ถ้าต้องการความปลอดภัยสูงกว่านี้
  (เช่น เดา reporterId ไม่ได้ง่ายๆ) แนะนำให้แต่ละระบบใช้ opaque id (เช่น UUID ภายใน หรือ
  hash) แทนอีเมล/username ตรงๆ

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
| `DASHBOARD_API_KEY` | ✅ | secret สำหรับ endpoint ฝั่งแอดมินทั้งหมด (`GET /api/issues`, `GET /api/issues/:id`, `PATCH .../status`, และ `X-Dashboard-Key` ทางเลือกของ attachment) |
| `DISCORD_WEBHOOK_BHLOGISTICSSYSTEM` | ไม่ | webhook แยกต่อระบบ ไม่ตั้งไว้ = ไม่แจ้งเตือน |
| `DISCORD_WEBHOOK_PRSYSTEM` | ไม่ | เช่นเดียวกัน |
| `DISCORD_WEBHOOK_LMSCASA` | ไม่ | เช่นเดียวกัน |
| `DISCORD_WEBHOOK_XBLOOM` | ไม่ | เช่นเดียวกัน |
| `DISCORD_WEBHOOK_QSCSYTEM` | ไม่ | เช่นเดียวกัน |

ไฟล์แนบเก็บที่ `data/uploads/` (gitignored เหมือน `data/issues.sqlite`) ไม่ผ่าน env var ใดๆ

## สถานะ / ขั้นตอนถัดไป

ทำเสร็จแล้ว: **ตัว service กลาง** (severity + สถานะ/timeline + ไฟล์แนบ + endpoint
ฝั่งแอดมิน) + **ทั้ง 5 ระบบต่อเข้ากับ service นี้จริงแล้ว** (ดู
[FRONTEND_CHECKLIST.md](./FRONTEND_CHECKLIST.md) สำหรับรายละเอียดต่อระบบ) —
ปุ่ม "แจ้งปัญหา" ทุกระบบตอนนี้อยู่หลัง login, มี severity picker + ช่องแนบไฟล์,
และยิง POST ไปที่ service นี้โดยตรงแล้ว ทดสอบ end-to-end ผ่านจริงทั้ง 5 ระบบ
(login → เลือกระดับความเร่งด่วน → ส่ง → ยืนยันข้อมูลกลับมาถูกต้องที่ `GET
/api/issues` รวมถึงไฟล์แนบ)

ขั้นตอนถัดไป (ยังไม่ทำ):

1. ทำหน้า/ปุ่ม "ประวัติการแจ้งปัญหา" ฝั่ง user (เรียก `GET /mine`) — ยังไม่ได้ออกแบบ UI ส่วนนี้ แค่ backend พร้อมแล้ว
2. ทำหน้าแอดมินเปลี่ยนสถานะ (เรียก `PATCH .../status`) — อาจต่อยอดจาก `issues-dashboard` ที่มี UI อยู่แล้ว แทนที่จะสร้างหน้าใหม่
3. สลับ `issues-dashboard/backend/src/lib/sources.ts` ให้ดึงจาก service นี้ที่เดียวแทน 5 endpoint เดิม (ตอนนี้ dashboard ยังดึงจาก 5 ระบบเดิมที่ไม่มี severity/status ใหม่นี้)
4. ทยอยปิด endpoint/ตาราง `issues` เดิมของแต่ละระบบหลังย้ายเสร็จ (ไม่ต้องรีบ ปล่อยคู่ขนานได้ระหว่างเปลี่ยนผ่าน — ตอนนี้ยังไม่ปิด)
