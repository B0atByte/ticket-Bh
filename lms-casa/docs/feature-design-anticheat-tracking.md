# Feature Design — Anti-Cheating, Monitoring & Tracking (Phase 7)

> สถานะ: DESIGN (ยังไม่ implement) — รอ owner review/approve ก่อนลงมือ
> ผู้ร่าง: Claude Opus 4.7 — 2026-05-26
> อ้างอิงกฎ: professional-safe-programming, universal-project-engineering, Token-Saving; กฎ no-emoji (#18); Localization (#27)

---

## 0. Scope และการตัดสินใจ (ยืนยันจาก owner 2026-05-26)

| หัวข้อ | การตัดสินใจ |
|---|---|
| "สาขา" ตอนลงทะเบียน | ใช้ model `Department` เดิม (ไม่เพิ่ม Branch) |
| Camera monitoring | Snapshot เป็นช่วง + เก็บให้ HR ตรวจ + ต้องมี consent + retention (PDPA) |
| Device security | Single active session (login ใหม่ revoke session เครื่องอื่น) |
| "Level" ใน Employee Record | คำนวณจากการเรียน/แต้ม (`UserPoints.totalXp`) |
| ลำดับความสำคัญ | Anti-AFK, camera proctoring, per-person record ตามสาขา เป็นหลัก |

**สิ่งที่มีอยู่แล้วในระบบเดิม (reuse ได้ทันที):**
- `User.employeeId` (unique) + login ด้วยรหัสพนักงานทำงานแล้ว (`auth.service.ts`: identifier ไม่มี `@` -> หา `employeeId`)
- `Department` (มี tree) + `User.departmentId`
- `RefreshToken` เก็บ `ipAddress`, `userAgent`, `revokedAt`, `expiresAt` ต่อ session
- `Exam.antiCheat (Json)` + `ExamAttempt.metadata (Json)` รองรับ config/event
- `ExamRunner` มี countdown + auto-submit + แสดงทุกข้อแบบ scroll + anti-cheat events (visibility/blur/paste/contextmenu)
- `VideoPlayer` HTML5 ติดตาม progress + resume + 90% auto-complete; **embed (YouTube/Vimeo) ติดตามไม่ได้**
- `UserPoints.totalXp` + `PointEvent` + refresh-token interceptor (เพิ่ม 2026-05-26)
- File model + storage driver (local/S3/MinIO), BullMQ + scheduled jobs, ExcelJS reports, PDPA export/delete (`me` module)

---

## 1. Anti-Cheating & Monitoring

### 1.1 Anti-AFK (กันหลับระหว่างดูวิดีโอ)

**เป้าหมาย:** สุ่มเด้งป๊อปอัปคำถามง่าย (เช่น 3 + 4) ระหว่างวิดีโอเล่น ตอบใน 10 วินาที ถ้าไม่ตอบ/ตอบผิด -> ดีดออกและเริ่มวิดีโอใหม่จากต้น (ไม่กระทบสิทธิ์สอบ)

**Config (server-driven):**
- Global default: `Setting` key `learning.anti_afk` = `{ enabled, minIntervalSec, maxIntervalSec, answerTimeoutSec }` (default `{true, 120, 300, 10}`)
- Per-course/lesson override (optional): `Lesson.meta.antiAfk` (เพิ่ม field `meta Json?` ใน `Lesson` ถ้ายังไม่มี) — ถ้าไม่ใส่ใช้ค่า global

**กลไก (client — `VideoPlayer` HTML5 เท่านั้น):**
1. ระหว่าง `playing === true` ตั้ง timer สุ่ม `[minInterval, maxInterval]`
2. ครบเวลา -> `video.pause()` + เปิด modal โจทย์เลข (a,b สุ่ม 1..9, บวก)
3. ผู้ใช้มี `answerTimeoutSec` (10s, นับถอยหลังบน modal):
   - ตอบถูกในเวลา -> ปิด modal, `video.play()`, log `AFK_CHECK_PASSED`, ตั้ง timer รอบใหม่
   - ตอบผิด / หมดเวลา -> เรียก endpoint kick (ด้านล่าง), แสดงข้อความ "ต้องเริ่มเรียนบทนี้ใหม่", `video.currentTime = 0`

**Server-authoritative reset (กัน client ปลอม):**
- `POST /api/v1/me/lessons/:lessonId/afk-fail` (perm `lesson.read`)
  - reset `LessonProgress`: `lastPositionSec=0`, `secondsWatched=0`, `status=IN_PROGRESS`, `completedAt=null`
  - บันทึก `AuditLog` action `lesson.afk_failed` (actor, lessonId, ip)
  - **ไม่แตะ** `Enrollment`/สิทธิ์สอบ — requirement ระบุชัด "ไม่เสียสิทธิ์สอบ"
- เก็บสถิติ AFK ใน `LessonProgress.meta Json?` (เพิ่ม field): `{ afkPassed, afkFailed, lastAfkAt }` สำหรับ HR ดู

**ข้อจำกัด/ความเสี่ยง:**
- บังคับได้เฉพาะ HTML5 self-hosted video เท่านั้น; embed YouTube/Vimeo ควบคุม pause/seek จาก iframe ข้าม origin ไม่ได้ -> **แนะนำให้คอร์สที่ต้องการ Anti-AFK ใช้วิดีโอ self-hosted**; embed ให้ disable AFK (หรือเฟสถัดไปใช้ YouTube IFrame API postMessage)
- 90% auto-complete (#10) ยังทำงานเหมือนเดิม; reset จะทำให้ต้องดูใหม่จนถึง 90% อีกครั้ง

**Verification:** unit test reset service (progress -> 0); E2E: เปิดวิดีโอ, mock timer, ปล่อยหมดเวลา -> progress reset + video กลับต้น

---

### 1.2 Camera Monitoring (proctoring ตอนสอบ)

**เป้าหมาย:** บังคับเปิดกล้องอัตโนมัติเฉพาะช่วงทำข้อสอบ + เก็บ snapshot เป็นช่วงให้ HR ตรวจย้อนหลัง

**Config:** `Exam.antiCheat.camera = { enabled, snapshotIntervalSec }` (default interval 30s) — เปิดเป็นราย exam

**Flow (client — ExamRunner):**
1. ก่อน `start()` ถ้า `camera.enabled`: แสดง **consent dialog** (PDPA) อธิบายว่าจะถ่ายภาพระหว่างสอบเพื่อตรวจสอบ + เก็บกี่วัน
   - ปฏิเสธ -> ไม่ให้เริ่มสอบ (exam ที่บังคับกล้อง)
   - ยอมรับ -> `navigator.mediaDevices.getUserMedia({video:true})`; เก็บ `cameraConsentAt` ใน attempt.metadata
2. ระหว่างสอบ: วาด video frame ลง `<canvas>` ทุก `snapshotIntervalSec` (+ เมื่อเกิด anti-cheat event เช่น tab blur) -> ลด resolution (~320x240) + JPEG quality ต่ำ -> อัปโหลด
3. จบสอบ -> ปิด camera stream

**Backend:**
- ตาราง `ExamProctorSnapshot`: `{ id, attemptId, fileId, reason (INTERVAL|EVENT), capturedAt }`
- `POST /api/v1/attempts/:attemptId/snapshots` (perm `exam.take`, ตรวจว่าเป็น attempt ของตัวเอง + ยัง IN_PROGRESS) -> multipart image -> เก็บผ่าน storage driver (File model) -> สร้าง row
- ขนาด/ชนิดไฟล์จำกัด (เหมือน branding logo: image only, <=2MB)
- limit จำนวน snapshot ต่อ attempt (กัน abuse)

**HR review UI:**
- ในหน้า attempt detail (admin/HR): แกลเลอรี snapshot + timeline anti-cheat events
- `GET /api/v1/attempts/:attemptId/snapshots` (perm ใหม่ `proctor.review`)

**PDPA (สำคัญ — ภาพใบหน้า = personal data):**
- Consent: บันทึก timestamp + แสดงข้อความชัดก่อนสอบ
- Retention: auto-delete snapshot หลัง N วัน (default 90) ด้วย scheduled job (BullMQ — infra มีแล้ว); ลบทั้ง File + row
- Access: เฉพาะ `proctor.review` (HR/admin); audit ทุกการเปิดดู
- รวมใน PDPA flows: `me/data-export` ต้องรวม snapshot ของตัวเอง; `DELETE /me` (anonymize) ต้องลบ snapshot
- Secure context: `getUserMedia` ต้องใช้ HTTPS ใน production (localhost dev ได้) — ระบุใน deploy guide
- เพิ่ม Setting `proctor.retention_days`

**Verification:** allowed/denied (เจ้าของ attempt อัปโหลดได้, คนอื่น 403); retention job ลบจริง; PDPA export มี snapshot; HR ดูได้/employee ดูไม่ได้

---

### 1.3 Device Security — Single Active Session

**เป้าหมาย:** กัน login แทนกัน/ใช้ซ้ำหลายเครื่อง — 1 user ใช้ได้ทีละเครื่อง

**กลไก (ผูกกับ refresh-token rotation ที่มีอยู่):**
1. login สำเร็จ -> ก่อนออก refresh token ใหม่ ให้ `revokedAt = now()` กับ `RefreshToken` ที่ยัง active ทุกแถวของ user นั้น (ยกเว้นตัวใหม่)
2. เครื่องเก่าจะ refresh ไม่ผ่าน (refresh token ถูก revoke) -> interceptor ใหม่ (`api.ts`) ได้ 401 ที่ /auth/refresh -> `onAuthFailure` -> clear + เด้ง login
3. capture `ipAddress` + `userAgent` (มีแล้ว) + optional เพิ่ม `deviceId` (client สร้าง stable id เก็บใน localStorage) ใน RefreshToken เพื่อระบุอุปกรณ์ชัดขึ้น
4. แจ้งเตือน (optional): notification/email "มีการเข้าสู่ระบบจากอุปกรณ์ใหม่ อุปกรณ์เดิมถูกออกจากระบบ"

**ทำไมไม่บล็อกด้วย IP:** corporate NAT = หลายคน IP เดียว, mobile = IP เปลี่ยน -> block IP ผิดพลาดสูง; single-active-session ทำงานที่ระดับ session แม่นกว่าและไม่ false-positive

**Admin tools:**
- `GET /api/v1/admin/users/:id/sessions` (perm `user.update`): list active sessions (device, ip, lastUsed)
- `DELETE /api/v1/admin/users/:id/sessions` (perm `user.update`): force logout ทุกเครื่อง
- ทุก login เขียน `AuditLog` `auth.login` (ip, device)

**Verification:** login เครื่อง B -> refresh เครื่อง A ได้ 401; admin force-logout ได้; concurrent login race (transaction)

---

## 2. User Registration & Records

### 2.1 Enhanced Registration (department + login ด้วยรหัสพนักงาน)

**Backend (ส่วนใหญ่มีแล้ว):**
- login ด้วย employeeId: ทำงานแล้ว (`auth.service.ts:131-133`)
- เพิ่มใน register schema: `departmentId` (required), `employeeId` (required, unique, format `^[A-Za-z0-9-]{3,64}$`)
- ต้องมี endpoint รายชื่อสาขาให้ dropdown: `GET /api/v1/departments` — **ปัจจุบันยังไม่มี departments module** -> สร้าง module ใหม่ (อย่างน้อย list; admin CRUD ทำต่อได้):
  - `GET /departments` (auth ทั่วไป หรือ public สำหรับหน้า register)
  - (เฟสถัดไป) `POST/PUT/DELETE /departments` perm `user.update` หรือ perm ใหม่ `department.manage`

**Frontend:**
- `LoginPage`: label ช่อง identifier เป็น "อีเมล หรือ รหัสพนักงาน" (ส่ง `identifier` เหมือนเดิม)
- Registration form: เพิ่ม select "สาขา/แผนก" (จาก GET /departments) + ช่อง "รหัสพนักงาน" + validation (Zod) ตรงกับ backend

**Verification:** register พร้อม department+employeeId -> login ด้วย employeeId ผ่าน; employeeId ซ้ำ -> 409; department ไม่ถูกต้อง -> 400

---

### 2.2 Employee Record (รายงานรายบุคคลสำหรับ Admin/HR)

**เป้าหมาย:** ดูประวัติรายคน — ผ่านอบรมกี่หลักสูตร + ปัจจุบัน Level ไหน — กรองตามสาขา

**Level จาก XP (นิยามใหม่ — ยังไม่มีในระบบ):**
- เพิ่มใน `points.constants.ts`: ตาราง threshold เช่น
  `LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000]` (Level 1..10)
- helper `levelFromXp(totalXp): { level, currentLevelXp, nextLevelXp }` ใน `points.service.ts`
- surface ที่ leaderboard/dashboard ด้วย (ค่าเดียวกัน)

**Backend:**
- `GET /api/v1/admin/users/:id/record` (perm `user.read` หรือ `report.read`): คืน
  - user + department
  - `coursesCompleted`: count + list (จาก `Enrollment` status COMPLETED)
  - `level`, `totalXp`, `nextLevelXp`
  - `examSummary`: passed/failed/attempts
  - training timeline (เรียงเวลา)
- `GET /api/v1/admin/records?departmentId=&page=` (perm `report.read`): list รายคนในสาขา + count คอร์สผ่าน + level
- `GET /api/v1/reports/employee-records.xlsx?departmentId=` (perm `report.export`): export (reuse ExcelJS pattern)

**Frontend:** หน้า `EmployeeRecordsPage` (admin/HR) — filter สาขา + ตารางรายคน (ชื่อ, รหัสพนักงาน, สาขา, คอร์สผ่าน, Level) + ลิงก์ไปหน้า detail รายคน

**Verification:** level boundary tests (XP=99->L1, 100->L2); RBAC (employee เข้าไม่ได้); filter by department; excel export

---

## 3. Exam UI Improvements (ส่วนใหญ่มีแล้ว — เน้นเสริม)

| Requirement | สถานะปัจจุบัน | งานที่เพิ่ม |
|---|---|---|
| Flexible Navigation (scroll + ทำข้อไหนก่อนก็ได้) | ทำแล้ว (render ทุกข้อเป็น section, ทำข้อใดก่อนก็ได้) | เพิ่ม **question navigator** (chips/sidebar เลขข้อ + สถานะ answered/unanswered, คลิกเพื่อ jump ด้วย scrollIntoView) |
| Clear Countdown | มี timer + สี (เหลือง<3m, แดง<1m) + auto-submit | ทำ timer **sticky บนสุด** + ใหญ่ขึ้น + toast เตือนที่ 5/1 นาที |
| Result Display | onResult -> หน้า result | แสดง **ผ่าน/ไม่ผ่าน ตัวใหญ่** (เขียว/แดง) + คะแนน % + เกณฑ์ผ่าน + ปุ่ม "ดูประวัติการสอบ" -> `AttemptHistoryPage` (มีแล้ว) |
| i18n | ExamRunner hardcode อังกฤษ | ย้ายเป็น i18n key (TH/EN) ตาม #27 (exam = user-facing) |

**Verification:** navigator jump + answered state; sticky timer; result แสดงผ่าน/ไม่ผ่านถูกต้องตาม passingScore

---

## 4. Permissions ที่ต้องเพิ่ม (seed)

- `proctor.review` — ดู camera snapshot + anti-cheat (HR, ADMIN, SUPER_ADMIN)
- (optional) `department.manage` — CRUD สาขา (ADMIN/HR); ระยะแรกใช้ `user.update` ได้
- force-logout sessions ใช้ `user.update` (ไม่เพิ่ม perm ใหม่)

---

## 5. สรุป Schema changes (Prisma — ใช้ `prisma db push`)

**Models ใหม่:**
- `ExamProctorSnapshot { id, attemptId FK, fileId FK, reason enum, capturedAt }` + index `[attemptId]`

**Fields เพิ่ม:**
- `Lesson.meta Json?` (anti-afk override) — ถ้ายังไม่มี
- `LessonProgress.meta Json?` (afk counters)
- `RefreshToken.deviceId String?` (optional, ระบุอุปกรณ์)

**ค่าใน Json ที่มีอยู่แล้ว (ไม่ต้อง migration):**
- `Exam.antiCheat.camera`, `ExamAttempt.metadata.cameraConsentAt`

> หมายเหตุ: โปรเจกต์ใช้ `prisma db push` (ไม่มี migrations folder). การเพิ่ม column/table เป็น additive ปลอดภัย. Production ควรเปลี่ยนเป็น `migrate deploy` ตาม Decision #5 ก่อน go-live.

---

## 6. ลำดับ rollout ที่แนะนำ (เล็ก -> ใหญ่, เสี่ยงน้อย -> มาก)

1. **Device Security (single session)** — เล็ก, ต่อ refresh flow ที่มี, คุณค่าความปลอดภัยสูง
2. **Enhanced Registration + departments endpoint**
3. **Employee Record + Level (points.constants)**
4. **Exam UI polish** (navigator, sticky timer, result, i18n)
5. **Anti-AFK (video)**
6. **Camera proctoring** — ใหญ่สุด + PDPA หนัก -> ทำท้ายสุดหลังได้ legal sign-off

แต่ละ feature: typecheck + unit test (allowed/denied) + E2E ที่เกี่ยว + อัปเดต `Agenstimeline.md`

---

## 7. Open risks / ต้องตัดสินใจเพิ่ม

1. **Camera/PDPA**: ต้องมี consent text + retention policy ที่ฝ่ายกฎหมาย/HR เห็นชอบก่อน production; ต้อง HTTPS
2. **Anti-AFK บน embed video**: บังคับไม่ได้ — ต้องตัดสินใจว่าคอร์สสำคัญใช้ self-hosted เท่านั้นหรือไม่
3. **Single active session**: ผู้ใช้ที่มี 2 เครื่องจริง (เช่น มือถือ+คอม) จะถูกเตะออกสลับกัน — ยอมรับได้ตาม requirement; อาจเพิ่ม whitelist อุปกรณ์ในอนาคต
4. **Self-registration เปิดให้ใครบ้าง?** — enterprise มักให้ admin/HR สร้าง user; ถ้าเปิด public register ต้องมี approval flow หรือจำกัดโดเมนอีเมล/รูปแบบ employeeId
5. **Snapshot storage cost**: 30s/ครั้ง × ผู้สอบจำนวนมาก = ไฟล์เยอะ -> ต้องตั้ง retention + พิจารณา interval/quality
