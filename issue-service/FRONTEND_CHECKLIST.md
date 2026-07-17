# Frontend wiring checklist — ต่อปุ่ม "แจ้งปัญหา" เข้ากับ issue-service กลาง

เป้าหมาย: เปลี่ยนแค่ **ปลายทางที่ปุ่มยิง POST ไป** จาก backend ของระบบตัวเองมาที่
`issue-service` (http://localhost:4003 ตอน dev) — UI/component เดิมไม่ต้องแก้ดีไซน์
พื้นฐานอะไรทั้งสิ้น **ยกเว้น 2 อย่างที่ต้องเพิ่มเข้าไปจริงตาม spec ใหม่:**
severity picker (ปุ่มเลือกความเร่งด่วน) และช่องแนบไฟล์ — เพราะ service ฝั่ง
backend บังคับรับ 2 อย่างนี้แล้ว (severity บังคับ, ไฟล์แนบไม่บังคับแต่ต้องมีช่องให้แนบได้)

ยังไม่ได้แก้ frontend จริงๆ สักระบบ — เอกสารนี้คือ checklist ให้ทำตามทีละระบบ

## กฎร่วมที่ใช้กับทุกระบบ (อ่านก่อนเริ่ม)

### 1. ปุ่มต้องอยู่หลัง login เสมอ (เปลี่ยนจากเดิม)
เดิมทุกระบบ (รวม QSC) ให้แจ้งปัญหาได้แม้ไม่ login — **ตอนนี้เปลี่ยนแล้ว**:
`issue-service` บังคับรับ `reporterId`/`reporterName` เป็น field จำเป็น (ไม่ใช่
optional) ถ้าไม่มีคน login อยู่ ก็ไม่มีค่าอะไรจะส่งให้ field นี้ — เพราะงั้น:
- **Bhlogisticssystem, PRsystem, lms-casa** — ตอนนี้ปุ่มโชว์อยู่แม้ยังไม่ login
  (ยืนยันแล้วตอนทดสอบ e2e) ต้องซ่อนปุ่มนี้ไว้จนกว่าจะ login เสร็จ
- **xBloom, QSC-Sytem** — เดิม README เขียนว่า "หลังจาก login" อยู่แล้ว แต่โค้ดจริง
  ก็ยังไม่บังคับ (README เขียนไว้แต่ logic ไม่เช็ค) ต้องเพิ่ม logic บังคับจริง

วิธีทำ: wrap component เดิมด้วยเงื่อนไข `if (!currentUser) return null` (หรือ
เทียบเท่าตาม pattern auth ของแต่ละระบบ) ก่อน render ปุ่ม

### 2. ห้ามใช้ api client เดิมของระบบยิงไป issue-service
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

### 3. POST เป็น `multipart/form-data` แล้ว ไม่ใช่ JSON
เพื่อให้แนบไฟล์ในคำขอเดียวกันได้ — ใช้ `FormData` ไม่ใช่ `JSON.stringify` และ
**ห้ามตั้ง header `Content-Type` เอง** (browser ต้องเป็นคนใส่ boundary ให้อัตโนมัติ
ถ้าตั้งเองจะพัง) ฟิลด์ที่ต้องส่งตอนนี้ (ทั้งหมดยกเว้น `page`/`reporterRole`/
`attachment` บังคับหมด):

```js
const fd = new FormData()
fd.set('system', 'xBloom')                    // ชื่อระบบตัวเองตรงตาม SYSTEMS enum
fd.set('description', description.trim())
fd.set('severity', selectedSeverity)           // 'critical' | 'high' | 'normal' — บังคับ
fd.set('reporterId', currentUser.id)           // บังคับ — ดึงจาก auth state
fd.set('reporterName', currentUser.name)       // บังคับ
fd.set('reporterRole', currentUser.role ?? '') // ไม่บังคับ
fd.set('page', location.pathname)              // ไม่บังคับ
if (file) fd.set('attachment', file)           // ไม่บังคับ — ดู field name ต้องชื่อ 'attachment' เป๊ะๆ

await fetch(`${ISSUE_SERVICE_URL}/api/issues`, { method: 'POST', body: fd })
```

### 4. ต้องเพิ่ม Severity picker ในฟอร์ม (UI ใหม่)
ปุ่มเลือก 3 ระดับ เห็นเด่นชัด ไม่ใช่ dropdown ซ่อน — ใช้ label/สี/emoji นี้ให้ตรงกับที่
`issue-service` ส่งกลับมา (จะได้ตรงกับที่ admin เห็นใน Discord/dashboard):

| value | emoji | label | คำอธิบายสั้นๆ ที่ควรโชว์ |
|---|---|---|---|
| `critical` | 🔴 | ด่วนที่สุด | ระบบพังถาวร ทำงานต่อไม่ได้เลย (login ไม่ได้, จ่ายเงินไม่ได้) |
| `high` | 🟡 | ด่วน | ระบบทำงานได้บางส่วน แต่กระทบงานหลัก (พิมพ์ใบเสร็จไม่ได้) |
| `normal` | 🟢 | ทั่วไป | ปัญหาทั่วไป/ข้อเสนอแนะ (สะกดผิด, ปุ่มเบี้ยว) |

### 5. ช่องแนบไฟล์ (ไม่บังคับ แต่ต้องมีให้เลือก)
`<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf">`
— จำกัด client-side ไว้ก่อนก็ได้ (สูงสุด 10MB, ชนิดไฟล์ตามด้านบน) แต่ตัว service
เองก็ validate ซ้ำอยู่แล้ว (reject ด้วย `400` ถ้าไม่ผ่าน) ไม่ต้องเชื่อ client
ฝ่ายเดียว

### 6. `reporterId` คืออะไร
เป็น string อะไรก็ได้ที่ระบบต้นทางใช้ระบุตัวผู้ใช้แบบ **คงที่ไม่เปลี่ยนไปมา** (ใช้
join กับ `system` เป็น compound key ตอนดึง "ประวัติของฉัน") ปกติใช้ user id ภายใน
ระบบ (เช่น Prisma `id`/cuid) ไม่แนะนำใช้ email ตรงๆ เพราะเดางกกว่า — ดูหัวข้อ
Security ใน README

### 7. GET เดิมของแต่ละระบบยังไม่ต้องปิด
`issues-dashboard` ยังดึงจาก 5 endpoint เดิมอยู่ (ยังไม่ได้สลับ — เป็น step ถัดไป
คนละ step) เพราะงั้นตาราง `issues` เดิมของแต่ละระบบต้องยังอยู่และ endpoint GET
เดิมต้องยังทำงานได้ปกติระหว่างช่วงเปลี่ยนผ่าน — งานนี้แค่เปลี่ยนปลายทางของ **ปุ่ม
POST** เท่านั้น ไม่ใช่ตัด GET ทิ้ง

### 8. "ประวัติการแจ้งปัญหา" (tracking) — ยังไม่ได้ออกแบบ UI ส่วนนี้
Backend พร้อมแล้ว (`GET /api/issues/mine?system=...&reporterId=...` คืน
รายการ + timeline สถานะเต็มของแต่ละ issue) แต่ยังไม่มี component/หน้าจอ
ฝั่ง frontend ระบบไหนเรียกใช้ endpoint นี้เลย — เป็นงานแยกต่างหาก ยังไม่อยู่ใน
checklist ทดสอบขั้นต่ำรอบนี้ (แค่ต่อปุ่มส่งให้ผ่านก่อน)

---

## Bhlogisticssystem

**ไฟล์:** `Bhlogisticssystem/frontend/src/components/ReportButton.tsx` — mount
ที่ `App.tsx:41` แบบไม่มีเงื่อนไข login เลย ต้องเพิ่ม guard ก่อน (ดูข้อ 1)

ปัจจุบัน (บรรทัด ~26):
```ts
await api.post('/issues', {
  description: description.trim(),
  page: window.location.pathname,
})
```

เปลี่ยนเป็น (fetch เปล่า + FormData, ไม่ใช้ `api` client เดิม):
```ts
const fd = new FormData()
fd.set('system', 'Bhlogisticssystem')
fd.set('description', description.trim())
fd.set('severity', severity) // จาก state ของ severity picker ที่เพิ่มใหม่
fd.set('reporterId', currentUser.id)
fd.set('reporterName', currentUser.name)
if (currentUser.role) fd.set('reporterRole', currentUser.role)
fd.set('page', window.location.pathname)
if (file) fd.set('attachment', file)

await fetch(`${import.meta.env.VITE_ISSUE_SERVICE_URL}/api/issues`, { method: 'POST', body: fd })
```
- เพิ่ม `VITE_ISSUE_SERVICE_URL=http://localhost:4003` ใน `frontend/.env`
- ต้อง import current user object เข้ามาใน component นี้เพิ่ม (เดิมไม่ได้ใช้)
- เพิ่ม severity picker UI + `<input type="file">` ในตัว modal เดิม
- ต้องเพิ่ม guard `if (!currentUser) return null` ก่อน render ปุ่ม (ตอนนี้โชว์แม้ยังไม่ login)
- error handling เดิม (try/catch, toast) ใช้ต่อได้เลย ไม่ต้องแก้

## PRsystem

**ไฟล์:** `PRsystem/app/src/App.tsx` — **มี 2 จุด** (บรรทัด ~4197 และปุ่มซ้ำอีกจุดราว
บรรทัด ~4300s) ทั้งสองจุดโชว์ปุ่มแม้ยังไม่ login (login page อยู่ใน render tree เดียวกัน)

ปัจจุบัน:
```ts
await api.issues.create({ description: reportDesc.trim(), page });
```

เปลี่ยนเป็น (ไม่ใช้ `api.issues.create` เดิมที่แนบ Bearer token):
```ts
const fd = new FormData();
fd.set('system', 'PRsystem');
fd.set('description', reportDesc.trim());
fd.set('severity', reportSeverity);
fd.set('reporterId', currentUser.id);
fd.set('reporterName', currentUser.name);
if (currentUser.role) fd.set('reporterRole', currentUser.role);
fd.set('page', page);
if (reportFile) fd.set('attachment', reportFile);

await fetch(`${import.meta.env.VITE_ISSUE_SERVICE_URL}/api/issues`, { method: 'POST', body: fd });
```
- เพิ่ม `VITE_ISSUE_SERVICE_URL=http://localhost:4003` ใน `app/.env`
- ทำเป็น helper function เดียว (เช่น `reportIssueToCentral()`) ใช้ร่วมกัน 2 จุด
  แทนก็อปโค้ดซ้ำ — ควรทำตอนนี้เลยเพราะต้องเพิ่ม severity+file state ทั้งคู่อยู่แล้ว
- ต้องเพิ่ม guard ไม่ให้ทั้ง 2 จุด render ตอนยังไม่ login (ตอนนี้ไม่มี guard เลย)
- `api.issues.create` เดิมใน `lib/api.ts:94` ปล่อยไว้เฉยๆ ก่อนได้ (ยังใช้ backend
  เดิม endpoint `/api/issues` POST ของ PRsystem เอง — แค่ไม่มีใครเรียกใช้แล้ว)

## lms-casa

**ไฟล์:** `lms-casa/client/src/features/issues/issues.api.ts` + `ReportIssueButton.tsx`
— mount ที่ `App.tsx:72` นอก `<Routes>` เลยโชว์ทุกหน้ารวม `/login`

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
  severity: 'critical' | 'high' | 'normal'
  reporterId: string
  reporterName: string
  reporterRole?: string
  page?: string
  attachment?: File
}): Promise<void> {
  const fd = new FormData()
  fd.set('system', 'lms-casa')
  fd.set('description', input.description)
  fd.set('severity', input.severity)
  fd.set('reporterId', input.reporterId)
  fd.set('reporterName', input.reporterName)
  if (input.reporterRole) fd.set('reporterRole', input.reporterRole)
  if (input.page) fd.set('page', input.page)
  if (input.attachment) fd.set('attachment', input.attachment)

  return fetch(`${import.meta.env.VITE_ISSUE_SERVICE_URL}/api/issues`, { method: 'POST', body: fd })
    .then((res) => { if (!res.ok) throw new Error('report failed') })
}
```
- เพิ่ม `VITE_ISSUE_SERVICE_URL=http://localhost:4003` ใน `client/.env`
- `ReportIssueButton.tsx` ต้องส่ง `reporterId`/`reporterName`/`reporterRole`
  (ดึงจาก auth store ที่มีอยู่แล้ว เช่น `useAuth().user`) + severity picker + file input ใหม่
