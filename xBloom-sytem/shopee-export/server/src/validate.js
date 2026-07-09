import { z } from "zod";

// Coerce/shape the incoming payload. Numbers may arrive as strings, so we
// coerce; missing optional fields default sensibly.
const productSchema = z.object({
  name: z.string().default(""),
  sku: z.string().optional().default(""),
  qty: z.coerce.number().int().nonnegative().optional().default(1),
  unitPrice: z.coerce.number().nullable().optional(),
  subtotal: z.coerce.number().nullable().optional(),
});

export const orderSchema = z.object({
  orderNo: z.string().optional().default(""),
  orderDate: z.string().optional().default(""),
  buyerName: z.string().optional().default(""),
  trackingNo: z.string().optional().default(""),
  courier: z.string().optional().default(""),
  shipStatus: z.string().optional().default(""),
  address: z.string().optional().default(""),
  products: z.array(productSchema).optional().default([]),
  saleTotal: z.coerce.number().nullable().optional(),
  shippingFee: z.coerce.number().nullable().optional(),
  shopeeFee: z.coerce.number().nullable().optional(),
  commissionFee: z.coerce.number().nullable().optional(),
  netIncome: z.coerce.number().nullable().optional(),
  pageUrl: z.string().optional().default(""),
});

/**
 * Business validation with the exact user-facing Thai messages from the spec.
 * Returns { ok, order, errors }.
 */
export function validateOrder(raw) {
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, order: null, errors: ["รูปแบบข้อมูลไม่ถูกต้อง / Invalid payload shape"] };
  }
  const order = parsed.data;
  const errors = [];

  if (!order.orderNo.trim()) errors.push("ไม่พบหมายเลขคำสั่งซื้อ");
  if (!order.products.length || !order.products.some((p) => p.name.trim())) errors.push("ไม่พบข้อมูลสินค้า");
  if (!order.trackingNo.trim()) errors.push("ไม่พบ Tracking Number");
  if (order.netIncome == null || Number.isNaN(order.netIncome)) errors.push("ไม่พบข้อมูลรายรับสุทธิ");

  return { ok: errors.length === 0, order, errors };
}
