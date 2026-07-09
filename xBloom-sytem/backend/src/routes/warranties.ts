import { zValidator } from "../lib/zval.js";
import { and, desc, eq, like, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { machines, warranties } from "../db/schema.js";
import { logActivity } from "../lib/activity.js";
import { sendMail, warrantyEmail } from "../lib/mailer.js";
import { addYears, fail, isSafeUrl } from "../lib/http.js";
import { adminReauth, requireAuth, requireStaff } from "../middleware/auth.js";
import { clearFailures, lockRemaining, rateLimit, recordFailure } from "../middleware/rateLimit.js";
import type { AppEnv } from "../types.js";

/** xBloom warranty term in years. */
export const WARRANTY_YEARS = 2;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ต้องเป็นรูปแบบ YYYY-MM-DD");

const registerSchema = z.object({
  serial: z.string().min(1).max(100),
  product: z.string().min(1).max(191),
  company: z.string().max(191).optional(),
  purchaseDate: dateStr,
  name: z.string().min(1).max(191),
  phone: z.string().min(1).max(30),
  email: z.string().email().max(191).optional().or(z.literal("")),
  postal: z.string().max(10).optional(),
  houseNo: z.string().max(100).optional(),
  building: z.string().max(191).optional(),
  subdistrict: z.string().max(191).optional(),
  district: z.string().max(191).optional(),
  province: z.string().max(191).optional(),
  address: z.string().optional(),
  receiptName: z.string().max(191).optional(),
  // Accepts an absolute http(s) URL (Drive) or our own upload path; rejects
  // javascript:/data: schemes to prevent stored XSS when staff open the receipt.
  receiptDriveUrl: z.string().max(512).optional().or(z.literal("")).refine((v) => isSafeUrl(v), "ลิงก์ไม่ปลอดภัย / Unsafe link"),
});

// Public endpoints mounted at root: POST /register, GET /coverage/:serial
export const publicWarrantyRoutes = new Hono<AppEnv>();
// Staff endpoints mounted at /warranties (admin/staff only — techs are blocked)
export const warrantyRoutes = new Hono<AppEnv>();
warrantyRoutes.use("*", requireAuth);
warrantyRoutes.use("*", requireStaff);

// ── Public: register a warranty ─────────────────────────
publicWarrantyRoutes.post("/register", rateLimit({ max: 6, windowMs: 60_000, keyPrefix: "register" }), zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");

  const [existing] = await db
    .select({ id: warranties.id })
    .from(warranties)
    .where(and(eq(warranties.serial, body.serial), eq(warranties.type, "normal")));
  if (existing) fail(409, "Serial นี้ลงทะเบียนประกันแล้ว");

  // xBloom warranty is 2 years from the purchase date.
  const expiryDate = addYears(body.purchaseDate, WARRANTY_YEARS);
  const id = randomUUID();

  // Machine + warranty are created atomically so a partial write can't happen.
  await db.transaction(async (tx) => {
    const [machine] = await tx.select({ serial: machines.serial }).from(machines).where(eq(machines.serial, body.serial));
    if (!machine) {
      await tx.insert(machines).values({
        serial: body.serial,
        product: body.product,
        customerName: body.name,
        status: "active",
        source: "warranty",
        assetType: "store",
        warrantyStart: body.purchaseDate,
        warrantyEnd: expiryDate,
        noWarranty: 0,
      });
    }
    await tx.insert(warranties).values({
      id,
      serial: body.serial,
      product: body.product,
      company: body.company,
      purchaseDate: body.purchaseDate,
      expiryDate,
      name: body.name,
      phone: body.phone,
      email: body.email || null,
      postal: body.postal,
      houseNo: body.houseNo,
      building: body.building,
      subdistrict: body.subdistrict,
      district: body.district,
      province: body.province,
      address: body.address,
      receiptName: body.receiptName,
      receiptDriveUrl: body.receiptDriveUrl || null,
      status: "active",
      type: "normal",
    });
  });

  await logActivity(null, "warranty.register", body.serial, `expiry ${expiryDate} · consent`);
  void sendMail(body.email, "ลงทะเบียนรับประกัน xBloom สำเร็จ / Warranty registered", warrantyEmail(body.name, body.serial, body.product, expiryDate));
  return c.json({ id, serial: body.serial, expiryDate }, 201);
});

// ── Public: check coverage by serial ────────────────────
publicWarrantyRoutes.get("/coverage/:serial", rateLimit({ max: 40, windowMs: 60_000, keyPrefix: "coverage" }), async (c) => {
  const serial = c.req.param("serial");

  const [warranty] = await db
    .select()
    .from(warranties)
    .where(eq(warranties.serial, serial))
    .orderBy(desc(warranties.registeredAt))
    .limit(1);
  const [machine] = await db.select().from(machines).where(eq(machines.serial, serial));

  if (!warranty && !machine) fail(404, "No record found");

  const expiryDate = warranty?.expiryDate ?? machine?.warrantyEnd ?? null;
  const noWarranty = machine?.noWarranty === 1;
  const active = !noWarranty && !!expiryDate && expiryDate >= new Date().toISOString().slice(0, 10);

  return c.json({
    found: true,
    serial,
    product: warranty?.product ?? machine?.product ?? null,
    warrantyStart: warranty?.purchaseDate ?? machine?.warrantyStart ?? null,
    expiryDate,
    active,
    noWarranty,
  });
});

