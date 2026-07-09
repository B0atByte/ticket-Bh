import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { type Role, verifyPin, verifyToken } from "../lib/auth.js";
import { fail } from "../lib/http.js";
import { clearFailures, lockRemaining, recordFailure } from "./rateLimit.js";
import type { AppEnv } from "../types.js";

function bearer(c: { req: { header: (n: string) => string | undefined } }): string | null {
  const h = c.req.header("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

/** Requires a valid JWT. Populates c.get("user"). */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = bearer(c);
  if (!token) fail(401, "Missing token");
  try {
    const payload = await verifyToken(token!);
    c.set("user", { name: payload.name, role: payload.role });
  } catch {
    fail(401, "Invalid or expired token");
  }
  await next();
});

/** Populates c.get("user") if a valid token is present, but never rejects. */
export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = bearer(c);
  if (token) {
    try {
      const payload = await verifyToken(token);
      c.set("user", { name: payload.name, role: payload.role });
    } catch {
      c.set("user", null);
    }
  } else {
    c.set("user", null);
  }
  await next();
});

/** Requires the authenticated user to hold one of the given roles. */
export function requireRole(...roles: Role[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    if (!user) fail(401, "Unauthenticated");
    if (!roles.includes(user!.role)) fail(403, "Insufficient permission");
    await next();
  });
}

/**
 * Management-area guard: admin or staff only. Blocks `tech` (field technicians,
 * who are scoped to their own assigned tickets) and `customer` from CRM,
 * warranties, assets, global claims, products, exports, Shopee, logs, etc.
 * Must run AFTER requireAuth (it reads c.get("user")).
 */
export const requireStaff = requireRole("admin", "staff");

/**
 * Admin re-authentication for destructive actions. The caller must already be
 * an admin (via requireAuth) AND re-supply their PIN in the `x-admin-pin`
 * header or `adminPin` body field. Defends against an unattended session.
 */
export const adminReauth = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user || user.role !== "admin") fail(403, "Admin only");

  // Lockout keyed on the admin username (not IP) so a stolen session can't
  // brute-force the short PIN by rotating source IPs.
  const lockKey = `adminpin:${user!.name}`;
  const locked = lockRemaining(lockKey);
  if (locked > 0) fail(429, `ใส่รหัสผิดหลายครั้ง ลองใหม่ใน ${locked} วินาที / Too many attempts, retry in ${locked}s`);

  let pin = c.req.header("x-admin-pin") ?? "";
  if (!pin) {
    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    pin = typeof body.adminPin === "string" ? body.adminPin : "";
  }
  if (!pin) fail(401, "Admin PIN required");

  const [row] = await db.select().from(users).where(eq(users.name, user!.name));
  if (!row || !(await verifyPin(pin, row.pin))) {
    recordFailure(lockKey, 5, 15 * 60_000); // lock for 15 min after 5 wrong PINs
    fail(401, "Admin PIN incorrect");
  }

  clearFailures(lockKey);
  await next();
});
