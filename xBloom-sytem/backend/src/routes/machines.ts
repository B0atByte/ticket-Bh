import { zValidator } from "../lib/zval.js";
import { and, desc, eq, like, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { interactions, machines, tickets, warranties } from "../db/schema.js";
import { logActivity } from "../lib/activity.js";
import { fail } from "../lib/http.js";
import { adminReauth, requireAuth, requireStaff } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const assetType = z.enum(["store", "claim_fixed", "subscription"]);

const baseFields = {
  product: z.string().max(191).optional(),
  newSerial: z.string().max(100).optional(),
  customerName: z.string().max(191).optional(),
  status: z.string().max(50).optional(),
  notes: z.string().optional(),
  source: z.string().max(100).optional(),
  globalStatus: z.string().max(50).optional(),
  assetType: assetType.optional(),
  subscriptionSource: z.string().max(191).optional(),
  warrantyStart: dateStr.optional(),
  warrantyEnd: dateStr.optional(),
  location: z.string().max(191).optional(),
  noWarranty: z.union([z.literal(0), z.literal(1)]).optional(),
};

const createSchema = z.object({ serial: z.string().min(1).max(100), ...baseFields });
const updateSchema = z.object(baseFields).refine((o) => Object.keys(o).length > 0, "ไม่มีข้อมูลให้แก้ไข");

export const machineRoutes = new Hono<AppEnv>();

machineRoutes.use("*", requireAuth);
machineRoutes.use("*", requireStaff);

// ── List (filter by asset type, status, search) ─────────
const listQuery = z.object({
  assetType: assetType.optional(),
  status: z.string().optional(),
  q: z.string().optional(),
});

machineRoutes.get("/", zValidator("query", listQuery), async (c) => {
  const { assetType: at, status, q } = c.req.valid("query");
  const conds = [];
  if (at) conds.push(eq(machines.assetType, at));
  if (status) conds.push(eq(machines.status, status));
  if (q) {
    const pat = `%${q}%`;
    conds.push(or(like(machines.serial, pat), like(machines.customerName, pat), like(machines.product, pat))!);
  }
  const rows = await db
    .select()
    .from(machines)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(machines.updatedAt));
  return c.json({ data: rows, count: rows.length });
});

// ── Detail ──────────────────────────────────────────────
machineRoutes.get("/:serial", async (c) => {
  const serial = c.req.param("serial");
  const [machine] = await db.select().from(machines).where(eq(machines.serial, serial));
  if (!machine) fail(404, "Machine not found");
  return c.json(machine);
});

// ── History for a serial (warranties + tickets) ─────────
machineRoutes.get("/:serial/history", async (c) => {
  const serial = c.req.param("serial");
  const [machine] = await db.select().from(machines).where(eq(machines.serial, serial));
  if (!machine) fail(404, "Machine not found");

  const [w, t] = await Promise.all([
    db.select().from(warranties).where(eq(warranties.serial, serial)).orderBy(desc(warranties.registeredAt)),
    db.select().from(tickets).where(eq(tickets.serial, serial)).orderBy(desc(tickets.createdAt)),
  ]);
  return c.json({ machine, warranties: w, tickets: t });
});

// ── Create ──────────────────────────────────────────────
machineRoutes.post("/", zValidator("json", createSchema), async (c) => {
  const body = c.req.valid("json");
  const [existing] = await db.select({ serial: machines.serial }).from(machines).where(eq(machines.serial, body.serial));
  if (existing) fail(409, "Serial นี้มีอยู่แล้ว");

  await db.insert(machines).values({ ...body, noWarranty: body.noWarranty ?? 0 });
  await logActivity(c.get("user"), "machine.create", body.serial);
  return c.json({ serial: body.serial }, 201);
});

// ── Update ──────────────────────────────────────────────
machineRoutes.patch("/:serial", zValidator("json", updateSchema), async (c) => {
  const serial = c.req.param("serial");
  const patch = c.req.valid("json");
  const [existing] = await db.select({ serial: machines.serial }).from(machines).where(eq(machines.serial, serial));
  if (!existing) fail(404, "Machine not found");

  await db.update(machines).set(patch).where(eq(machines.serial, serial));
  await logActivity(c.get("user"), "machine.update", serial, Object.keys(patch).join(", "));
  return c.json({ serial, updated: Object.keys(patch) });
});