- ต้องเพิ่ม guard ไม่ให้ปุ่ม render ตอนยังไม่ login (ย้ายจากนอก `<Routes>` เข้าไปในเลย์เอาต์ที่มีแค่ authenticated routes หรือเช็ค `useAuth().user` ก่อน render)
- `getApiErrorMessage(err, ...)` ที่ใช้ตอน `onError` เดิมออกแบบมาสำหรับ axios
  error shape — เช็คว่ายังใช้ได้กับ error จาก `fetch` เปล่าไหม (อาจต้อง throw
  เป็น shape ที่ `getApiErrorMessage` เข้าใจ หรือปรับ `onError` เฉพาะจุดนี้)

## xBloom-sytem

**ไฟล์:** `xBloom-sytem/frontend/src/lib/api.ts` (บรรทัด ~281) + `ReportBugButton.tsx`

ปัจจุบัน:
```ts
reportIssue: (b: { description: string; page?: string }) =>
  req<{ id: number }>("/issues", { method: "POST", body: JSON.stringify(b) }),
```
`req()` ใช้ `headers()` ซึ่งแนบ `Authorization` อัตโนมัติถ้า login อยู่ — **ห้ามใช้
`req()` เดิมกับ endpoint นี้**

เปลี่ยนเป็น (เขียนแยกจาก `req()` เดิม ไม่ผ่าน `headers()`, และเป็น multipart แทน JSON):
```ts
reportIssue: (b: {
  description: string
  severity: "critical" | "high" | "normal"
  reporterId: string
  reporterName: string
  reporterRole?: string
  page?: string
  attachment?: File
}) => {
  const fd = new FormData()
  fd.set("system", "xBloom")
  fd.set("description", b.description)
  fd.set("severity", b.severity)
  fd.set("reporterId", b.reporterId)
  fd.set("reporterName", b.reporterName)
  if (b.reporterRole) fd.set("reporterRole", b.reporterRole)
  if (b.page) fd.set("page", b.page)
  if (b.attachment) fd.set("attachment", b.attachment)

  return fetch(`${import.meta.env.VITE_ISSUE_SERVICE_URL}/api/issues`, { method: "POST", body: fd })
    .then(async (res) => {
      if (!res.ok) throw new ApiError(res.status, "ส่งแจ้งปัญหาไม่สำเร็จ");
      return res.json() as Promise<{ id: string }>;
    });
},
```
- เพิ่ม `VITE_ISSUE_SERVICE_URL=http://localhost:4003` ใน `.env.local` — ยิงตรง
  ไป issue-service เลยได้ ไม่ต้องผ่าน `vite.config.ts` proxy เหมือน `/api` เดิม
  (คนละ target กัน อย่าเผลอเอาไปรวมกับ `VITE_PROXY_TARGET` เดิมที่ชี้ backend
  ของ xBloom เอง — จุดนี้เพิ่งเป็นบั๊กมาแล้วรอบนึง ระวังซ้ำ)
