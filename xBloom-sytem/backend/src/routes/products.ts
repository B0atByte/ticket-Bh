import { zValidator } from "../lib/zval.js";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { products } from "../db/schema.js";
import { logActivity } from "../lib/activity.js";
import { fail } from "../lib/http.js";
import { adminReauth, requireAuth, requireRole, requireStaff } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

export const productRoutes = new Hono<AppEnv>();
productRoutes.use("*", requireAuth);
productRoutes.use("*", requireStaff);

productRoutes.get("/", async (c) => {
  const rows = await db.select().from(products).orderBy(asc(products.name));
  return c.json({ data: rows, count: rows.length });
});

const createSchema = z.object({
  name: z.string().min(1).max(191),
  code: z.string().max(100).optional(),
  description: z.string().optional(),
  active: z.union([z.literal(0), z.literal(1)]).optional(),
});

productRoutes.post("/", requireRole("admin", "staff"), zValidator("json", createSchema), async (c) => {
  const body = c.req.valid("json");
  const [clash] = await db.select({ id: products.id }).from(products).where(eq(products.name, body.name));
  if (clash) fail(409, "ชื่อรุ่นสินค้านี้มีอยู่แล้ว");

  const [res] = await db.insert(products).values({ ...body, active: body.active ?? 1 }).$returningId();
  await logActivity(c.get("user"), "product.create", body.name);
  return c.json({ id: res.id, name: body.name }, 201);
});

const updateSchema = z
  .object({
    name: z.string().min(1).max(191).optional(),
    code: z.string().max(100).nullable().optional(),
    description: z.string().nullable().optional(),
    active: z.union([z.literal(0), z.literal(1)]).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "ไม่มีข้อมูลให้แก้ไข");

productRoutes.patch("/:id", requireRole("admin", "staff"), zValidator("json", updateSchema), async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) fail(400, "id ไม่ถูกต้อง");
  const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.id, id));
  if (!existing) fail(404, "Product not found");

  await db.update(products).set(c.req.valid("json")).where(eq(products.id, id));
  await logActivity(c.get("user"), "product.update", String(id));
  return c.json({ id });
});

productRoutes.delete("/:id", adminReauth, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) fail(400, "id ไม่ถูกต้อง");
  await db.delete(products).where(eq(products.id, id));
  await logActivity(c.get("user"), "product.delete", String(id));
  return c.json({ deleted: id });
});
