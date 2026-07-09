import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.js";
import { shopeeOrders } from "../db/schema.js";
import { logActivity } from "../lib/activity.js";
import { fail } from "../lib/http.js";
import { deriveOrderFields, validateOrder, type ShopeeOrder } from "../lib/shopee/validate.js";
import { appendRow, ensureSheetReady, SHEET_HEADER, sheetUrl } from "../lib/shopee/sheets.js";
import { uploadScreenshot } from "../lib/shopee/drive.js";
import { adminReauth, requireAuth, requireStaff } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { env, shopeeSheetEnabled } from "../env.js";
import type { AppEnv } from "../types.js";

export const shopeeRoutes = new Hono<AppEnv>();

// ── POST /shopee/orders — receives a scraped order from the browser extension ──
// Public (the extension holds no JWT); optionally gated by a shared SHOPEE_API_KEY.
// The order always lands in MySQL; Google Sheet/Drive are best-effort mirrors.

let sheetReady: Promise<void> | null = null;
const ensureSheet = () => (sheetReady ||= ensureSheetReady());

/** Build the sheet row (SHEET_HEADER order) from a validated order. */
function toSheetRow(order: ShopeeOrder, screenshotUrl: string): (string | number)[] {
  const { productName, qty, salePrice } = deriveOrderFields(order);
  return [
    order.orderNo,
    order.orderDate,
    order.buyerName,
    order.trackingNo,
    order.courier,
    productName,
    qty,
    salePrice ?? "",
    order.netIncome ?? "",
    order.address,
    screenshotUrl || "",
    new Date().toISOString(),
  ];
}

shopeeRoutes.post("/orders", rateLimit({ max: 30, windowMs: 60_000, keyPrefix: "shopee" }), async (c) => {
  // Optional shared-secret check.
  if (env.SHOPEE.apiKey && c.req.header("x-api-key") !== env.SHOPEE.apiKey) {
    fail(401, "unauthorized");
  }

  const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const { ok, order, errors } = validateOrder(body?.order);
  if (!ok || !order) {
    return c.json({ error: errors.join(" · "), errors }, 422);
  }

  // Duplicate guard (DB is the source of truth).
  const [dup] = await db
    .select({ id: shopeeOrders.id })
    .from(shopeeOrders)
    .where(eq(shopeeOrders.orderNo, order.orderNo.trim()));
  if (dup) {
    return c.json({ status: "duplicate", message: "ออเดอร์นี้ถูกบันทึกแล้ว" });
  }

  // Best-effort screenshot upload to Drive (only when Google is configured).
  // Cap the base64 payload (~9MB) to avoid memory-abuse via the public endpoint.
  let screenshot = typeof body?.screenshot === "string" ? (body.screenshot as string) : "";
  if (screenshot.length > 12_000_000) screenshot = "";
  let screenshotUrl = "";
  if (screenshot && shopeeSheetEnabled()) {
    try {
      screenshotUrl = (await uploadScreenshot(order.orderNo.trim(), screenshot)) ?? "";
    } catch (e) {
      console.error("[shopee] screenshot upload failed (continuing):", (e as Error)?.message);
    }
  }

  // Best-effort Google Sheet append (never blocks the DB write).
  let mirroredToSheet = false;
  if (shopeeSheetEnabled()) {
    try {
      await ensureSheet();
      await appendRow(toSheetRow(order, screenshotUrl));
      mirroredToSheet = true;
    } catch (e) {
      sheetReady = null; // re-run setup next time
      console.error("[shopee] sheet append failed (saved to DB anyway):", (e as Error)?.message);
    }
  }

  // Persist to MySQL — the authoritative record.
  const { productName, qty, salePrice } = deriveOrderFields(order);
  await db.insert(shopeeOrders).values({
    orderNo: order.orderNo.trim(),
    orderDate: order.orderDate || null,
    buyerName: order.buyerName || null,
    trackingNo: order.trackingNo || null,
    courier: order.courier || null,
    productName: productName || null,
    qty: qty || null,
    salePrice: salePrice != null ? String(salePrice) : null,
    netIncome: order.netIncome != null ? String(order.netIncome) : null,
    address: order.address || null,
    screenshotUrl: screenshotUrl || null,
    sheetUrl: mirroredToSheet ? sheetUrl() : null,
    pageUrl: order.pageUrl || null,
    rawJson: JSON.stringify(order),
  });

  await logActivity(null, "shopee.export", order.orderNo.trim(), mirroredToSheet ? "db+sheet" : "db");
  return c.json({ status: "created", mirroredToSheet, screenshotUrl }, 201);
});

// ── Staff-only views ─────────────────────────────────────
shopeeRoutes.get("/orders", requireAuth, requireStaff, async (c) => {
  const rows = await db.select().from(shopeeOrders).orderBy(desc(shopeeOrders.savedAt));
  return c.json({ data: rows, count: rows.length });
});

shopeeRoutes.get("/status", requireAuth, requireStaff, (c) => {
  const enabled = shopeeSheetEnabled();
  return c.json({
    sheetEnabled: enabled,
    sheetTab: env.SHOPEE.sheetTab,
    driveEnabled: enabled,
    apiKeyRequired: Boolean(env.SHOPEE.apiKey),
    sheetUrl: enabled ? sheetUrl() : null,
    header: SHEET_HEADER,
  });
});

shopeeRoutes.delete("/orders/:id", requireAuth, adminReauth, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) fail(400, "id ไม่ถูกต้อง");
  await db.delete(shopeeOrders).where(eq(shopeeOrders.id, id));
  await logActivity(c.get("user"), "shopee.delete", String(id));
  return c.json({ deleted: id });
});
