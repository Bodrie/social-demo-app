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

/**
 * Compose passes `${VAR:-}` for optional settings, so an unset variable arrives as "" rather
 * than being absent; for these, an empty string means "not configured".
 */
const unsetWhenEmpty = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema.optional(),
  );

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
  /** Open chat sockets allowed per user (tabs and devices); more are refused at handshake. */
  SOCKET_MAX_PER_USER: z.coerce.number().int().positive().default(5),
  /** Authenticated socket handshakes per user and minute, accepted or not. */
  SOCKET_CONNECTS_PER_MINUTE: z.coerce.number().int().positive().default(30),
  /** HS256 secret for access tokens. Generate with `openssl rand -base64 48`. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60),
  /** Secure flag on auth cookies. Defaults to true in production. */
  COOKIE_SECURE: z.stringbool().optional(),
  /** Public base URL for uploaded files. */
  PUBLIC_ASSETS_URL: z.url().default('http://localhost:3000/api/v1/uploads'),
  /** Local-disk storage root for uploads (a mounted volume in production). */
  UPLOADS_DIR: z.string().min(1).default('./uploads'),
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 1024 * 1024),
  /** Reject images above this many pixels before decoding (decompression bombs). */
  UPLOAD_MAX_PIXELS: z.coerce.number().int().positive().default(25_000_000),
  /** Where the links in our emails point (the web app). */
  WEB_URL: z.url().default('http://localhost:5173'),
  /** `outbox` writes every mail as a JSON file (development, tests); `smtp` sends it. */
  EMAIL_TRANSPORT: z.enum(['outbox', 'smtp']).default('outbox'),
  /** SMTP submission URL, e.g. smtps://resend:<api key>@smtp.resend.com:465 */
  SMTP_URL: z.url().optional(),
  EMAIL_FROM: z.string().min(3).default('BeSo <noreply@localhost>'),
  EMAIL_OUTBOX_DIR: z.string().min(1).default('./outbox'),
  /**
   * Cloudflare Turnstile secret: with it, registration needs a passed bot check. Without it the
   * check is skipped (development, tests); production refuses that unless `CAPTCHA=off`.
   */
  TURNSTILE_SECRET: unsetWhenEmpty(z.string().min(1)),
  /** `off` is the explicit choice to run registration without a bot check in production. */
  CAPTCHA: unsetWhenEmpty(z.enum(['turnstile', 'off'])),
  /**
   * Whether this process runs the daily housekeeping jobs (`JobsService`). On when there is one
   * API container; set to false on every container but one when there are several.
   */
  JOBS_ENABLED: z.stringbool().default(true),
  /**
   * Comma-separated addresses of the admins (ADR 0016). When set, matching accounts are
   * promoted at startup and at sign-in and every other admin is demoted at startup; when empty
   * the roles are left as they are (the seed's, or whatever was set before).
   */
  ADMIN_EMAILS: z.string().default('').transform(parseEmails),
});

/** "A@x.y, b@x.y" → ["a@x.y", "b@x.y"]. */
export function parseEmails(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0),
    ),
  ];
}

export type Env = z.infer<typeof envSchema>;

/** Values that are fine for development but must be chosen deliberately in production. */
const PRODUCTION_EXPLICIT = [
  'PUBLIC_ASSETS_URL',
  'WEB_ORIGINS',
  'TRUST_PROXY',
  'WEB_URL',
  'EMAIL_FROM',
  'SMTP_URL',
] as const;
const PLACEHOLDER_SECRET = /^change-me/i;
/** The value `deploy/.env.example` ships; a real Turnstile secret has no `_x…` tail. */
const PLACEHOLDER_TURNSTILE = /^0x4AAAAAAA_x+$/;

function assertProductionSafe(config: Record<string, unknown>): void {
  if (config.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  for (const key of PRODUCTION_EXPLICIT) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim() === '')
      problems.push(`${key} must be set explicitly`);
  }
  if (typeof config.JWT_SECRET === 'string' && PLACEHOLDER_SECRET.test(config.JWT_SECRET)) {
    problems.push('JWT_SECRET still has the placeholder value');
  }
  // `z.stringbool()` also accepts "0", "no" and "off": judge the parsed value, not the spelling.
  const cookieSecure = z.stringbool().safeParse(config.COOKIE_SECURE);
  if (cookieSecure.success && !cookieSecure.data) {
    problems.push('COOKIE_SECURE cannot be false');
  }
  if (config.EMAIL_TRANSPORT !== 'smtp') {
    problems.push('EMAIL_TRANSPORT must be "smtp" (the outbox is for development)');
  }
  const secret = typeof config.TURNSTILE_SECRET === 'string' ? config.TURNSTILE_SECRET.trim() : '';
  if (secret === '' && config.CAPTCHA !== 'off') {
    problems.push(
      'TURNSTILE_SECRET must be set (or CAPTCHA=off to leave registration unprotected)',
    );
  }
  if (PLACEHOLDER_TURNSTILE.test(secret)) {
    problems.push('TURNSTILE_SECRET still has the placeholder value');
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
