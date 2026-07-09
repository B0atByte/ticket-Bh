# AGENT TIMELINE & HANDOFF — xBloom Warranty & Service System

> อ่านไฟล์นี้ก่อนเริ่มงานต่อ จะเข้าใจทั้งระบบโดยไม่ต้องไล่โค้ดเองทั้งหมด
> (Read this first to pick up the project without reading everything.)

---

## 1. ระบบนี้คืออะไร (What it is)
ระบบจัดการ **ประกัน + งานบริการหลังการขาย** ของ xBloom Thailand (แบรนด์เครื่องชงกาแฟ) มี 2 ฝั่ง:
- **Customer Portal** (สาธารณะ, mobile-first): ลงทะเบียนประกัน / ตรวจสอบประกัน / แจ้งปัญหา (เคลม) / ติดตามเคส
- **Staff Backend** (ล็อกอิน Name+PIN): Support CRM แบบค้นหา SN → โปรไฟล์ลูกค้า + ตัดสินเคลม + ไทม์ไลน์การติดต่อ, และแท็บจัดการ (Today / All Cases / Warranties / Assets / Global / Log)

`machines.serial` คือ key กลางที่เชื่อมทุกตาราง

## 2. Stack & โครงสร้าง (Repo map)
- **Backend**: Hono (TypeScript) + Drizzle ORM + MySQL 8 + mysql2 — `backend/`
- **Frontend**: React 18 + Vite + Tailwind + TanStack Query — `frontend/`
- **Infra**: Docker Compose (mysql / api / frontend) + nginx (prod)

```
backend/src/
  index.ts            app, route mounts, static /uploads, cors, error handler
  env.ts              env (fail-fast; prod JWT strength check)  · types.ts (Hono AppEnv)
  db/                 schema.ts · client.ts · migrate.ts · seed.ts
  lib/                auth.ts(jwt+bcrypt) · activity.ts · http.ts(fail/addYears/toCsv)
                      workflow.ts(ticket status) · coerce.ts(xlsx import) · zval.ts(zod→readable error)
                      mailer.ts(nodemailer, optional) · version not here
  middleware/         auth.ts(requireAuth/requireRole/adminReauth/optionalAuth) · rateLimit.ts
  routes/             auth warranties tickets machines globalClaims dashboard
                      export products logs users crm uploads
  scripts/import-xlsx.ts   imports "xBloom Warranty.xlsx" (run via tsx)
  test/               *.test.ts (vitest, 21 tests) + smoke.ps1 (full API e2e)
frontend/src/
  main.tsx App.tsx
  lib/      api.ts · auth.tsx · i18n.tsx · status.ts · csv.ts · validate.ts
            usePaged.ts · version.ts · swal.ts · autoUpdate.ts
  components/ ui.tsx Icon.tsx Modal.tsx BottomNav.tsx LangToggle.tsx Skeleton.tsx
              ErrorBoundary.tsx Footer.tsx ScanSerial.tsx  staff/ui.tsx
  pages/    Home Coverage Register Report Track
            staff/StaffApp staff/CrmView staff/tabs/* (Today AllCases Warranties
            Assets GlobalClaims Log + modals: ProductsModal UpdateTicketModal
            AnalysisModal AssetModal ReplaceModal GlobalClaimModal BackdatedModal)
  public/xbloom-logo.png
root: docker-compose.yml · docker-compose.prod.yml · .env.example · README.md
      db/migrations/ (0000–0004) · frontend/nginx.conf · scripts/backup.sh
      Logo/ (brand png) · imgetest/ (SN barcode test photos)
```

## 3. รันยังไง (Commands)
```bash
# dev (what is currently running)
cp .env.example .env
docker compose up -d --build           # mysql → api(applies migrations) → frontend
# app:  http://localhost:5173   (LAN: http://<host-ip>:5173)
# api:  proxied at /api (browser never calls 8080 directly)

# load real data (host, mysql published on localhost:3306)
cd backend && DATABASE_URL="mysql://xbloom:dev_app_pw@localhost:3306/xbloom" JWT_SECRET=x npm run db:import

cd backend && npm test                  # vitest (21)
bash scripts/backup.sh                   # DB + uploads backup → ./backups/

# production
docker compose -f docker-compose.prod.yml up -d --build   # nginx static + /api proxy, port 80
```
**Login (staff):** real PINs came from the imported sheet — `Admin / 2120` (admin). Others: Nan/1212, Toon/2121, etc. PINs are bcrypt-hashed.

