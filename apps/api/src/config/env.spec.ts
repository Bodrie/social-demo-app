import { parseOrigins, parseTrustProxy, validateEnv } from './env.js';

const DATABASE_URL = 'postgresql://beso:beso@localhost:5433/beso';
const JWT_SECRET = 'unit-test-secret-unit-test-secret-unit-test';

describe('validateEnv', () => {
  it('applies defaults when only DATABASE_URL is provided', () => {
    const env = validateEnv({ DATABASE_URL, JWT_SECRET });

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      WEB_ORIGINS: ['http://localhost:5173'],
      TRUST_PROXY: false,
      THROTTLE_TTL_MS: 60_000,
      THROTTLE_LIMIT: 100,
    });
  });

  it('coerces strings from the environment', () => {
    const env = validateEnv({
      DATABASE_URL,
      JWT_SECRET,
      PORT: '8080',
      TRUST_PROXY: 'true',
      WEB_ORIGINS: 'https://beso.example, https://www.beso.example',
      THROTTLE_LIMIT: '5',
    });

    expect(env.PORT).toBe(8080);
    expect(env.TRUST_PROXY).toBe(1);
    expect(env.WEB_ORIGINS).toEqual(['https://beso.example', 'https://www.beso.example']);
    expect(env.THROTTLE_LIMIT).toBe(5);
  });

  it('takes the web push keys all three together or not at all', () => {
    const vapid = {
      VAPID_PUBLIC_KEY: `B${'A'.repeat(86)}`,
      VAPID_PRIVATE_KEY: 'a'.repeat(43),
      VAPID_SUBJECT: 'mailto:ops@example.com',
    };
    expect(validateEnv({ DATABASE_URL, JWT_SECRET, ...vapid })).toMatchObject(vapid);
    // Compose passes unset ones as empty strings: that is "push off", not a half setup.
    expect(
      validateEnv({
        DATABASE_URL,
        JWT_SECRET,
        VAPID_PUBLIC_KEY: '',
        VAPID_PRIVATE_KEY: '',
        VAPID_SUBJECT: '',
      }).VAPID_PUBLIC_KEY,
    ).toBeUndefined();
    expect(() =>
      validateEnv({ DATABASE_URL, JWT_SECRET, ...vapid, VAPID_PRIVATE_KEY: '' }),
    ).toThrow(/set all three or none/);
    expect(() =>
      validateEnv({ DATABASE_URL, JWT_SECRET, ...vapid, VAPID_SUBJECT: 'ops@example.com' }),
    ).toThrow(/VAPID_SUBJECT/);
  });

  it('refuses to start without a valid DATABASE_URL', () => {
    expect(() => validateEnv({ JWT_SECRET })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ DATABASE_URL: 'not a url', JWT_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('rejects unknown log levels', () => {
    expect(() => validateEnv({ DATABASE_URL, JWT_SECRET, LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });

  it('requires a strong JWT secret', () => {
    expect(() => validateEnv({ DATABASE_URL, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
});

describe('parseOrigins', () => {
  it('splits on commas, drops blanks and trailing slashes', () => {
    expect(parseOrigins(' http://a/ , ,http://b')).toEqual(['http://a', 'http://b']);
  });

  it('rejects origins that are not URLs', () => {
    expect(() => validateEnv({ DATABASE_URL, JWT_SECRET, WEB_ORIGINS: 'localhost:5173' })).toThrow(
      /WEB_ORIGINS/,
    );
  });
});

describe('parseTrustProxy', () => {
  it('understands booleans, hop counts and address lists', () => {
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('true')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });
});

describe('production safety', () => {
  const production = {
    NODE_ENV: 'production',
    DATABASE_URL,
    JWT_SECRET,
    PUBLIC_ASSETS_URL: 'https://beso.example/api/v1/uploads',
    WEB_ORIGINS: 'https://beso.example',
    TRUST_PROXY: '1',
    WEB_URL: 'https://social.bodrie.dev',
    EMAIL_TRANSPORT: 'smtp',
    SMTP_URL: 'smtps://resend:key@smtp.resend.com:465',
    EMAIL_FROM: 'BeSo <noreply@social.bodrie.dev>',
    TURNSTILE_SECRET: '0x4AAAAAAA-secret',
  };

  it('accepts an explicit configuration', () => {
    expect(validateEnv(production).NODE_ENV).toBe('production');
  });

  it('wants a bot check, or the explicit choice to run without one', () => {
    expect(() => validateEnv({ ...production, TURNSTILE_SECRET: undefined })).toThrow(
      /TURNSTILE_SECRET must be set/,
    );
    expect(() => validateEnv({ ...production, TURNSTILE_SECRET: '  ' })).toThrow(
      /TURNSTILE_SECRET/,
    );
    expect(
      validateEnv({ ...production, TURNSTILE_SECRET: undefined, CAPTCHA: 'off' }).CAPTCHA,
    ).toBe('off');
    expect(() =>
      validateEnv({ ...production, TURNSTILE_SECRET: '0x4AAAAAAA_xxxxxxxxxxxxxxxxxxxxxxxxx' }),
    ).toThrow(/placeholder/);
  });

  it('treats the empty strings compose passes for unset optionals as "not set"', () => {
    // `TURNSTILE_SECRET: ${TURNSTILE_SECRET:-}` reaches the container as "" when .env lacks it.
    const parsed = validateEnv({ ...production, CAPTCHA: '' });
    expect(parsed.CAPTCHA).toBeUndefined();
    expect(parsed.TURNSTILE_SECRET).toBe(production.TURNSTILE_SECRET);
    const off = validateEnv({ ...production, TURNSTILE_SECRET: '', CAPTCHA: 'off' });
    expect(off.TURNSTILE_SECRET).toBeUndefined();
  });

  it('refuses development defaults and the placeholder secret', () => {
    expect(() => validateEnv({ ...production, WEB_ORIGINS: undefined })).toThrow(
      /WEB_ORIGINS must be set/,
    );
    expect(() => validateEnv({ ...production, TRUST_PROXY: '' })).toThrow(/TRUST_PROXY/);
    expect(() =>
      validateEnv({
        ...production,
        JWT_SECRET: 'change-me-to-a-random-string-of-at-least-32-characters',
      }),
    ).toThrow(/placeholder/);
    expect(() => validateEnv({ ...production, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    for (const spelling of ['0', 'no', 'off', 'FALSE']) {
      expect(() => validateEnv({ ...production, COOKIE_SECURE: spelling })).toThrow(
        /COOKIE_SECURE/,
      );
    }
    expect(validateEnv({ ...production, COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true);
  });

  it('insists on real mail settings', () => {
    expect(() => validateEnv({ ...production, EMAIL_TRANSPORT: 'outbox' })).toThrow(
      /EMAIL_TRANSPORT/,
    );
    expect(() => validateEnv({ ...production, SMTP_URL: undefined })).toThrow(/SMTP_URL/);
    expect(() => validateEnv({ ...production, EMAIL_FROM: '' })).toThrow(/EMAIL_FROM/);
    expect(() => validateEnv({ ...production, WEB_URL: undefined })).toThrow(/WEB_URL/);
  });
});
