import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { db } from "./db/client.js";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { crmRoutes } from "./routes/crm.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { exportRoutes } from "./routes/export.js";
import { aiRoutes } from "./routes/ai.js";
import { globalClaimRoutes } from "./routes/globalClaims.js";
import { logRoutes } from "./routes/logs.js";
import { machineRoutes } from "./routes/machines.js";
import { productRoutes } from "./routes/products.js";
import { ticketRoutes } from "./routes/tickets.js";
import { UPLOAD_DIR, uploadRoutes } from "./routes/uploads.js";
import { userRoutes } from "./routes/users.js";
import { publicWarrantyRoutes, warrantyRoutes } from "./routes/warranties.js";
import { shopeeRoutes } from "./routes/shopeeExport.js";
import type { AppEnv } from "./types.js";

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use("*", cors({ origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : "*" }));

app.get("/health", async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    return c.json({ status: "ok", db: "up" }, 200);
  } catch (err) {
    console.error("health check db error:", err);
    return c.json({ status: "degraded", db: "down" }, 503);
  }
});

app.get("/", (c) => c.json({ name: "xBloom API", version: "0.2.0" }));

// ── Routes ──────────────────────────────────────────────
app.route("/auth", authRoutes);
app.route("/", publicWarrantyRoutes); // POST /register, GET /coverage/:serial
app.route("/warranties", warrantyRoutes);
app.route("/tickets", ticketRoutes);
app.route("/machines", machineRoutes);
app.route("/global-claims", globalClaimRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/export", exportRoutes);
app.route("/products", productRoutes);
app.route("/logs", logRoutes);
app.route("/users", userRoutes);
app.route("/crm", crmRoutes);
app.route("/ai", aiRoutes);
app.route("/shopee", shopeeRoutes);
app.route("/uploads", uploadRoutes);

// Serve uploaded files from <cwd>/uploads (UPLOAD_DIR is relative to cwd).
app.use("/uploads/*", serveStatic({ root: "./" }));
void UPLOAD_DIR;

// ── Central error handler: stable, client-safe responses ─
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`xBloom API listening on http://localhost:${info.port}`);
});