- `ReportBugButton.tsx` ต้องส่ง `reporterId`/`reporterName`/`reporterRole` + severity picker + file input
- README ของ xBloom เขียนไว้ว่า "หลังจาก login" แต่โค้ดจริงไม่เคยเช็ค — ต้องเพิ่ม guard จริง

## QSC-Sytem (PHP — ไม่มี Vite/build step)

**ไฟล์:** `QSC-Sytem/qsc-web/partials/report_button.php` (ฟังก์ชัน JS
`submitReportIssue()`) — README เขียนว่าอยู่หลัง login แต่ต้องเช็ค `report_issue.php`
ว่า reject anonymous จริงไหม (ตอนนี้ยอมรับแม้ไม่มี session)

ปัจจุบัน:
```js
const res = await fetch('report_issue.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ description, page: location.pathname }),
});
```

เปลี่ยนเป็น — PHP รู้จัก user อยู่แล้วตอน render (session) เลย embed เข้าไปใน JS
ตรงๆ ได้เลย ไม่ต้อง fetch เพิ่ม เปลี่ยนเป็น multipart ด้วย `FormData` (รองรับไฟล์แนบ):
```php
<script>
const ISSUE_SERVICE_URL = <?= json_encode(getenv('ISSUE_SERVICE_URL') ?: 'http://localhost:4003') ?>;
const CURRENT_USER = <?= json_encode([
  'id' => $user['id'] ?? $user['username'],
  'name' => $user['full_name'] ?? $user['username'],
  'role' => $user['role'],
]) ?>; // report_button.php ถูก include เฉพาะหลัง login อยู่แล้ว (require_login_page()) — ไม่ต้องเช็ค null
</script>
```
```js
async function submitReportIssue() {
  const description = el.value.trim();
  if (description.length < 5) { toast('กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร', 'alert-triangle'); return; }

  const fd = new FormData();
  fd.set('system', 'QSC-Sytem');
  fd.set('description', description);
  fd.set('severity', selectedSeverity); // จาก severity picker ใหม่ในโมดัล
  fd.set('reporterId', CURRENT_USER.id);
  fd.set('reporterName', CURRENT_USER.name);
  fd.set('reporterRole', CURRENT_USER.role);
  fd.set('page', location.pathname);
  if (fileInput.files[0]) fd.set('attachment', fileInput.files[0]);

  const res = await fetch(`${ISSUE_SERVICE_URL}/api/issues`, { method: 'POST', body: fd });
  // ... จัดการ response เหมือนเดิม
}
```
- default fetch ไม่ส่ง cookie ข้าม origin เองอยู่แล้ว (ไม่ได้ใส่
  `credentials: 'include'`) เพราะงั้น QSC ไม่มีความเสี่ยงหลุด session cookie
  แบบ 4 ระบบข้างบน — ไม่ต้องระวังเรื่องนี้เป็นพิเศษ
