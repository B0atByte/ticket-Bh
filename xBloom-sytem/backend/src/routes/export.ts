import { zValidator } from "../lib/zval.js";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { machines, tickets, warranties } from "../db/schema.js";
import { logActivity } from "../lib/activity.js";
import { toCsv } from "../lib/http.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { today } from "../lib/http.js";
import type { AppEnv } from "../types.js";

export const exportRoutes = new Hono<AppEnv>();
exportRoutes.use("*", requireAuth);
exportRoutes.use("*", requireStaff);

const query = z.object({ type: z.enum(["warranties", "tickets", "assets"]) });

exportRoutes.get("/csv", zValidator("query", query), async (c) => {
  const { type } = c.req.valid("query");
  const rows =
    type === "warranties"
      ? await db.select().from(warranties)
      : type === "tickets"
        ? await db.select().from(tickets)
        : await db.select().from(machines);

  const csv = toCsv(rows as Record<string, unknown>[]);
  // BOM so Excel reads UTF-8 (Thai) correctly.
  const body = `﻿${csv}`;
  await logActivity(c.get("user"), "export.csv", type, `${rows.length} rows`);

  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${type}-${today()}.csv"`);
  return c.body(body);
});
