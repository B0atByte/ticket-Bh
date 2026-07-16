# Frontend wiring checklist — ต่อปุ่ม "แจ้งปัญหา" เข้ากับ issue-service กลาง

เป้าหมาย: เปลี่ยนแค่ **ปลายทางที่ปุ่มยิง POST ไป** จาก backend ของระบบตัวเองมาที่
`issue-service` (http://localhost:4003 ตอน dev) — UI/component เดิมไม่ต้องแก้ดีไซน์
อะไรทั้งสิ้น

ยังไม่ได้แก้ frontend จริงๆ สักระบบ — เอกสารนี้คือ checklist ให้ทำตามทีละระบบ

## กฎร่วมที่ใช้กับทุกระบบ (อ่านก่อนเริ่ม)

### 1. ห้ามใช้ api client เดิมของระบบยิงไป issue-service
ทุกระบบ (ยกเว้น QSC ที่เป็น PHP) มี shared `api` client ที่แนบ auth token ของ
ระบบตัวเองอัตโนมัติทุก request:

| ระบบ | ไฟล์ | สิ่งที่แนบอัตโนมัติ |
|---|---|---|
| Bhlogisticssystem | `frontend/src/lib/api.ts:75-76` | `Authorization: Bearer <accessToken>` |
| PRsystem | `app/src/lib/api.ts:13` | `Authorization: Bearer <token จาก localStorage>` |
| lms-casa | `client/src/lib/api.ts:14` | `withCredentials: true` (ส่ง httpOnly cookie อัตโนมัติ) |
| xBloom-sytem | `frontend/src/lib/api.ts:19` | `Authorization: Bearer <authToken>` (ถ้ามี) |

ถ้าเผลอใช้ client ตัวเดิมยิงไป issue-service (คนละ origin) จะเป็นการส่ง
**session token ของระบบนั้นไปให้ third-party service เห็น** — ต้องสร้าง fetch
เปล่าๆ แยกต่างหากเฉพาะสำหรับเรียก issue-service เท่านั้น ห้าม import `api`
client เดิมมาใช้กับ endpoint นี้

### 2. ต้องส่ง `system` มาด้วยทุกครั้ง (เดิมไม่มี field นี้)
ค่าต้องตรงกับ `SYSTEMS` ใน `issue-service/src/systems.ts` เป๊ะๆ:
`"Bhlogisticssystem" | "PRsystem" | "lms-casa" | "xBloom" | "QSC-Sytem"`

### 3. `reporterName`/`reporterRole` — พฤติกรรมเปลี่ยน ต้องส่งเองจาก client แล้ว
ปัจจุบันทุกระบบ (รวม QSC) ให้ **backend** เติมชื่อ/role ให้อัตโนมัติจาก
session/JWT ฝั่งเซิร์ฟเวอร์ (ดูใน `issues.ts`/`report_issue.php` เดิมของแต่ละระบบ
— `c.get('user')` หรือ `current_user()`) เพราะ browser ไม่เคยต้องส่งข้อมูลนี้เอง

พอเปลี่ยนไปยิง cross-origin ตรงไปที่ issue-service ตรงๆ **service กลางไม่รู้จัก
session ของระบบต้นทางเลย** — ถ้าไม่แก้ ทุก report จะกลายเป็น "ไม่ระบุ" หมด
ต้องดึงชื่อ/role จาก auth state ที่ frontend มีอยู่แล้ว (เช่น context/store ที่ใช้
แสดงชื่อผู้ใช้ใน topbar) แล้วใส่ในตัว payload เอง — ไม่บังคับส่ง (ระบบยังใช้งานได้
ถ้าไม่ login) แต่ถ้า login อยู่ควรส่งเพื่อไม่ให้เสียฟีเจอร์เดิม

### 4. ตั้งค่า origin ของทุกระบบใน `issue-service`
`issue-service/.env` → `ALLOWED_ORIGINS` ต้องมี origin ของทุกระบบที่จะยิงมา
(dev ports: `5173` Bhlogistics, `5174` PRsystem, `5175` lms-casa, `5176` xBloom,
`8083` QSC) — ค่า default ใน `.env.example` มีครบอยู่แล้ว แค่เติม production
domain เพิ่มตอน deploy จริง

### 5. GET เดิมของแต่ละระบบยังไม่ต้องปิด
`issues-dashboard` ยังดึงจาก 5 endpoint เดิมอยู่ (ยังไม่ได้สลับ — เป็น step ถัดไป
คนละ step) เพราะงั้นตาราง `issues` เดิมของแต่ละระบบต้องยังอยู่และ endpoint GET
เดิมต้องยังทำงานได้ปกติระหว่างช่วงเปลี่ยนผ่าน — งานนี้แค่เปลี่ยนปลายทางของ **ปุ่ม
POST** เท่านั้น ไม่ใช่ตัด GET ทิ้ง

---

## Bhlogisticssystem

**ไฟล์:** `Bhlogisticssystem/frontend/src/components/ReportButton.tsx`

ปัจจุบัน (บรรทัด ~26):
```ts
await api.post('/issues', {
  description: description.trim(),
  page: window.location.pathname,
})
```

เปลี่ยนเป็น (fetch เปล่า ไม่ใช้ `api` client เดิม):
```ts
await fetch(`${import.meta.env.VITE_ISSUE_SERVICE_URL}/api/issues`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    system: 'Bhlogisticssystem',
    description: description.trim(),
    page: window.location.pathname,
    reporterName: currentUser?.name,   // ดึงจาก auth context ที่มีอยู่แล้ว
    reporterRole: currentUser?.role,
  }),
})
```
- เพิ่ม `VITE_ISSUE_SERVICE_URL=http://localhost:4003` ใน `frontend/.env` (สร้างถ้ายังไม่มี)
- ต้อง import/ดึง current user object เข้ามาใน component นี้เพิ่ม (เดิมไม่ได้ใช้)
- error handling เดิม (try/catch, toast) ใช้ต่อได้เลย ไม่ต้องแก้

## PRsystem

**ไฟล์:** `PRsystem/app/src/App.tsx` — **มี 2 จุด** (บรรทัด ~4197 และปุ่มซ้ำอีกจุดราว
บรรทัด ~4300s ดูเหมือนเป็น component คนละ role แต่โค้ดซ้ำกัน เช็คทั้งคู่)

ปัจจุบัน:
```ts
await api.issues.create({ description: reportDesc.trim(), page });
```

เปลี่ยนเป็น (ไม่ใช้ `api.issues.create` เดิมที่แนบ Bearer token):
```ts
await fetch(`${import.meta.env.VITE_ISSUE_SERVICE_URL}/api/issues`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    system: 'PRsystem',
    description: reportDesc.trim(),
    page,
    reporterName: currentUser?.name,
    reporterRole: currentUser?.role,
  }),
});
```
- เพิ่ม `VITE_ISSUE_SERVICE_URL=http://localhost:4003` ใน `app/.env`
- พิจารณาทำเป็น helper function เดียว (เช่น `reportIssueToCentral()`) ใช้ร่วมกัน
  2 จุด แทนก็อปโค้ดซ้ำ — แก้ตอนนี้เลยจะดีกว่า เพราะจุดเดิมก็ซ้ำกันอยู่แล้ว
- `api.issues.create` เดิมใน `lib/api.ts:94` ปล่อยไว้เฉยๆ ก่อนได้ (ยังใช้ backend
  เดิม endpoint `/api/issues` POST ของ PRsystem เอง — แค่ไม่มีใครเรียกใช้แล้ว)

## lms-casa

**ไฟล์:** `lms-casa/client/src/features/issues/issues.api.ts`

ปัจจุบัน:
```ts
import { api } from '../../lib/api';

export function createIssue(input: { description: string; page?: string }): Promise<void> {
  return api.post('/issues', input);
}
```

เปลี่ยนเป็น (ห้ามใช้ `api` axios instance เดิม เพราะมี `withCredentials: true` —
ยิง cross-origin แบบนั้นจะพยายามส่ง httpOnly cookie ของ lms-casa ออกไปด้วย และ
จะ fail preflight เพราะ issue-service ไม่ได้เปิด `Access-Control-Allow-Credentials`):
```ts
export function createIssue(input: {
  description: string
  page?: string
  reporterName?: string
  reporterRole?: string
}): Promise<void> {
  return fetch(`${import.meta.env.VITE_ISSUE_SERVICE_URL}/api/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: 'lms-casa', ...input }),
  }).then((res) => {
    if (!res.ok) throw new Error('report failed')
  })
}
```
- เพิ่ม `VITE_ISSUE_SERVICE_URL=http://localhost:4003` ใน `client/.env`
- `ReportIssueButton.tsx` ต้องส่ง `reporterName`/`reporterRole` เข้ามาตอนเรียก
  `createIssue(...)` ด้วย (ดึงจาก auth store ที่มีอยู่แล้ว เช่น `useAuth().user`)
