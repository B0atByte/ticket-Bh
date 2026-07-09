# xBloom — Warranty & Service Management System

ระบบจัดการประกันและงานบริการของ xBloom — มี 2 ฝั่ง: **Customer Portal** (สาธารณะ) และ
**Staff Backend** (ล็อกอินด้วย Name + PIN). `machines.serial` คือ key กลางที่เชื่อมทุกตาราง.

## Stack

| Layer    | Tech                                           |
| -------- | ---------------------------------------------- |
| Backend  | Hono (TypeScript) + Drizzle ORM + mysql2       |
| Database | MySQL 8                                         |
| Frontend | React 18 + Vite + TypeScript + Tailwind + TanStack Query |
| Infra    | Docker Compose (mysql / api / frontend)        |

## Monorepo layout

```
.
├── backend/          Hono API + Drizzle schema/seed/migrate
│   └── src/db/        schema.ts · client.ts · migrate.ts · seed.ts
├── frontend/         React + Vite app
├── db/migrations/    Generated SQL migrations (source of truth)
├── docker-compose.yml
└── .env.example
```

## Quick start (Docker)

```bash
cp .env.example .env          # then edit secrets
docker compose up -d --build  # mysql → api (runs migrations) → frontend
```

- API:      http://localhost:8080  · health check: `GET /health` → `{"status":"ok","db":"up"}`
- Frontend: http://localhost:5173

The `api` container applies all pending migrations on startup (with connect‑retry
while MySQL warms up), then serves the API.

### Load sample data

```bash
docker compose exec api node dist/db/seed.js
```

Seeds 3 users (Admin/Staff/Tech, PINs 0001/0002/0003), 3 machines, 2 warranties,
2 tickets, 2 products, 1 log entry. PINs are bcrypt-hashed.

### Import real data from the spreadsheet

`xBloom Warranty.xlsx` (sheets: warranties, tickets, machines, Users, ActivityLog)
can be imported directly. Run from `backend/` against the published MySQL port:

```bash
cd backend
DATABASE_URL="mysql://xbloom:dev_app_pw@localhost:3306/xbloom" JWT_SECRET=x \
  npm run db:import   # optionally: npm run db:import -- "../xBloom Warranty.xlsx"
```

The importer **replaces** users/machines/warranties/tickets/activity_log and handles
real-world data quirks: Excel date serials → dates, restored leading zeros on
phone/postal, machine rows auto-created for every referenced serial (FK safety),
technician accounts created for unknown `assignedTo` names, ticket status normalized,
and duplicate primary keys de-duplicated.

## API

### Auth
- `POST /auth/login` `{name, pin}` → `{token, user}` (JWT, 12h). `GET /auth/me`.
- Send `Authorization: Bearer <token>` on staff routes.
- Destructive actions (clear-all warranties, delete ticket/machine/product) require
  **admin re-auth**: send the admin PIN again via `x-admin-pin` header or `adminPin` body.

### Endpoints
| Area | Routes |
| --- | --- |
| Warranties | `POST /register` (public), `GET /coverage/:serial` (public), `GET /warranties`, `DELETE /warranties/:id`, `DELETE /warranties` (clear all) |
| Tickets | `POST /tickets` (public), `GET /tickets/:id` (+timeline, public-safe), `GET /tickets`, `PATCH /tickets/:id/status` (workflow), `PATCH /tickets/:id`, `DELETE /tickets/:id` |
| Machines/Assets | `GET/POST /machines`, `GET /machines/:serial`, `GET /machines/:serial/history`, `PATCH /machines/:serial`, `DELETE /machines/:serial` |
| Global Claims | `GET /global-claims`, `PATCH /global-claims/:ticketId`, `POST /global-claims/backdated` |
| Dashboard | `GET /dashboard/summary` |
| Export | `GET /export/csv?type=warranties\|tickets\|assets` |
| Products | `GET/POST /products`, `PATCH/DELETE /products/:id` |
| Activity log | `GET /logs` |

Every important action writes to `activity_log`. All request bodies/queries are
validated with Zod. See `backend/api.http` for ready-to-run examples and
`backend/test/smoke.ps1` for an end-to-end test (26 checks).

## Production deploy

`docker-compose.prod.yml` runs an nginx frontend (static build) that reverse‑proxies
`/api` to the API on the internal network — only port 80 is exposed; MySQL and the API
stay private.

```bash
cp .env.example .env          # set strong MYSQL_* and JWT_SECRET
docker compose -f docker-compose.prod.yml up -d --build
# app on http://<host>:${WEB_PORT:-80} ; API reachable at /api
```

The API applies migrations on startup. Load real data once with `npm run db:import`
(point DATABASE_URL at the DB), or `node dist/db/seed.js` for demo data.

