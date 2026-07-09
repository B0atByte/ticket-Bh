import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { ordersRouter } from "./routes/orders.js";
import { log } from "./logger.js";

const app = express();

// The extension's background worker calls us cross-origin; allow it.
app.use(cors());
// Screenshots arrive as base64 inside the JSON body, so allow a large payload.
app.use(express.json({ limit: "25mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use(ordersRouter);

// Central error handler — never leak stack traces to the client.
app.use((err, _req, res, _next) => {
  log.error("unhandled error", { reason: err?.message });
  res.status(500).json({ error: "internal server error" });
});

app.listen(config.port, () => {
  log.info(`Shopee export server listening on http://localhost:${config.port}`);
});
