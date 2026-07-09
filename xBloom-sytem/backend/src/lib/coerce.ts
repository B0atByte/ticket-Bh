// Pure value-coercion helpers for spreadsheet import — unit-testable, no I/O.

export const toStr = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim();
};

/** Excel serial (days since 1899-12-30) or ISO string → YYYY-MM-DD. */
export const toDate = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

/** Excel serial or ISO string → "YYYY-MM-DD HH:MM:SS" (preserves wall-clock). */
export const toDateTime = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 19).replace("T", " ");
  }
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : null;
};

/** Restore Thai mobile leading zero lost when Excel stored the number. */
export const toPhone = (v: unknown): string | null => {
  const x = toStr(v);
  if (!x) return null;
  return /^\d{9}$/.test(x) ? `0${x}` : x;
};

/** Pad Thai postal code to 5 digits. */
export const toPostal = (v: unknown): string | null => {
  const x = toStr(v);
  if (!x) return null;
  return /^\d{1,5}$/.test(x) ? x.padStart(5, "0") : x;
};

const TICKET_STATUS_MAP: Record<string, string> = {
  "new": "new",
  "new case": "new",
  "diagnose": "diagnose",
  "quote": "quote",
  "quote cost": "quote",
  "approved": "approved",
  "customer approved": "approved",
  "repairing": "repairing",
  "repair done": "repair_done",
  "repair_done": "repair_done",
  "returned": "returned",
  "closed": "closed",
  "close": "closed",
};

export const normTicketStatus = (v: unknown): string => {
  const x = toStr(v);
  if (!x) return "new";
  const key = x.toLowerCase();
  return TICKET_STATUS_MAP[key] ?? key.replace(/\s+/g, "_");
};
