import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  MUTATION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().optional().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().optional().default('LMS Casa <noreply@example.com>'),

  APP_URL: z.string().default('http://localhost:5173'),

  STORAGE_DRIVER: z.enum(['local', 's3', 'minio']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),

  ENABLE_WORKERS: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .default(true)
    .transform((v) => (typeof v === 'string' ? v === 'true' : v)),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_REGION: z.string().optional().default('ap-southeast-1'),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY: z.string().optional().default(''),
  S3_SECRET_KEY: z.string().optional().default(''),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  SENTRY_DSN: z.string().optional().default(''),

  // === AI question generation (optional) ===
  // Priority: DeepSeek → OpenAI → local fallback
  DEEPSEEK_API_KEY: z.string().optional().default(''),
  DEEPSEEK_MODEL: z.string().optional().default('deepseek-chat'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().optional().default('gpt-4o-mini'),

  // === SSO / OIDC (Phase 6) ===
  // Set OIDC_ISSUER to enable SSO. Leave empty to disable.
  // Example (Azure AD): https://login.microsoftonline.com/<tenant-id>/v2.0
  // Example (Google):   https://accounts.google.com
  // Example (Keycloak): https://your-keycloak/realms/your-realm
  OIDC_ISSUER: z.string().optional().default(''),
  OIDC_CLIENT_ID: z.string().optional().default(''),
  OIDC_CLIENT_SECRET: z.string().optional().default(''),
  OIDC_REDIRECT_URI: z.string().optional().default('http://localhost:4000/api/v1/auth/oidc/callback'),
  // true = auto-create account on first SSO login; false = require pre-existing account
  OIDC_AUTO_PROVISION: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .default(false)
    .transform((v) => (typeof v === 'string' ? v === 'true' : v)),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast — don't start the server with missing/invalid config
  // eslint-disable-next-line no-console
  console.error('\nInvalid environment variables:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
