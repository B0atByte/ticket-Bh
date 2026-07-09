import { Router } from "express";
import { config } from "../config.js";
import { validateOrder } from "../validate.js";
import { ensureSheetReady, orderExists, appendRow } from "../sheets.js";
import { uploadScreenshot } from "../drive.js";
import { log } from "../logger.js";

export const ordersRouter = Router();

// Ensure the sheet/header exists exactly once (memoised promise).
let readyPromise = null;
const ready = () => (readyPromise ||= ensureSheetReady());

/** Optional shared-secret auth. */
function checkAuth(req) {
  if (!config.apiKey) return true;
  return req.get("x-api-key") === config.apiKey;
}

/** Build the sheet row (in SHEET_HEADER order) from a validated order. */
function toRow(order, screenshotUrl) {
  const productName = order.products.map((p) => p.name).filter(Boolean).join(" | ");
  const qty = order.products.reduce((s, p) => s + (p.qty || 0), 0) || order.products.length;
  const salePrice =
    order.saleTotal != null
      ? order.saleTotal
      : order.products.reduce((s, p) => s + (p.subtotal || 0), 0) || "";
  return [
    order.orderNo,
    order.orderDate,
    order.buyerName,
    order.trackingNo,
    order.courier,
    productName,
    qty,
    salePrice,
    order.netIncome ?? "",
    order.address,
    screenshotUrl || "",
    new Date().toISOString(),
  ];
}

ordersRouter.post("/orders", async (req, res) => {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  // 1) validate
  const { ok, order, errors } = validateOrder(req.body?.order);
  if (!ok) {
    log.warn("validation failed", { errors });
    return res.status(422).json({ error: errors.join(" · "), errors });
  }
  log.info("order received", { orderNo: order.orderNo, products: order.products.length });

  try {
    await ready();

    // 2) duplicate guard
    if (await orderExists(order.orderNo)) {
      log.info("duplicate skipped", { orderNo: order.orderNo });
      return res.json({ status: "duplicate", message: "ออเดอร์นี้ถูกบันทึกแล้ว" });
    }

    // 3) screenshot (best-effort — never blocks the row)
    let screenshotUrl = "";
    if (req.body?.screenshot) {
      try {
        screenshotUrl = (await uploadScreenshot(order.orderNo, req.body.screenshot)) || "";
        log.info("screenshot uploaded", { orderNo: order.orderNo });
      } catch (e) {
        log.error("screenshot upload failed (continuing)", { orderNo: order.orderNo, reason: e?.message });
      }
    }

    // 4) append
    await appendRow(toRow(order, screenshotUrl));
    log.info("row appended", { orderNo: order.orderNo });

    return res.status(201).json({ status: "created", screenshotUrl });
  } catch (e) {
    log.error("export failed", { orderNo: order.orderNo, reason: e?.message });
    return res.status(502).json({ error: "บันทึกลง Google ไม่สำเร็จ / Failed to write to Google" });
  }
});