// ── Replace machine (claim workflow) ────────────────────
// Creates the replacement unit, links it back to the original, and marks the
// original as a post-claim repair unit (noWarranty = 1). Atomic.
const replaceSchema = z.object({
  newSerial: z.string().min(1).max(100),
  product: z.string().max(191).optional(),
  customerName: z.string().max(191).optional(),
  warrantyStart: dateStr.optional(),
  warrantyEnd: dateStr.optional(),
  note: z.string().optional(),
});

machineRoutes.post("/:serial/replace", zValidator("json", replaceSchema), async (c) => {
  const serial = c.req.param("serial");
  const body = c.req.valid("json");
  if (body.newSerial === serial) fail(400, "newSerial ต้องไม่ซ้ำกับเครื่องเดิม");

  const [old] = await db.select().from(machines).where(eq(machines.serial, serial));
  if (!old) fail(404, "Machine not found");
  const [clash] = await db.select({ serial: machines.serial }).from(machines).where(eq(machines.serial, body.newSerial));
  if (clash) fail(409, "newSerial นี้มีอยู่แล้ว");

  await db.transaction(async (tx) => {
    // 1. Create the replacement unit.
    await tx.insert(machines).values({
      serial: body.newSerial,
      product: body.product ?? old.product,
      customerName: body.customerName ?? old.customerName,
      status: "active",
      source: "replacement",
      assetType: old.assetType ?? "store",
      warrantyStart: body.warrantyStart,
      warrantyEnd: body.warrantyEnd,
      noWarranty: 0,
    });

    // 2. Mark the original as a post-claim repair unit (no warranty).
    await tx
      .update(machines)
      .set({ newSerial: body.newSerial, noWarranty: 1, status: "replaced", globalStatus: old.globalStatus })
      .where(eq(machines.serial, serial));

    // 3. Carry the customer over to a replacement warranty linked to the original.
    const [prev] = await tx.select().from(warranties).where(eq(warranties.serial, serial)).orderBy(desc(warranties.registeredAt)).limit(1);
    await tx.insert(warranties).values({
      id: randomUUID(),
      serial: body.newSerial,
      product: body.product ?? prev?.product ?? old.product,
      company: prev?.company,
      purchaseDate: body.warrantyStart ?? prev?.purchaseDate,
      expiryDate: body.warrantyEnd ?? prev?.expiryDate,
      name: body.customerName ?? prev?.name ?? old.customerName,
      phone: prev?.phone,
      email: prev?.email,
      postal: prev?.postal,
      houseNo: prev?.houseNo,
      building: prev?.building,
      subdistrict: prev?.subdistrict,
      district: prev?.district,
      province: prev?.province,
      address: prev?.address,
      status: "active",
      type: "replacement",
      replacementOf: serial,
    });
  });

  await logActivity(c.get("user"), "machine.replace", serial, `→ ${body.newSerial}${body.note ? ` (${body.note})` : ""}`);
  return c.json({ oldSerial: serial, newSerial: body.newSerial }, 201);
});

// ── Delete (admin re-auth) ──────────────────────────────
machineRoutes.delete("/:serial", adminReauth, async (c) => {
  const serial = c.req.param("serial");
  // Block delete when child rows reference this serial (FK safety).
  const [w] = await db.select({ id: warranties.id }).from(warranties).where(eq(warranties.serial, serial)).limit(1);
  const [t] = await db.select({ id: tickets.ticketId }).from(tickets).where(eq(tickets.serial, serial)).limit(1);
  const [i] = await db.select({ id: interactions.id }).from(interactions).where(eq(interactions.serial, serial)).limit(1);
  if (w || t || i) fail(409, "ลบไม่ได้: มีประกัน/เคส/ประวัติการติดต่ออ้างอิงเครื่องนี้อยู่");

  await db.delete(machines).where(eq(machines.serial, serial));
  await logActivity(c.get("user"), "machine.delete", serial);
  return c.json({ deleted: serial });
});
