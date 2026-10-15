import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/** "http://a, http://b" → ["http://a", "http://b"] */
export function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  /** Comma-separated list of browser origins allowed by CORS (credentials on). */
  WEB_ORIGINS: z.string().default('http://localhost:5173').transform(parseOrigins),
  /** Set to true behind Caddy/Cloudflare so req.ip is the real client address. */
  TRUST_PROXY: z.stringbool().default(false),
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  /** HS256 secret for access tokens. Generate with `openssl rand -base64 48`. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(7 * 24 * 60 * 60),
  /** Secure flag on auth cookies. Defaults to true in production. */
  COOKIE_SECURE: z.stringbool().optional(),
  /** Public base URL for uploaded files. */
  PUBLIC_ASSETS_URL: z.url().default('http://localhost:3000/api/v1/uploads'),
});

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule: the app refuses to boot on a bad environment. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