## Tests

```bash
cd backend
npm test      # vitest — business logic: date math, CSV, ticket workflow, import coercion
```

Pure business logic lives in `backend/src/lib/{http,workflow,coerce}.ts` and is covered by
unit tests. `backend/test/smoke.ps1` exercises the full API end‑to‑end (run after `db:seed`).

## Key workflows

- **Warranty expiry** = purchase date + 1 year (`addYears`). The dashboard flags warranties
  expiring within 30 days (`GET /dashboard/expiring`).
- **Machine replacement** (`POST /machines/:serial/replace`): atomically creates the new unit,
  links the original via `newSerial` + a `replacement` warranty (`replacementOf`), and marks the
  original `noWarranty = 1` (post‑claim repair unit).
- **Ticket workflow**: New → Diagnose → Quote → Approved → Repairing → Repair done → Returned →
  Closed; any state may jump to Closed. Enforced server‑side (`canTransition`).

## Local development (without Docker)

Requires Node 20+ and a reachable MySQL. Point `DATABASE_URL` at it (e.g.
`mysql://xbloom:pw@localhost:3306/xbloom`).

```bash
cd backend
npm install
npm run db:generate   # regenerate migrations after editing src/db/schema.ts
npm run db:migrate    # apply migrations
npm run db:seed       # load sample data
npm run dev           # start API with hot reload

cd ../frontend
npm install
npm run dev
```

## Customer Portal (frontend)

Public, no login. Mobile‑first SPA at `:5173` with a 4‑tab bottom nav:

- **Home** — quick links to every action.
- **Warranty** (`/warranty`) — Check Coverage by serial; "not found" → Register. Register
  wizard (`/warranty/register`) is a 3‑step flow (machine → details → address) + review +
  success screen.
- **Support** (`/support`) — Report an Issue: serial, repair type (เคลม/มาตรฐาน), contact
  (name/phone/email/LINE), 10 issue types, description, log/video links → Case received + Case ID + copy + track.
- **Track** (`/track?q=`) — find by Case ID or serial → status + timeline; "not found" → report new.

Built with React 18 + Vite + Tailwind + TanStack Query. UI is bilingual (Thai default +
English) via a TH/EN toggle (`lib/i18n.tsx`). Alerts use SweetAlert2; lists show skeleton
loaders while fetching.

**File uploads.** Receipt photos (register) and issue videos (report) are uploaded to the API
(`POST /uploads?kind=image|video`), stored on a Docker volume, and served back from `/uploads/:name`.
Uploads are validated (type + size: image ≤10MB, video ≤60MB), given random filenames (no path
traversal), and rate‑limited. The returned URL is saved on the warranty/ticket so staff can open it.

**Security.** Login is rate‑limited (10 tries / 15 min / IP). CORS is restricted via `CORS_ORIGINS`
(empty = allow all in dev). In production the API refuses to boot with a weak/default `JWT_SECRET`.
Uploads are signature‑checked (magic bytes), not just by mime type. Warranty registration captures
the customer's PDPA consent.

**Backups.** `bash scripts/backup.sh` dumps the database + uploaded files into `./backups/`
(run it from cron for scheduled backups). Restore commands are printed at the end of each run.

## Design language

Per the `staff-crm.html` / `customer.html` mockups: **IBM Plex Sans Thai** (body) +
**IBM Plex Mono** (serials/IDs), brand green `#0d4d43` + accent orange `#e7522b`, grey canvas
`#f5f6f7` with white cards, sharp 2px corners, BH (Brewing Happiness) + xBloom branding.
All defined as tokens in `tailwind.config.js`.

## Staff Backend — Support CRM

Hidden behind **Staff login** (link at the bottom of the customer Home, route `/staff`).
The default view is a **search-first CRM**: search by SN / name / phone (`GET /crm/lookup`) →
customer profile (warranty chip, contact meta, receipt/video evidence) + claim decision panel
(in / out / misuse / none → `PATCH /crm/ticket/:id/decision`) + **interaction timeline**
(contact log with channel + status, `POST /crm/interaction`). A **Manage** toggle opens the
management tables below:
Sign in with Name + PIN; the JWT is stored in `localStorage` and attached to every request.
Top bar has the logo, **← Exit** (back to the customer side) and **Sign out**, plus 6 tabs:

- **Today** — stat cards: Needs action, In progress, Closed today, Total open (+ expiry alert).
- **All Cases** — filter by type (Warranty / Standard / Claim repair) and status bucket
  (Incoming / On‑going / Closed), search, **Update ticket** modal (workflow status + assign +
  staff/tech notes), **Analysis** modal (date range + presets), Export CSV, Refresh. Delete
  needs admin PIN.
