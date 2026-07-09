import { zValidator } from "../lib/zval.js";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { activityLog, machines, tickets } from "../db/schema.js";
import { logActivity } from "../lib/activity.js";
import { caseEmail, customerMessageEmail, mailEnabled, sendMail } from "../lib/mailer.js";
import { fail, isSafeUrl } from "../lib/http.js";
import { adminReauth, optionalAuth, requireAuth, requireStaff } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { TICKET_STATUSES, type TicketStatus, canTransition } from "../lib/workflow.js";
import type { AppEnv } from "../types.js";

async function genTicketId(): Promise<string> {
  // Format TK-YYYY-NNNNNN (matches existing data, e.g. TK-2026-031817).
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = `TK-${year}-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
    const [clash] = await db.select({ id: tickets.ticketId }).from(tickets).where(eq(tickets.ticketId, candidate));
    if (!clash) return candidate;
  }
  fail(409, "ไม่สามารถสร้างหมายเลขเคสได้ กรุณาลองใหม่ / Could not generate Case ID");
}

// Fields hidden from unauthenticated (customer) callers. In addition to internal
// notes, contact PII (name/phone/email/lineId) is stripped so anonymous callers
// can't harvest the customer database by enumerating serials / case IDs.
function toPublicTicket(t: typeof tickets.$inferSelect) {
  const { staffNote, techNote, globalClaimNote, approvedBy, name, phone, email, lineId, ...safe } = t;
  void staffNote;
  void techNote;
  void globalClaimNote;
  void approvedBy;
  void name;
  void phone;
  void email;
  void lineId;
  return safe;
}

export const ticketRoutes = new Hono<AppEnv>();

// ── Public: create a ticket ─────────────────────────────
const createSchema = z.object({
  serial: z.string().min(1).max(100),
  name: z.string().min(1).max(191),
  phone: z.string().min(1).max(30),
  email: z.string().email().max(191).optional().or(z.literal("")),
  lineId: z.string().max(100).optional(),
  issueType: z.string().min(1).max(100),
  description: z.string().optional(),
  repairType: z.enum(["warranty", "standard", "repair_claim"]),
  // Accept absolute http(s) URLs (pasted log link) or our own upload path; reject
  // javascript:/data: schemes to prevent stored XSS when staff click the link.
  logUrl: z.string().max(512).optional().or(z.literal("")).refine((v) => isSafeUrl(v), "ลิงก์ไม่ปลอดภัย / Unsafe link"),
  videoUrl: z.string().max(512).optional().or(z.literal("")).refine((v) => isSafeUrl(v), "ลิงก์ไม่ปลอดภัย / Unsafe link"),
  videoFilename: z.string().max(255).optional(),
});

ticketRoutes.post("/", rateLimit({ max: 6, windowMs: 60_000, keyPrefix: "report" }), zValidator("json", createSchema), async (c) => {
  const body = c.req.valid("json");

  // FK requires the serial to exist; create a stub machine if needed.
  const [machine] = await db
    .select({ serial: machines.serial })
    .from(machines)
    .where(eq(machines.serial, body.serial));
  if (!machine) {
    await db.insert(machines).values({ serial: body.serial, status: "unregistered", source: "ticket" });
  }

  const ticketId = await genTicketId();
  await db.insert(tickets).values({
    ticketId,
    serial: body.serial,
    name: body.name,
    phone: body.phone,
    email: body.email || null,
    lineId: body.lineId,
    issueType: body.issueType,
    description: body.description,
    repairType: body.repairType,
    logUrl: body.logUrl || null,
    videoUrl: body.videoUrl || null,
    videoFilename: body.videoFilename,
    status: "new",
    warrantyCase: body.repairType === "standard" ? 0 : 1,
  });

  await logActivity(null, "ticket.create", ticketId, `serial ${body.serial}`);
  void sendMail(body.email, `รับเรื่องแล้ว / Case received · ${ticketId}`, caseEmail(body.name, ticketId, body.serial, body.issueType));
  return c.json({ ticketId, status: "new" }, 201);
});

async function timelineFor(ticketId: string, publicSafe = false) {
  const rows = await db
    .select({
      timestamp: activityLog.timestamp,
      action: activityLog.action,
      detail: activityLog.detail,
      by: activityLog.userName,
    })
    .from(activityLog)
    .where(eq(activityLog.target, ticketId))
    .orderBy(asc(activityLog.timestamp));
  if (!publicSafe) return rows;
  // Public callers (the customer Track page) must not see staff identities
  // (`by`) or the free-text `detail`, which can carry internal notes and email
  // subjects. Keep only timestamp + action; the client shows a localized label.
  return rows.map((r) => ({ timestamp: r.timestamp, action: r.action, detail: null, by: null }));
}

// ── Public: track by Case ID or serial (public-safe) ────
ticketRoutes.get("/track/:q", rateLimit({ max: 30, windowMs: 60_000, keyPrefix: "track" }), async (c) => {
  const q = c.req.param("q");
  let [ticket] = await db.select().from(tickets).where(eq(tickets.ticketId, q));
  if (!ticket) {
    [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.serial, q))
      .orderBy(desc(tickets.createdAt))
      .limit(1);
  }
  if (!ticket) fail(404, "No case found");
  return c.json({ ticket: toPublicTicket(ticket), timeline: await timelineFor(ticket.ticketId, true) });
});

// ── Public/staff: get one ticket + timeline ─────────────
ticketRoutes.get("/:id", rateLimit({ max: 60, windowMs: 60_000, keyPrefix: "ticketget" }), optionalAuth, async (c) => {
  const id = c.req.param("id");
  const [ticket] = await db.select().from(tickets).where(eq(tickets.ticketId, id));
  if (!ticket) fail(404, "No case found");

  const user = c.get("user");
  // Techs may read any case (read-only); write access stays scoped to assigned.
  const isStaff = !!user;
  const timeline = await timelineFor(id, !isStaff);
  return c.json({ ticket: isStaff ? ticket : toPublicTicket(ticket), timeline });
});

// ── Staff: list tickets (filter + search) ───────────────
const listQuery = z.object({
  type: z.enum(["warranty", "standard", "repair_claim"]).optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  q: z.string().optional(),
  mine: z.string().optional(),
});

ticketRoutes.get("/", requireAuth, zValidator("query", listQuery), async (c) => {
  const user = c.get("user")!;
  const { type, status, q, mine } = c.req.valid("query");
  const conds = [];
  // "My cases" filter — used by the technician's own-cases view. Techs can read
  // all cases (read-only); editing stays scoped to their assigned cases below.
  if (mine) conds.push(eq(tickets.assignedTo, user.name));
  if (type) conds.push(eq(tickets.repairType, type));
  if (status) conds.push(eq(tickets.status, status));
  if (q) {
    const pat = `%${q}%`;
    conds.push(
      or(like(tickets.ticketId, pat), like(tickets.serial, pat), like(tickets.name, pat), like(tickets.phone, pat))!,
    );
  }
  const rows = await db
    .select()
    .from(tickets)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(tickets.createdAt));
  return c.json({ data: rows, count: rows.length });
});

// ── Staff: change status (workflow-validated) ───────────
const statusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
  note: z.string().optional(),
});

ticketRoutes.patch("/:id/status", requireAuth, zValidator("json", statusSchema), async (c) => {
  const id = c.req.param("id");
  const { status, note } = c.req.valid("json");
  const [ticket] = await db.select().from(tickets).where(eq(tickets.ticketId, id));
  if (!ticket) fail(404, "Ticket not found");

  const user = c.get("user")!;
  if (user.role === "tech" && ticket.assignedTo !== user.name) {
    fail(403, "อัปเดตได้เฉพาะเคสที่ได้รับมอบหมาย / You can only update your assigned cases");
  }

  const current = (ticket.status ?? "new") as TicketStatus;
  if (!canTransition(current, status)) fail(409, `เปลี่ยนสถานะจาก ${current} เป็น ${status} ไม่ได้`);

  await db.update(tickets).set({ status }).where(eq(tickets.ticketId, id));
  await logActivity(c.get("user"), "ticket.status", id, `${current} → ${status}${note ? ` (${note})` : ""}`);
  return c.json({ ticketId: id, status });
});

// ── Staff/admin: claim a case (take ownership on the support side) ──
ticketRoutes.post("/:id/claim", requireAuth, requireStaff, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const [ticket] = await db.select({ status: tickets.status }).from(tickets).where(eq(tickets.ticketId, id));
  if (!ticket) fail(404, "Ticket not found");
  const set: Partial<typeof tickets.$inferInsert> = { claimedBy: user.name };
  // A brand-new case advances to "diagnose" once someone picks it up.
  if ((ticket.status ?? "new") === "new") set.status = "diagnose";
  await db.update(tickets).set(set).where(eq(tickets.ticketId, id));
  await logActivity(user, "ticket.claim", id, `claimed by ${user.name}`);
  return c.json({ ticketId: id, claimedBy: user.name, status: set.status ?? ticket.status });
});

// ── Technician (or staff/admin): accept an assigned case ──
ticketRoutes.post("/:id/accept", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const [ticket] = await db.select({ assignedTo: tickets.assignedTo }).from(tickets).where(eq(tickets.ticketId, id));
  if (!ticket) fail(404, "Ticket not found");
  if (user.role === "tech" && ticket.assignedTo !== user.name) {
    fail(403, "รับได้เฉพาะเคสที่ได้รับมอบหมาย / You can only accept your assigned cases");
  }
  await db.update(tickets).set({ techAcceptedAt: sql`CURRENT_TIMESTAMP` }).where(eq(tickets.ticketId, id));
  await logActivity(user, "ticket.accept", id, `accepted by ${user.name}`);
  return c.json({ ticketId: id, accepted: true });
});

// ── Staff: assign / notes / tracking ────────────────────
const patchSchema = z
  .object({
    assignedTo: z.string().max(100).nullable().optional(),
    staffNote: z.string().nullable().optional(),
    techNote: z.string().nullable().optional(),
    trackingLink: z.string().max(512).nullable().optional().refine((v) => isSafeUrl(v), "ลิงก์ไม่ปลอดภัย / Unsafe link"),
    approvedBy: z.string().max(100).nullable().optional(),
    repairType: z.enum(["warranty", "standard", "repair_claim"]).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "ไม่มีข้อมูลให้แก้ไข");

ticketRoutes.patch("/:id", requireAuth, zValidator("json", patchSchema), async (c) => {
  const id = c.req.param("id");
  const patch = c.req.valid("json");
  const [ticket] = await db
    .select({ id: tickets.ticketId, assignedTo: tickets.assignedTo })
    .from(tickets)
    .where(eq(tickets.ticketId, id));
  if (!ticket) fail(404, "Ticket not found");

  const user = c.get("user")!;
  if (user.role === "tech") {
    // Technicians may only edit their own case, and only the technician note.
    if (ticket.assignedTo !== user.name) {
      fail(403, "แก้ได้เฉพาะเคสที่ได้รับมอบหมาย / You can only edit your assigned cases");
    }
    const allowed = new Set(["techNote", "trackingLink"]);
    if (Object.keys(patch).some((k) => !allowed.has(k))) {
      fail(403, "ช่างแก้ได้เฉพาะบันทึกช่าง / Technicians can only edit the technician note");
    }
  }

  await db.update(tickets).set(patch).where(eq(tickets.ticketId, id));
  await logActivity(c.get("user"), "ticket.update", id, Object.keys(patch).join(", "));
  return c.json({ ticketId: id, updated: Object.keys(patch) });
});

// ── Staff: email a message to the customer (AI-drafted, staff-edited) ──
const messageSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

ticketRoutes.post("/:id/message", requireAuth, zValidator("json", messageSchema), async (c) => {
  const id = c.req.param("id");
  const { subject, body } = c.req.valid("json");
  const [ticket] = await db
    .select({ email: tickets.email, assignedTo: tickets.assignedTo })
    .from(tickets)
    .where(eq(tickets.ticketId, id));
  if (!ticket) fail(404, "Ticket not found");
  const user = c.get("user")!;
  if (user.role === "tech" && ticket.assignedTo !== user.name) {
    fail(403, "ส่งข้อความได้เฉพาะเคสที่ได้รับมอบหมาย / You can only message your assigned cases");
  }
  if (!ticket.email) fail(400, "เคสนี้ไม่มีอีเมลลูกค้า / No customer email on this case");
  if (!mailEnabled) fail(503, "อีเมลยังไม่ได้ตั้งค่า — ใช้ปุ่มคัดลอกแทน / Email is not configured");

  await sendMail(ticket.email, subject, customerMessageEmail(id, body));
  await logActivity(c.get("user"), "ticket.message", id, subject);
  return c.json({ sent: true });
});

// ── Admin: delete (re-auth) ─────────────────────────────
ticketRoutes.delete("/:id", requireAuth, adminReauth, async (c) => {
  const id = c.req.param("id");
  await db.delete(tickets).where(eq(tickets.ticketId, id));
  await logActivity(c.get("user"), "ticket.delete", id);
  return c.json({ deleted: id });
});