// ── Public: prefill the report form from the registered owner ──
// Privacy-gated: by default returns only a masked phone hint. Full contact
// details are released only when the caller proves ownership by passing the
// last 4 digits of the registered phone (?verify=XXXX). Rate-limited to deter
// guessing the serial and/or the 4-digit code.
const onlyDigits = (s: string) => s.replace(/\D/g, "");
/** Mask a phone, hiding the last 4 digits used as the verification code. */
function maskPhone(phone: string | null): string {
  const d = onlyDigits(phone ?? "");
  if (d.length < 4) return "xxxx";
  return `${d.slice(0, 3)}-xxx-xxxx`;
}

publicWarrantyRoutes.get(
  "/coverage/:serial/contact",
  rateLimit({ max: 20, windowMs: 60_000, keyPrefix: "prefill" }),
  async (c) => {
    const serial = c.req.param("serial");
    const verify = c.req.query("verify");
    // Per-serial lockout: brute-forcing the 4-digit code is throttled by the
    // target serial (not the request IP), so rotating IPs/headers can't bypass it.
    const lockKey = `verify:${serial}`;
    const locked = lockRemaining(lockKey);
    if (locked > 0) fail(429, `ลองยืนยันผิดหลายครั้ง ลองใหม่ใน ${locked} วินาที / Too many attempts, retry in ${locked}s`);
    const [warranty] = await db
      .select({ product: warranties.product, name: warranties.name, phone: warranties.phone, email: warranties.email })
      .from(warranties)
      .where(eq(warranties.serial, serial))
      .orderBy(desc(warranties.registeredAt))
      .limit(1);
    const [machine] = await db
      .select({ product: machines.product, customerName: machines.customerName })
      .from(machines)
      .where(eq(machines.serial, serial));

    if (!warranty && !machine) return c.json({ found: false });

    const name = warranty?.name ?? machine?.customerName ?? null;
    const phone = warranty?.phone ?? null;
    const email = warranty?.email ?? null;
    const product = warranty?.product ?? machine?.product ?? null;
    const last4 = phone ? onlyDigits(phone).slice(-4) : null;
    const hasContact = !!(name || phone || email);

    // Ownership can only be proven against a registered phone number.
    if (!hasContact || !last4) return c.json({ found: true, product, hasContact, needsVerify: false });

    if (verify !== undefined) {
      if (onlyDigits(verify).slice(-4) === last4) {
        clearFailures(lockKey);
        return c.json({ found: true, hasContact: true, verified: true, serial, product, name, phone, email });
      }
      // Lock the serial after 5 wrong codes for 15 minutes.
      recordFailure(lockKey, 5, 15 * 60_000);
      return c.json({ found: true, hasContact: true, verified: false, needsVerify: true });
    }

    // No proof yet — reveal only a masked hint.
    return c.json({ found: true, hasContact: true, needsVerify: true, verified: false, product, phoneHint: maskPhone(phone) });
  },
);

// ── Staff: list warranties (filter + search) ────────────
const listQuery = z.object({
  type: z.enum(["normal", "replacement"]).optional(),
  status: z.string().optional(),
  q: z.string().optional(),
});

warrantyRoutes.get("/", requireAuth, zValidator("query", listQuery), async (c) => {
  const { type, status, q } = c.req.valid("query");
  const conds = [];
  if (type) conds.push(eq(warranties.type, type));
  if (status) conds.push(eq(warranties.status, status));
  if (q) {
    const pat = `%${q}%`;
    conds.push(
      or(like(warranties.serial, pat), like(warranties.name, pat), like(warranties.phone, pat))!,
    );
  }
  const rows = await db
    .select()
    .from(warranties)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(warranties.registeredAt));
  return c.json({ data: rows, count: rows.length });
});

// ── Admin: delete one / clear all (re-auth) ─────────────
warrantyRoutes.delete("/:id", requireAuth, adminReauth, async (c) => {
  const id = c.req.param("id");
  await db.delete(warranties).where(eq(warranties.id, id));
  await logActivity(c.get("user"), "warranty.delete", id);
  return c.json({ deleted: id });
});

warrantyRoutes.delete("/", requireAuth, adminReauth, async (c) => {
  await db.delete(warranties);
  await logActivity(c.get("user"), "warranty.clear_all", "warranties");
  return c.json({ cleared: true });
});