- เพิ่ม `ISSUE_SERVICE_URL` เป็น env var ใน `docker-compose.yml` ของ QSC
- เพิ่ม severity picker (radio/badge) + `<input type="file">` ในโมดัลเดิม
- ทุกหน้าที่ include `report_button.php` (index/dashboard/admin) ล้วนผ่าน
  `require_login_page()` มาก่อนแล้วอยู่แล้ว — ดังนั้น QSC ข้อ 1 (บังคับ login)
  ผ่านอัตโนมัติ ไม่ต้องเพิ่ม guard อะไรเพิ่ม

---

## หลัง Deploy ทีละระบบ — วิธีเช็คว่าเชื่อมถูก

```bash
# ยืนยัน issue ใหม่โผล่มาพร้อม system/severity/reporterId ถูกต้อง
curl "http://localhost:4003/api/issues?limit=1" -H "X-Dashboard-Key: <DASHBOARD_API_KEY>"

# ยืนยันฝั่ง user เห็นประวัติของตัวเอง (ใช้ reporterId ที่เพิ่งทดสอบส่ง)
curl "http://localhost:4003/api/issues/mine?system=<ระบบ>&reporterId=<id>"
```
- `reporterName`/`reporterRole` ต้องไม่เป็น `null` (ถ้า null แปลว่า guard login ยังไม่ทำงาน หรือลืมส่ง field)
- ลองแนบไฟล์ดูสักครั้ง แล้วเปิด `attachmentUrl` ที่ได้กลับมาตรงๆ ในเบราว์เซอร์ — ควรโดน `401` (เพราะไม่มี query `system`+`reporterId`) ถือว่าถูกต้อง ไม่ใช่บั๊ก
