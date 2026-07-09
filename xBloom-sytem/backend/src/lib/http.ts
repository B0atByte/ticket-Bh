import { HTTPException } from "hono/http-exception";

/** Throw a stable, client-safe error. Internal details stay in logs. */
export function fail(status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503, message: string): never {
  throw new HTTPException(status, { message });
}

/**
 * True only for safe link values: http(s) absolute URLs, or our own app-relative
 * upload paths. Rejects javascript:/data:/vbscript: and other XSS-prone schemes.
 * Empty is treated as safe (the field is optional).
 */
export function isSafeUrl(v: string | null | undefined): boolean {
  if (!v) return true;
  if (v.startsWith("/uploads/") || v.startsWith("/api/uploads/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Add `years` to a YYYY-MM-DD string, returning YYYY-MM-DD. */
export function addYears(dateStr: string, years: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) fail(400, "Invalid date");
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/** Today's date as YYYY-MM-DD (server local). */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Serialize an array of flat objects to CSV text (RFC-4180 quoting). */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    // Neutralize CSV/formula injection: a leading =, +, -, @, TAB or CR makes
    // Excel/Sheets evaluate the cell as a formula. Prefix with ' so spreadsheets
    // treat the value as text when staff open the exported file.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(","));
  return lines.join("\r\n");
}