## 4. กติกาสำคัญ (Conventions — DO NOT BREAK)
1. **ห้าม emoji ใน UI** — ใช้ SVG ผ่าน `components/Icon.tsx` (`<Icon name=…/>`) เท่านั้น
2. **ทุกข้อความ UI ต้องผ่าน i18n** — `lib/i18n.tsx` (TH default + EN, toggle เก็บใน localStorage). เพิ่ม string ใหม่เป็น `{th,en}` ใน DICT เสมอ ห้าม hardcode
3. **ตาม SKILL.md ใน `Agents/`** — universal-project-engineering + professional-safe-programming + token-efficient (เปลี่ยนเล็กที่สุด, secure-by-default, verify ทุกครั้ง)
4. Alerts ทุกจุดใช้ **SweetAlert2** (`lib/swal.ts`: swalToast/swalError/swalConfirm/confirmAdminPin) · โหลดข้อมูลใช้ **skeleton** (`components/Skeleton.tsx`) ไม่ใช่ spinner

## 5. จุดสำคัญทางสถาปัตยกรรม (Key architecture notes / gotchas)
- **API access via /api proxy**: browser เรียก same-origin `/api` เสมอ → Vite dev (`vite.config.ts` proxy) / nginx (prod) ส่งต่อไป api service. ทำให้ใช้ในแลนได้โดยไม่ต้องรู้ IP + ไม่ติด CORS. `VITE_API_URL=/api`.
- **Ports**: เฉพาะ **5173** เปิดออกแลน (0.0.0.0). api(8080) + mysql(3306) bind `127.0.0.1` เท่านั้น (กันเข้าถึงตรงจากแลน).
- **Auto-update** (`lib/autoUpdate.ts`): build id ฝังตอน build (`__BUILD_ID__`) + endpoint `/__build`. แอปเช็คตอนเปิด/กลับมาที่แท็บ ถ้า id ไม่ตรง → `location.reload()` เอง → มือถือไม่ต้องล้าง cache. (nginx/vite serve `/__build` + index.html แบบ no-store)
- **SN scan** (`components/ScanSerial.tsx`): ถ่าย/แนบรูป → ZXing (lazy-loaded) ถอดบาร์โค้ด **Code39/93/128** (ข้าม UPC ตัวเลข) + ลองหมุนหลายมุม (รูปเอียง). ใช้ `<input capture>` ไม่ใช้ getUserMedia → ทำงานบน HTTP แลนได้. Validate ด้วย `isXbloomSerial` (`^J[0-9A-Z]{11,15}$`) กันสแกนผิดบาร์โค้ด.
- **File uploads** (`routes/uploads.ts`): public + rate-limited, ตรวจ magic-byte (ไม่เชื่อ mime), random filename, เก็บใน volume `uploads_data` (`/app/backend/uploads`), serve ที่ `/uploads/:name`. คืน URL → frontend prepend `BASE` (`/api`) → เก็บใน `receiptDriveUrl`/`videoUrl`.
  - **สำคัญ**: URL ฟิลด์ใน schema เป็น `z.string().max(512)` (ไม่ใช่ `.url()`) เพราะ path เป็น relative `/api/uploads/...`. อย่าเปลี่ยนกลับเป็น `.url()` (เคยทำให้ register/report พังเป็น "[object Object]").
- **zValidator wrapper** (`lib/zval.ts`): ทุก route import จากที่นี่ (ไม่ใช่ `@hono/zod-validator` ตรงๆ) → error เป็น `{error:"field: msg"}` อ่านรู้เรื่อง.
- **Mailer** (`lib/mailer.ts`): optional, อ่าน SMTP_* จาก env (ถ้าไม่ตั้ง = ข้าม ไม่พัง). ส่งตอน register + ticket create (fire-and-forget). ตั้งค่า Gmail App Password ใน `.env` เพื่อเปิด.
- **Warranty term = 2 ปี** (`WARRANTY_YEARS` ใน warranties.ts). register ใช้ transaction (machine+warranty atomic).
- **Auth**: JWT (hono/jwt) 12h เก็บ localStorage, role admin/staff/tech/customer, admin re-auth (PIN) ก่อนลบ/clear (`confirmAdminPin` swal), login rate-limit 10/15min.

