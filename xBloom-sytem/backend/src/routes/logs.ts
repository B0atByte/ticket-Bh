import { zValidator } from "../lib/zval.js";
import { and, desc, eq, like, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { activityLog } from "../db/schema.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

export const logRoutes = new Hono<AppEnv>();
logRoutes.use("*", requireAuth);
logRoutes.use("*", requireStaff);

const query = z.object({
  q: z.string().optional(),
  action: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

logRoutes.get("/", zValidator("query", query), async (c) => {
  const { q, action, limit } = c.req.valid("query");
  const conds = [];
  if (action) conds.push(eq(activityLog.action, action));
  if (q) {
    const pat = `%${q}%`;
    conds.push(or(like(activityLog.userName, pat), like(activityLog.target, pat), like(activityLog.detail, pat))!);
  }
  const rows = await db
    .select()
    .from(activityLog)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(activityLog.timestamp))
    .limit(limit);
  return c.json({ data: rows, count: rows.length });
});
