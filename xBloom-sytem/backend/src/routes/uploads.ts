import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import { fail } from "../lib/http.js";
import { rateLimit } from "../middleware/rateLimit.js";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";

const LIMITS: Record<"image" | "video", number> = {
  image: 10 * 1024 * 1024, // 10MB
  video: 60 * 1024 * 1024, // 60MB
};
const ALLOWED: Record<"image" | "video", Record<string, string>> = {
  image: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" },
  video: { "video/mp4": "mp4", "video/quicktime": "mov" },
};

/** Check the leading bytes match the declared type (basic anti-spoof). */
function hasValidSignature(b: Buffer, kind: "image" | "video", mime: string): boolean {
  const at = (off: number, sig: string) => b.toString("latin1", off, off + sig.length) === sig;
  if (kind === "video") return at(4, "ftyp"); // mp4 / mov
  if (mime === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === "image/webp") return at(0, "RIFF") && at(8, "WEBP");
  if (mime === "image/heic") return at(4, "ftyp");
  return false;
}

export const uploadRoutes = new Hono();

// Public (customers upload receipts/videos). Throttled to limit abuse.
uploadRoutes.post("/", rateLimit({ max: 40, windowMs: 60 * 60 * 1000, keyPrefix: "upload" }), async (c) => {
  const kind = c.req.query("kind") === "video" ? "video" : "image";

  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) fail(400, "ไม่พบไฟล์ / No file");

  const f = file as File;
  const ext = ALLOWED[kind][f.type];
  if (!ext) fail(400, "ชนิดไฟล์ไม่รองรับ / Unsupported file type");
  if (f.size > LIMITS[kind]) fail(400, `ไฟล์ใหญ่เกิน ${LIMITS[kind] / 1024 / 1024}MB / File too large`);

  const buf = Buffer.from(await f.arrayBuffer());
  // Verify the real file signature — don't trust the declared mime type.
  if (!hasValidSignature(buf, kind, f.type)) fail(400, "ไฟล์เสียหายหรือชนิดไม่ตรง / Corrupt or mismatched file");

  // Generated name only — never trust the client filename (path traversal).
  const stored = `${kind}-${randomUUID()}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, stored), buf);

  return c.json({ url: `/uploads/${stored}`, filename: f.name, stored }, 201);
});
