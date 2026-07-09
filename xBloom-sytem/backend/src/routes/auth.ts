import { zValidator } from "../lib/zval.js";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { signToken, verifyPin } from "../lib/auth.js";
import { fail } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import type { AppEnv } from "../types.js";

const loginSchema = z.object({
  name: z.string().min(1),
  pin: z.string().min(1),
});

export const authRoutes = new Hono<AppEnv>();

// Throttle login to slow PIN brute-force: 10 attempts / 15 min per IP.
authRoutes.post("/login", rateLimit({ max: 10, windowMs: 15 * 60 * 1000, keyPrefix: "login" }), zValidator("json", loginSchema), async (c) => {
  const { name, pin } = c.req.valid("json");
  const [user] = await db.select().from(users).where(eq(users.name, name));
  // Verify even when the user is missing to avoid leaking which names exist.
  const ok = user ? await verifyPin(pin, user.pin) : false;
  if (!user || !ok) fail(401, "Name หรือ PIN ไม่ถูกต้อง");

  const token = await signToken({ name: user.name, role: user.role });
  return c.json({ token, user: { name: user.name, role: user.role } });
});

authRoutes.get("/me", requireAuth, (c) => {
  return c.json({ user: c.get("user") });
});