- **Warranties** — full table, All / Normal / Replacement filter, search, **Products** manager,
  Export CSV, **Clear all** (admin PIN). Row delete needs admin PIN.
- **Assets** — Store / Claim & Fixed / Subscription + source filters, **Add asset** / edit modal
  (asset type, source, warranty window, No‑warranty flag, location, note), Export CSV.
- **Global** — sections (Pending verify / Confirmed–awaiting shipment / Closed), month filter,
  **Update Global Claim** modal, **Add backdated case** modal, monthly CSV export.
- **Log** — activity log with search + refresh.

Admin‑only actions are gated both in the UI (role check) and on the server (admin re‑auth).
Tables paginate client‑side (10/25/50/100/All) with search + filters and full‑width layout.

## Database schema (6 tables)

- **machines** — central registry; `serial` UNIQUE is the linking key. Tracks asset
  type (`store` / `claim_fixed` / `subscription`), warranty window, `noWarranty` flag.
- **warranties** — registrations linked to a serial; `type` = `normal` / `replacement`.
- **tickets** — service cases (`ticketId` PK); repair workflow + global‑claim fields.
- **users** — staff accounts (`name` PK, `pin`, `role` = admin/staff/tech/customer).
- **products** — product model catalog (managed by staff).
- **activity_log** — audit trail of important actions.

`phone`, `pin`, `postal` are `VARCHAR` so leading zeros are preserved. `DATE` /
`DATETIME` columns use string mode for clean JSON serialization.

## Environment variables

See `.env.example`. Key values: `DATABASE_URL`, `JWT_SECRET` (used from Phase 2),
`API_PORT`, `FRONTEND_PORT`, `VITE_API_URL`, and the `MYSQL_*` credentials.
Never commit the real `.env`.

## Shopee Order Export

Staff can push a Shopee order into the system with one click from the **Order Detail** page
in Shopee Seller Center. A small Chrome extension (`shopee-export/extension`) reads the page
(by label text, not CSS classes) and POSTs it to the API, which saves it to MySQL and shows it
in **Staff CRM → Shopee** (search, sort, paginate, CSV export, admin delete).

- The extension is required because only code inside the Shopee tab can read its DOM
  (cross-origin + Shopee login). It calls the platform via the same `/api` proxy, so only the
  one xBloom stack runs — set its Backend URL to `http://<host>:5173/api` (the Shopee tab's
  setup panel shows the exact URL with a copy button, plus a "Test connection" button in the
  extension popup).
- Orders **always** save to MySQL (`shopee_orders`, migration 0005). Mirroring to a **Google
  Sheet** + screenshot upload to **Drive** is optional and best-effort: set
  `GOOGLE_APPLICATION_CREDENTIALS` + `SHOPEE_SHEET_ID` (and uncomment the key-file mount in
  `docker-compose.yml`). See `.env.example` → "Shopee export". Optionally gate the endpoint
  with `SHOPEE_API_KEY`.
- API: `POST /shopee/orders` (public/extension, optional `x-api-key`), `GET /shopee/orders`,
  `GET /shopee/status`, `DELETE /shopee/orders/:id` (admin re-auth).

> The standalone `shopee-export/server` is superseded by the integrated route and no longer
> needs to run.

## Roadmap

- **Phase 1 — Infrastructure + DB** ✅ docker compose, 5‑table schema/migrations, seed, `/health`
- **Phase 2 — Backend API + Auth** ✅ JWT login, role guards, admin re‑auth, Zod validation,
  all endpoints, activity logging, CSV export, products, xlsx data import
- **Phase 3 — Customer Portal** ✅ public mobile‑first SPA: Home / Warranty / Support / Track
  bottom nav, 3‑step Register wizard, Check Coverage, Report Issue, Track by Case ID/serial
- **Phase 4 — Staff Backend** ✅ premium redesign (Geist + Cormorant Garamond), JWT login,
  6 tabs (Today / All Cases / Warranties / Assets / Log / Global), update‑ticket workflow modal,
  ticket analysis, products manager, asset add/edit, global‑claim + backdated modals,
  admin‑PIN re‑auth on destructive actions, CSV export
- **Phase 5 — Polish + Tests + Deploy** ✅ expiry alerts + list, machine replacement workflow,
  unit tests (vitest), error boundary + auto sign‑out on 401, loading/empty/error states,
  production docker (nginx static + API proxy)
- Phase 3 — Customer Portal (Register / Coverage / Report / Track)
- Phase 4 — Staff Backend (Today / Cases / Warranties / Assets / Global / Log)
- Phase 5 — Polish, tests, production deploy