## 6. Data model (7 ตาราง) + ของจริง
`machines`(serial PK-link) · `warranties` · `tickets`(ticketId `TK-YYYY-NNNNNN`) · `users`(name PK, pin hash, role) · `products` · `interactions`(CRM contact log) · `activity_log`. มี index แล้ว (migration 0004).
- ข้อมูลจริง import แล้ว: ~13 users, ~119 machines, ~123 warranties, 26 tickets, 509 logs.
- **Data quirk**: มี serial เทสต์ปนอยู่ (`UP-/REC-/CON-/W2-/EXP-/ML-`) จากการทดสอบ — re-run `npm run db:import` เพื่อล้างเหลือข้อมูลจริง.
- ticket status จริงมีค่านอก 8-state model (เช่น `guide_customer`) — เก็บได้ปกติ, UI map เฉพาะที่รู้จัก.

## 7. Timeline (ทำอะไรไปแล้ว)
1. **P1** Infra+DB: docker compose, schema, migrations, seed, /health
2. **P2** API+Auth: JWT/role/adminReauth, Zod, ทุก endpoint, activity log, CSV export, products, xlsx import
3. **P3** Customer Portal: Register wizard / Coverage / Report / Track
4. **P4** Staff Backend + premium redesign (ตาม mockup `customer.html`/`staff-crm.html`)
5. **P5** Polish: expiry alert, machine replacement workflow, tests, error/empty states, prod docker
6. **Iterations หลัง P5**:
   - Design language จาก mockup: IBM Plex Sans Thai + Mono, เขียว #0d4d43 / ส้ม #e7522b, มุมคม 2px, โลโก้ BH+xBloom (ภายหลังใช้โลโก้จริง `public/xbloom-logo.png` + favicon + footer copyright/version)
   - Staff เปลี่ยนเป็น **CRM search-first** + **sidebar ซ้าย** (เดิม top tabs) + ตารางเต็มจอ + truncate อ่านง่าย
   - **No-emoji → SVG icons** · **i18n TH/EN ครบทั้งระบบ** · **SweetAlert2** ทุก alert · **skeleton loaders**
   - Pagination + เลือกจำนวนแถว (client-side)
   - **Security**: login rate-limit, CORS env, prod JWT check, ports bind localhost
   - **Bug fixes**: warranty 1→2 ปี, [object Object]/relative-URL validation, header alignment, sidebar button full-width
   - **LAN access**: /api proxy + auto-update (เคลียร์ cache อัตโนมัติ)
   - **SN scan** (ZXing) + format validation
   - **File uploads** จริง (volume) + magic-byte check
   - **PDPA consent** checkbox ตอนลงทะเบียน · **DB indexes** · **backup script**
   - **Email** (Gmail SMTP, optional) ตอน register + case received — verified ผ่าน test SMTP
   - **Report prefill (privacy-gated)**: หน้า `/support` สแกน/ตรวจ SN → ถ้าพบผู้ลงทะเบียนจะโชว์เบอร์แบบ **mask** (`063-xxx-xxxx`) ก่อน ลูกค้าต้องกรอก **เบอร์ 4 ตัวท้าย** ยืนยันถึงจะดึง ชื่อ/โทร/อีเมล เต็มมากรอกช่องว่างให้ (ไม่ทับที่พิมพ์เอง). API `GET /coverage/:serial/contact[?verify=XXXX]` — ไม่มี verify = คืนแค่ masked hint; verify ถูก = คืน PII เต็ม; ผิด = `verified:false`. rate-limit 20/นาที/IP กันเดา serial+โค้ด
   - **ตารางเต็มกรอบ ไม่ล้น**: `TableWrap` (`components/staff/ui.tsx`) เปลี่ยนเป็น `table-fixed` + `<colgroup>` ความกว้างต่อคอลัมน์ (รับ prop `cols:{label,w,className}[]` + `minWidth`) ทุกหน้า (Today/AllCases/Warranties/Assets/Global/Log) ส่งความกว้างเอง + truncate เซลล์ข้อความยาว → desktop แสดงครบทุกคอลัมน์ไม่เลื่อนแนวนอน, เลื่อนเฉพาะจอแคบ (mobile). ปุ่ม action (ลบ/อัปเดท/แก้ไข/เปลี่ยนเครื่อง) เป็น **icon minimal** ผ่าน `IconAction`+`RowActions` (ไอคอน edit/trash/swap ใน Icon.tsx, มี title/aria-label). ใบเสร็จในหน้าประกันเป็นไอคอน `file` แทนคำว่า "ดู"
   - **เรียงข้อมูลจากหัวคอลัมน์ทุกหน้า**: `lib/useSort.ts` (`useSort`/`useSortState`/`sortRows`) — กดหัวคอลัมน์เรียง asc↔desc (ค่าว่างไปท้าย, ตัวเลข/วันที่/ข้อความไทย), ลูกศรบอกทิศใน `TableWrap` (prop `sort`/`onSort`, `Col.sortKey`). เปิดใช้ทุกหน้า: Today, AllCases, Warranties, Assets, GlobalClaims (เรียงร่วมทุก section), Log
   - **AI ร่างข้อความตอบลูกค้า (DeepSeek)**: ใน UpdateTicketModal เลือกประเภทข้อความ (แจ้งคืบหน้า/ขอข้อมูล/ค่าซ่อม/รับเครื่อง/ปิดเคส) + ใส่ประเด็น → ร่าง **TH+EN** แก้ได้ → คัดลอก/ส่งอีเมลถึงลูกค้า. Backend: `lib/ai.ts` (DeepSeek OpenAI-compatible, key ฝั่ง server เท่านั้น, `DEEPSEEK_API_KEY`), `routes/ai.ts` `POST /ai/draft-reply` (staff auth + rate-limit 20/นาที, **ส่งแค่ context เคส ไม่ส่ง PII**), `POST /tickets/:id/message` ส่งอีเมลผ่าน mailer (`customerMessageEmail`, escape HTML). `fail()` รองรับ 500/502/503. human-in-the-loop เสมอ
   - **SLA / Reports tab** (`tabs/Reports.tsx` + `GET /dashboard/reports?slaDays=`): เวลาแก้เคสเฉลี่ย, %ปิดทันใน SLA, เคสค้างเกิน SLA, aging buckets, แยกตามสถานะ/ประเภท, trend 6 เดือน, ประกันใกล้หมด 30/60/90 — เลือกเป้า SLA ได้ (3/7/14/30 วัน). bar/trend วาดด้วย div ไม่มี chart lib