- `getApiErrorMessage(err, ...)` ที่ใช้ตอน `onError` เดิมออกแบบมาสำหรับ axios
  error shape — เช็คว่ายังใช้ได้กับ error จาก `fetch` เปล่าไหม (อาจต้อง throw
  เป็น shape ที่ `getApiErrorMessage` เข้าใจ หรือปรับ `onError` เฉพาะจุดนี้)

## xBloom-sytem

**ไฟล์:** `xBloom-sytem/frontend/src/lib/api.ts` (บรรทัด ~281)

ปัจจุบัน:
```ts
reportIssue: (b: { description: string; page?: string }) =>
  req<{ id: number }>("/issues", { method: "POST", body: JSON.stringify(b) }),
```
`req()` ใช้ `headers()` ซึ่งแนบ `Authorization` อัตโนมัติถ้า login อยู่ — **ห้ามใช้
`req()` เดิมกับ endpoint นี้**

เปลี่ยนเป็น (เขียนแยกจาก `req()` เดิม ไม่ผ่าน `headers()`):
```ts
reportIssue: (b: { description: string; page?: string; reporterName?: string; reporterRole?: string }) =>
  fetch(`${import.meta.env.VITE_ISSUE_SERVICE_URL}/api/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system: "xBloom", ...b }),
  }).then(async (res) => {
    if (!res.ok) throw new ApiError(res.status, "ส่งแจ้งปัญหาไม่สำเร็จ");
    return res.json() as Promise<{ id: number }>;
  }),
