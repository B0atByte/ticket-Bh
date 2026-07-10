import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { issues } from "../db/schema.js";
import { env } from "../env.js";
import { zValidator } from "../lib/zval.js";
import { optionalAuth } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

export const issueRoutes = new Hono<AppEnv>();
issueRoutes.use("*", optionalAuth);

const createIssue = z.object({
  description: z.string().min(5, "กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร").max(2000),
  page: z.string().max(500).optional(),
});

async function notifyDiscord(issue: {
  description: string;
  page: string | null;
  reporterName: string | null;
  reporterRole: string | null;
}): Promise<void> {
  if (!env.DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "🐞 แจ้งปัญหาใหม่ - xBloom",
            description: issue.description,
            color: 0xef4444,
            fields: [
              {
                name: "ผู้แจ้ง",
                value: issue.reporterName ? `${issue.reporterName} (${issue.reporterRole})` : "ไม่ระบุ (ยังไม่ได้ login)",
                inline: true,
              },
              { name: "หน้า", value: issue.page ?? "-", inline: true },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (err) {
    console.error("Discord webhook failed:", err);
  }
}

issueRoutes.post("/", zValidator("json", createIssue), async (c) => {
  const { description, page } = c.req.valid("json");
  const user = c.get("user");
  const reporterName = user?.name ?? null;
  const reporterRole = user?.role ?? null;

  const [res] = await db.insert(issues).values({
    description,
    page: page ?? null,
    reporterName,
    reporterRole,
  }).$returningId();

  await notifyDiscord({ description, page: page ?? null, reporterName, reporterRole });

  return c.json({ id: res.id }, 201);
});
