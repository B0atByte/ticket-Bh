import { zValidator } from "../lib/zval.js";
import { asc, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { tickets, users } from "../db/schema.js";
import { logActivity } from "../lib/activity.js";
import { hashPin } from "../lib/auth.js";
import { fail } from "../lib/http.js";
import { adminReauth, requireAuth, requireRole, requireStaff } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

export const userRoutes = new Hono<AppEnv>();
userRoutes.use("*", requireAuth);
userRoutes.use("*", requireStaff);

// Staff directory (no PINs) — used for "assign to" dropdowns.
userRoutes.get("/", async (c) => {
  const rows = await db.select({ name: users.name, role: users.role }).from(users).orderBy(asc(users.name));
  return c.json({ data: rows, count: rows.length });
});

// ── Admin: create a staff account ───────────────────────
// Admin-only (re-uses requireRole after the requireStaff guard above). The PIN
// is bcrypt-hashed before storage and never returned. Role is limited to the
// loginable staff roles (customer is a non-login placeholder).
const createSchema = z.object({
  name: z.string().min(1).max(100),
  pin: z.string().min(4).max(100),
  role: z.enum(["admin", "staff", "tech"]),
});

userRoutes.post("/", requireRole("admin"), zValidator("json", createSchema), async (c) => {
  const body = c.req.valid("json");
  const name = body.name.trim();
  if (!name) fail(400, "ชื่อผู้ใช้ห้ามว่าง / Username required");

  const [existing] = await db.select({ name: users.name }).from(users).where(eq(users.name, name));
  if (existing) fail(409, "ชื่อผู้ใช้นี้มีอยู่แล้ว / Username already exists");

  await db.insert(users).values({ name, pin: await hashPin(body.pin), role: body.role });
  await logActivity(c.get("user"), "user.create", name, `role ${body.role}`);
  return c.json({ name, role: body.role }, 201);
});

// ── Admin: update role and/or reset PIN (admin re-auth) ─
const updateSchema = z
  .object({
    pin: z.string().min(4).max(100).optional(),
    role: z.enum(["admin", "staff", "tech"]).optional(),
  })
  .refine((o) => o.pin !== undefined || o.role !== undefined, "ไม่มีข้อมูลให้แก้ไข");

userRoutes.patch("/:name", adminReauth, zValidator("json", updateSchema), async (c) => {
  const name = c.req.param("name");
  const patch = c.req.valid("json");
  const actor = c.get("user")!;

  const [target] = await db.select().from(users).where(eq(users.name, name));
  if (!target) fail(404, "ไม่พบผู้ใช้ / User not found");

  if (patch.role && patch.role !== target.role) {
    // Lockout guards: can't demote yourself, and one admin must always remain.
    if (name === actor.name) fail(409, "เปลี่ยนบทบาทตัวเองไม่ได้ / You cannot change your own role");
    if (target.role === "admin") {
      const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.role, "admin"));
      if (n <= 1) fail(409, "ต้องมีแอดมินอย่างน้อย 1 คน / At least one admin is required");
    }
  }

  const set: Partial<typeof users.$inferInsert> = {};
  if (patch.role) set.role = patch.role;
  if (patch.pin) set.pin = await hashPin(patch.pin);
  await db.update(users).set(set).where(eq(users.name, name));
  await logActivity(actor, "user.update", name, Object.keys(patch).join(", "));
  return c.json({ name, updated: Object.keys(patch) });
});

// ── Admin: delete a user (admin re-auth) ────────────────
userRoutes.delete("/:name", adminReauth, async (c) => {
  const name = c.req.param("name");
  const actor = c.get("user")!;
  if (name === actor.name) fail(409, "ลบบัญชีตัวเองไม่ได้ / You cannot delete your own account");

  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.name, name));
  if (!target) fail(404, "ไม่พบผู้ใช้ / User not found");

  if (target.role === "admin") {
    const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.role, "admin"));
    if (n <= 1) fail(409, "ต้องมีแอดมินอย่างน้อย 1 คน / At least one admin is required");
  }

  // tickets.assignedTo has an FK to users.name — block while cases reference them.
  const [assigned] = await db.select({ id: tickets.ticketId }).from(tickets).where(eq(tickets.assignedTo, name)).limit(1);
  if (assigned) fail(409, "ลบไม่ได้: ผู้ใช้นี้มีเคสที่รับผิดชอบอยู่ — โอนเคสก่อน / User has assigned cases; reassign first");

  await db.delete(users).where(eq(users.name, name));
  await logActivity(actor, "user.delete", name);
  return c.json({ deleted: name });
});
