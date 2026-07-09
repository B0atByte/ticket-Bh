import { Readable } from "node:stream";
import { env } from "../../env.js";
import { getGoogleClients } from "./google.js";
import { withRetry } from "./retry.js";

/**
 * Upload a screenshot (base64 PNG) named "<orderNo>.png" to Drive and return a
 * shareable view URL. Screenshots are best-effort and must never block the row
 * from being written, so the caller catches and continues on failure.
 */
export async function uploadScreenshot(orderNo: string, base64png: string): Promise<string | null> {
  if (!base64png) return null;
  const { drive } = getGoogleClients();
  const buffer = Buffer.from(base64png, "base64");

  const created = await withRetry(
    () =>
      drive.files.create({
        requestBody: {
          name: `${orderNo}.png`,
          mimeType: "image/png",
          ...(env.SHOPEE.driveFolderId ? { parents: [env.SHOPEE.driveFolderId] } : {}),
        },
        media: { mimeType: "image/png", body: Readable.from(buffer) },
        fields: "id, webViewLink",
      }),
    { label: "drive.create" },
  );

  const fileId = created.data.id;

  // Make it viewable by anyone with the link so it opens from the sheet.
  await withRetry(
    () =>
      drive.permissions.create({
        fileId: fileId!,
        requestBody: { type: "anyone", role: "reader" },
      }),
    { label: "drive.permission" },
  );

  return created.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
}
