import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/** "http://a/, http://b" → ["http://a", "http://b"]; entries are validated as URLs afterwards. */
export function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
}

/**
 * Express `trust proxy` setting: `false`, a hop count ("1", "2"), or a list of
 * addresses/subnets ("loopback", "10.0.0.0/8, uniquelocal"). Behind Caddy that
 * rewrites X-Forwarded-For from CF-Connecting-IP, "1" is the right value.
 */
export function parseTrustProxy(value: string): boolean | number | string {
  const normalised = value.trim().toLowerCase();
  if (normalised === '' || normalised === 'false' || normalised === '0') return false;
  if (normalised === 'true') return 1;
  if (/^\d+$/.test(normalised)) return Number(normalised);
  return value.trim();
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  /** Comma-separated list of browser origins allowed by CORS (credentials on). */
  WEB_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform(parseOrigins)
    .pipe(z.array(z.url({ protocol: /^https?$/ })).min(1)),
  TRUST_PROXY: z.string().default('false').transform(parseTrustProxy),
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
  /** Local-disk storage root for uploads (a mounted volume in production). */
  UPLOADS_DIR: z.string().min(1).default('./uploads'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  /** Reject images above this many pixels before decoding (decompression bombs). */
  UPLOAD_MAX_PIXELS: z.coerce.number().int().positive().default(25_000_000),
});

export type Env = z.infer<typeof envSchema>;

/** Values that are fine for development but must be chosen deliberately in production. */
const PRODUCTION_EXPLICIT = ['PUBLIC_ASSETS_URL', 'WEB_ORIGINS', 'TRUST_PROXY'] as const;
const PLACEHOLDER_SECRET = /^change-me/i;

function assertProductionSafe(config: Record<string, unknown>): void {
  if (config.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  for (const key of PRODUCTION_EXPLICIT) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim() === '') problems.push(`${key} must be set explicitly`);
  }
  if (typeof config.JWT_SECRET === 'string' && PLACEHOLDER_SECRET.test(config.JWT_SECRET)) {
    problems.push('JWT_SECRET still has the placeholder value');
  }
  if (typeof config.COOKIE_SECURE === 'string' && config.COOKIE_SECURE.trim().toLowerCase() === 'false') {
    problems.push('COOKIE_SECURE cannot be false');
  }
  if (problems.length > 0) {
    throw new Error(`Invalid production configuration:\n- ${problems.join('\n- ')}`);
  }
}

/** Used by ConfigModule: the app refuses to boot on a bad environment. */
export function validateEnv(config: Record<string, unknown>): Env {
  assertProductionSafe(config);
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
