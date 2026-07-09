import "dotenv/config";

/**
 * Centralized, fail-fast environment access.
 * Required values throw at startup rather than failing deep inside a request.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const NODE_ENV = process.env.NODE_ENV ?? "development";
const JWT_SECRET = required("JWT_SECRET");

// In production, refuse to boot with a weak or default secret.
if (NODE_ENV === "production") {
  const weak = JWT_SECRET.length < 24 || /change|dev|secret|example/i.test(JWT_SECRET);
  if (weak) throw new Error("JWT_SECRET is too weak for production (use a long random value)");
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET,
  API_PORT: Number(process.env.API_PORT ?? 8080),
  NODE_ENV,
  // Comma-separated allowed origins. Empty in dev → allow all.
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // ── Shopee export (all optional) ─────────────────────────
  // Orders always save to MySQL. Google Sheet/Drive mirroring activates only
  // when both a service-account key file and a sheet id are set.
  SHOPEE: {
    // Optional shared secret the extension must send (x-api-key). Empty = open.
    apiKey: (process.env.SHOPEE_API_KEY ?? "").trim(),
    // Path to the Google service-account JSON key (enables Sheet + Drive).
    credentialsFile: (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "").trim(),
    sheetId: (process.env.SHOPEE_SHEET_ID ?? "").trim(),
    sheetTab: (process.env.SHOPEE_SHEET_TAB ?? "Orders").trim(),
    driveFolderId: (process.env.SHOPEE_DRIVE_FOLDER_ID ?? "").trim(),
  },
};

/** True when Google Sheet mirroring is fully configured. */
export const shopeeSheetEnabled = (): boolean =>
  Boolean(env.SHOPEE.credentialsFile && env.SHOPEE.sheetId);
