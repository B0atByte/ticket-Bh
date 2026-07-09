import { zValidator } from "../lib/zval.js";
import { and, desc, eq, like, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { interactions, machines, tickets, warranties } from "../db/schema.js";
import { logActivity } from "../lib/activity.js";
import { fail } from "../lib/http.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

export const crmRoutes = new Hono<AppEnv>();
crmRoutes.use("*", requireAuth);
crmRoutes.use("*", requireStaff); // CRM is a staff/admin tool — techs are scoped to their own tickets

/** Resolve a free-text query (serial / name / phone) to a single serial. */
async function resolveSerial(q: string): Promise<string | null> {
  const [exact] = await db.select({ s: machines.serial }).from(machines).where(eq(machines.serial, q));
  if (exact) return exact.s;

  const pat = `%${q}%`;
  const [m] = await db.select({ s: machines.serial }).from(machines).where(like(machines.serial, pat)).limit(1);
  if (m) return m.s;

  const [w] = await db
    .select({ s: warranties.serial })
    .from(warranties)
    .where(or(like(warranties.name, pat), like(warranties.phone, pat), like(warranties.serial, pat)))
    .orderBy(desc(warranties.registeredAt))
    .limit(1);
  if (w) return w.s;

  const [t] = await db
    .select({ s: tickets.serial })
    .from(tickets)
    .where(or(like(tickets.name, pat), like(tickets.phone, pat), like(tickets.ticketId, pat)))
    .orderBy(desc(tickets.createdAt))
    .limit(1);
  return t?.s ?? null;
}

// ── Aggregate customer view for the CRM ─────────────────
crmRoutes.get("/lookup", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (!q) fail(400, "กรุณากรอกคำค้นหา");

  const serial = await resolveSerial(q);
  if (!serial) fail(404, "No customer found");

  const [machine] = await db.select().from(machines).where(eq(machines.serial, serial!));
  const [warranty] = await db
    .select()
    .from(warranties)
    .where(eq(warranties.serial, serial!))
    .orderBy(desc(warranties.registeredAt))
    .limit(1);
  const ticketList = await db.select().from(tickets).where(eq(tickets.serial, serial!)).orderBy(desc(tickets.createdAt));
  const log = await db.select().from(interactions).where(eq(interactions.serial, serial!)).orderBy(desc(interactions.createdAt));

  return c.json({ found: true, serial, machine: machine ?? null, warranty: warranty ?? null, tickets: ticketList, interactions: log });
});

// ── Add a contact-log entry ─────────────────────────────
const interactionSchema = z.object({
  serial: z.string().min(1).max(100),
  staffName: z.string().max(100).optional(),
  channel: z.enum(["line", "phone", "store", "other"]).default("phone"),
  topic: z.string().min(1),
  status: z.enum(["ok", "wait", "open"]).default("wait"),
});

crmRoutes.post("/interaction", zValidator("json", interactionSchema), async (c) => {
  const body = c.req.valid("json");
  const [m] = await db.select({ s: machines.serial }).from(machines).where(eq(machines.serial, body.serial));
  if (!m) fail(404, "Machine not found");

  const user = c.get("user");
  await db.insert(interactions).values({
    serial: body.serial,
    staffName: body.staffName || user?.name || "staff",
    channel: body.channel,
    topic: body.topic,
    status: body.status,
  });
  await logActivity(user, "interaction.add", body.serial, `${body.channel} · ${body.status}`);
  return c.json({ ok: true }, 201);
});

// ── Claim decision: update the ticket's repair routing ──
const decisionSchema = z.object({
  decision: z.enum(["in", "out", "misuse", "none"]),
});
const DECISION_MAP = {
  in: { repairType: "warranty" as const, status: "approved", note: "อยู่ในประกัน — เคลม" },
  out: { repairType: "standard" as const, status: "quote", note: "นอกประกัน — มีค่าซ่อม" },
  misuse: { repairType: "standard" as const, status: "closed", note: "ลูกค้าใช้งานผิด — ปิดเคส" },
  none: { repairType: "standard" as const, status: "closed", note: "ไม่พบปัญหา — ปิดเคส" },
};

crmRoutes.patch("/ticket/:id/decision", zValidator("json", decisionSchema), async (c) => {
  const id = c.req.param("id");
  const { decision } = c.req.valid("json");
  const [t] = await db.select({ id: tickets.ticketId }).from(tickets).where(eq(tickets.ticketId, id));
  if (!t) fail(404, "Ticket not found");

  const d = DECISION_MAP[decision];
  await db.update(tickets).set({ repairType: d.repairType, status: d.status, warrantyCase: decision === "in" ? 1 : 0 }).where(eq(tickets.ticketId, id));
  await logActivity(c.get("user"), "ticket.decision", id, d.note);
  return c.json({ ticketId: id, ...d });
});
