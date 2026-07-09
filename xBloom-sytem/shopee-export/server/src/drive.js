import { Readable } from "node:stream";
import { config } from "./config.js";
import { getClients } from "./google.js";
import { withRetry } from "./retry.js";

/**
 * Upload a screenshot (base64 PNG) named "<orderNo>.png" to Drive and return a
 * shareable view URL. Returns null on failure — screenshots are best-effort and
 * must never block the row from being written.
 */
export async function uploadScreenshot(orderNo, base64png) {
  if (!base64png) return null;
  const { drive } = getClients();
  const buffer = Buffer.from(base64png, "base64");

  try {
    const created = await withRetry(
      () =>
        drive.files.create({
          requestBody: {
            name: `${orderNo}.png`,
            mimeType: "image/png",
            ...(config.google.driveFolderId ? { parents: [config.google.driveFolderId] } : {}),
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
          fileId,
          requestBody: { type: "anyone", role: "reader" },
        }),
      { label: "drive.permission" },
    );

    return created.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  } catch (err) {
    // Surfaced to the caller, which logs and continues without a screenshot URL.
    throw err;
  }
}