```
- เพิ่ม `VITE_ISSUE_SERVICE_URL=/issue-api` หรือ URL ตรงๆ ใน `.env.local` —
  **ระวังบั๊กแบบที่เพิ่งเจอ**: ถ้าจะ proxy ผ่าน `vite.config.ts` เหมือน `/api` เดิม
  ต้องเพิ่ม path ใหม่ในนั้นด้วย (`VITE_PROXY_TARGET` เดิมชี้ backend ของ xBloom
  เอง คนละตัวกับ issue-service) — จะตรงไปที่ issue-service ตรงๆ แบบ Bhlogistics/
  PRsystem/lms-casa เลยก็ได้ ไม่ต้องผ่าน proxy ก็ได้ เพราะ issue-service เปิด
  CORS ให้แล้ว
- `ReportBugButton.tsx` ต้องส่ง `reporterName`/`reporterRole` เพิ่มตอนเรียก
  `api.reportIssue(...)`

## QSC-Sytem (PHP — ไม่มี Vite/build step)

**ไฟล์:** `QSC-Sytem/qsc-web/partials/report_button.php` (ฟังก์ชัน JS
`submitReportIssue()`)

ปัจจุบัน:
```js
const res = await fetch('report_issue.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ description, page: location.pathname }),
});
```

เปลี่ยนเป็น — PHP รู้จัก user อยู่แล้วตอน render (session) เลย embed ชื่อ/role
เข้าไปใน JS ตรงๆ ได้เลย ไม่ต้อง fetch เพิ่ม:
```php
<script>
const ISSUE_SERVICE_URL = <?= json_encode(getenv('ISSUE_SERVICE_URL') ?: 'http://localhost:4003') ?>;
const CURRENT_USER = <?= json_encode(is_logged_in() ? [
  'name' => current_user()['full_name'] ?? current_user()['username'],
  'role' => current_user()['role'],
] : null) ?>;
</script>
```
```js
const res = await fetch(`${ISSUE_SERVICE_URL}/api/issues`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    system: 'QSC-Sytem',
    description,
    page: location.pathname,
    reporterName: CURRENT_USER?.name,
    reporterRole: CURRENT_USER?.role,
  }),
});
```
- default fetch ไม่ส่ง cookie ข้าม origin เองอยู่แล้ว (ไม่ได้ใส่
  `credentials: 'include'`) เพราะงั้น QSC ไม่มีความเสี่ยงหลุด session cookie
  แบบ 4 ระบบข้างบน — ไม่ต้องระวังเรื่องนี้เป็นพิเศษ
- เพิ่ม `ISSUE_SERVICE_URL` เป็น env var ใน `docker-compose.yml` ของ QSC
- เช็คว่ามีฟังก์ชัน `is_logged_in()` อยู่ใน `auth.php` จริงไหม (ถ้าไม่มีใช้เงื่อนไข
  ที่มีอยู่แล้วแทน เช่นเช็ค `current_user()` คืน null หรือไม่)

---

## หลัง Deploy ทีละระบบ — วิธีเช็คว่าเชื่อมถูก

```bash
curl http://localhost:4003/api/issues -H "X-Dashboard-Key: <DASHBOARD_API_KEY>"
```
ต้องเห็น issue ใหม่โผล่มาพร้อม `system` ตรงกับระบบที่เพิ่งทดสอบส่ง และ
`reporterName`/`reporterRole` ไม่เป็น `null` ถ้าตอนทดสอบ login อยู่
