import { zValidator } from "../lib/zval.js";
import { and, desc, eq, isNotNull, like } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { machines, tickets } from "../db/schema.js";
import { logActivity } from "../lib/activity.js";
import { fail } from "../lib/http.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

const gcStatus = z.enum(["awaiting", "accepted", "rejected"]);

export const globalClaimRoutes = new Hono<AppEnv>();
globalClaimRoutes.use("*", requireAuth);
globalClaimRoutes.use("*", requireStaff);

// ── List (filter by month on createdAt + status) ────────
const listQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "ต้องเป็นรูปแบบ YYYY-MM").optional(),
  status: gcStatus.optional(),
});

globalClaimRoutes.get("/", zValidator("query", listQuery), async (c) => {
  const { month, status } = c.req.valid("query");
  const conds = [isNotNull(tickets.globalClaimStatus)];
  if (status) conds.push(eq(tickets.globalClaimStatus, status));
  if (month) conds.push(like(tickets.createdAt, `${month}%`));
  const rows = await db
    .select()
    .from(tickets)
    .where(and(...conds))
    .orderBy(desc(tickets.createdAt));
  return c.json({ data: rows, count: rows.length });
});

// ── Update claim status / machines / lot ────────────────
const patchSchema = z
  .object({
    globalClaimStatus: gcStatus.optional(),
    gcOldMachine: z.string().max(100).nullable().optional(),
    gcNewMachine: z.string().max(100).nullable().optional(),
    gcLot: z.string().max(100).nullable().optional(),
    globalClaimNote: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "ไม่มีข้อมูลให้แก้ไข");

globalClaimRoutes.patch("/:ticketId", zValidator("json", patchSchema), async (c) => {
  const id = c.req.param("ticketId");
  const patch = c.req.valid("json");
  const [t] = await db.select({ id: tickets.ticketId }).from(tickets).where(eq(tickets.ticketId, id));
  if (!t) fail(404, "Ticket not found");

  await db.update(tickets).set(patch).where(eq(tickets.ticketId, id));
  await logActivity(c.get("user"), "global_claim.update", id, JSON.stringify(patch));
  return c.json({ ticketId: id, updated: Object.keys(patch) });
});

// ── Create backdated case ───────────────────────────────
const backdatedSchema = z.object({
  ticketId: z.string().min(1).max(50),
  serial: z.string().min(1).max(100),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/, "วันที่ไม่ถูกต้อง"),
  globalClaimStatus: gcStatus.default("awaiting"),
  gcOldMachine: z.string().max(100).optional(),
  gcNewMachine: z.string().max(100).optional(),
  gcLot: z.string().max(100).optional(),
  globalClaimNote: z.string().optional(),
  issueType: z.string().max(100).optional(),
  description: z.string().optional(),
});

globalClaimRoutes.post("/backdated", zValidator("json", backdatedSchema), async (c) => {
  const body = c.req.valid("json");
  const [clash] = await db.select({ id: tickets.ticketId }).from(tickets).where(eq(tickets.ticketId, body.ticketId));
  if (clash) fail(409, "Ticket ID นี้มีอยู่แล้ว");

  const [machine] = await db.select({ serial: machines.serial }).from(machines).where(eq(machines.serial, body.serial));
  if (!machine) {
    await db.insert(machines).values({ serial: body.serial, status: "claim", source: "global_claim_backdated" });
  }

  const createdAt = body.createdAt.includes(":") ? body.createdAt.replace("T", " ") : `${body.createdAt} 00:00:00`;
  await db.insert(tickets).values({
    ticketId: body.ticketId,
    serial: body.serial,
    createdAt,
    issueType: body.issueType ?? "global_claim",
    description: body.description,
    repairType: "repair_claim",
    status: "closed",
    warrantyCase: 1,
    globalClaimStatus: body.globalClaimStatus,
    gcOldMachine: body.gcOldMachine,
    gcNewMachine: body.gcNewMachine,
    gcLot: body.gcLot,
    globalClaimNote: body.globalClaimNote,
  });

  await logActivity(c.get("user"), "global_claim.backdated", body.ticketId, `serial ${body.serial}`);
  return c.json({ ticketId: body.ticketId }, 201);
});
