import { zValidator } from "../lib/zval.js";
import { Hono } from "hono";
import { z } from "zod";
import { aiEnabled, chat } from "../lib/ai.js";
import { fail } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import type { AppEnv } from "../types.js";

export const aiRoutes = new Hono<AppEnv>();

// Only non-PII case context is sent to the model — never the customer's name,
// phone, email or address. The draft addresses the customer generically and
// staff edit it before sending.
const draftSchema = z.object({
  intent: z.enum(["status_update", "request_info", "quote", "ready", "closing"]),
  issueType: z.string().max(100).optional(),
  repairType: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  note: z.string().max(1000).optional(),
});

const SYSTEM = [
  "You are a customer-service assistant for xBloom Thailand (premium coffee machines).",
  "Write a short, warm, professional reply to a customer about their after-sales service case.",
  "Do NOT invent specific facts such as dates, prices, names, or tracking numbers — only use what the staff provided.",
  "Address the customer generically (Thai: 'เรียนลูกค้า', English: 'Dear Customer'). Sign off as the xBloom Thailand team.",
  'Return STRICT JSON only: {"th":"<Thai message>","en":"<English message>"}. Keep each message under ~120 words.',
].join(" ");

aiRoutes.post(
  "/draft-reply",
  requireAuth,
  rateLimit({ max: 20, windowMs: 60_000, keyPrefix: "ai" }),
  zValidator("json", draftSchema),
  async (c) => {
    if (!aiEnabled) fail(503, "ยังไม่ได้ตั้งค่า AI (DEEPSEEK_API_KEY) / AI is not configured");
    const b = c.req.valid("json");
    const user = [
      `Intent: ${b.intent}`,
      `Issue type: ${b.issueType ?? "-"}`,
      `Repair type: ${b.repairType ?? "-"}`,
      `Current status: ${b.status ?? "-"}`,
      `Staff key points: ${b.note ?? "-"}`,
    ].join("\n");

    let content: string;
    try {
      content = await chat(
        [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
        { json: true },
      );
    } catch (e) {
      console.error("[ai] draft-reply failed:", e);
      fail(502, "ร่างข้อความไม่สำเร็จ ลองใหม่อีกครั้ง / Couldn't reach the AI service");
    }

    let out: { th?: unknown; en?: unknown };
    try {
      out = JSON.parse(content);
    } catch {
      fail(502, "AI ตอบกลับไม่ถูกรูปแบบ / Unexpected AI response");
    }
    return c.json({ th: String(out.th ?? ""), en: String(out.en ?? "") });
  },
);
