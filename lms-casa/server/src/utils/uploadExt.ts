/**
 * Map a *validated* mime type to a safe file extension.
 *
 * Upload filenames must NEVER derive their extension from the user-supplied
 * originalname — an attacker could upload PNG-magic-byte content named
 * "x.html" and have it served as text/html on our origin (stored XSS).
 * The mime here has already passed the route's fileFilter whitelist + the
 * magic-byte check, so it is trustworthy.
 */
const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

/** Safe extension for a validated mime type, or '' if unknown (caller should reject). */
export function extForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? '';
}