## 8. เหลืออะไร (TODO / next)
**ทำต่อได้เลย (self-contained):**
- Server-side pagination (ตอนนี้ client-side — ช้าถ้าข้อมูลโตหลักหมื่น)
- Email events ที่เหลือ: สถานะเคสเปลี่ยน + เตือนประกันใกล้หมด (ต้องตั้ง daily job/cron)
- ใบกำกับภาษี self-service (mockup), soft-delete + ลบไฟล์ orphan, สแกนใน staff CRM
- Tests เพิ่ม (integration/E2E/frontend)

**ต้องใช้ของ user:**
- เปิด Email จริง → ใส่ Gmail App Password ใน `.env` (SMTP_USER/SMTP_PASS/MAIL_FROM) แล้ว `docker compose up -d api`
- Object storage (S3) ถ้า deploy หลาย instance · CI/CD ถ้ามี git repo · HTTPS + โดเมน ถ้าออกนอกแลน

**ก่อน production จริง:** สลับ prod compose, ตั้ง JWT_SECRET สุ่มยาว + เปลี่ยน PIN/รหัส MySQL, ตั้ง cron backup, (ถ้าออกเน็ต) HTTPS.

## 9. วิธีทำงานที่แนะนำสำหรับ agent ถัดไป
- เปลี่ยนแล้ว build เช็คก่อน: `cd backend && npm run build` / `cd frontend && npm run build`
- รัน/รีบิลด์เฉพาะ service ที่แก้: `docker compose up -d --build api` (หรือ `frontend`)
- เพิ่ม string → ใส่ `lib/i18n.tsx` (th+en) · เพิ่มไอคอน → `components/Icon.tsx` · ห้าม emoji
- ทดสอบ UI จริงได้ด้วย Playwright (ติดตั้งแล้วใน frontend devDeps) — เขียน `_verify.mjs` ชั่วคราวแล้วลบ
- หลังแก้ frontend ผู้ใช้มือถือจะได้เวอร์ชันใหม่อัตโนมัติ (auto-update) — ถ้าเครื่องค้างมากเปิด `…:5173/?v=N`
