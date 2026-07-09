// Lightweight field validators. Each returns "" when valid, or a localized error
// string when not — the i18n `t` (from useI18n) is passed in so messages follow
// the selected language. Matching keys live under val.* in lib/i18n.tsx.
type Translate = (key: string, vars?: Record<string, string | number>) => string;

export const required = (t: Translate, v: string, label?: string) =>
  v.trim() ? "" : label ? t("val.requiredField", { label }) : t("val.required");

export const phone = (t: Translate, v: string) =>
  !v.trim() ? t("val.phoneRequired") : /^0\d{9}$/.test(v.trim()) ? "" : t("val.phoneFormat");

export const email = (t: Translate, v: string) =>
  !v.trim() ? "" : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : t("val.emailFormat");

export const postal = (t: Translate, v: string) =>
  !v.trim() ? "" : /^\d{5}$/.test(v.trim()) ? "" : t("val.postalFormat");

export const date = (t: Translate, v: string) => (v ? "" : t("val.dateRequired"));

export const url = (t: Translate, v: string) => {
  if (!v.trim()) return "";
  try {
    const u = new URL(v.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? "" : t("val.urlScheme");
  } catch {
    return t("val.urlInvalid");
  }
};

/**
 * Returns the URL only if it is safe to render as a link (http/https or an
 * app-relative /uploads path); otherwise undefined. Defends against
 * javascript:/data: links submitted through public forms (stored XSS).
 */
export function safeHref(v?: string | null): string | undefined {
  if (!v) return undefined;
  if (v.startsWith("/uploads/") || v.startsWith("/api/uploads/")) return v;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Returns true when every value in the errors map is empty. */
export const isClean = (errs: Record<string, string>) => Object.values(errs).every((e) => !e);

// xBloom factory serials: start with "J", alphanumeric, ~12–16 chars.
// Used to reject a wrong/similar barcode when scanning (manual typing is not gated).
export const XBLOOM_SERIAL = /^J[0-9A-Z]{11,15}$/;
export const isXbloomSerial = (s: string) => XBLOOM_SERIAL.test(s.trim().toUpperCase());
