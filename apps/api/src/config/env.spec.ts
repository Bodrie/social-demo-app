import { parseOrigins, parseTrustProxy, validateEnv } from './env.js';

const DATABASE_URL = 'postgresql://mesh:mesh@localhost:5433/mesh';
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
      WEB_ORIGINS: 'https://the-mesh.example, https://www.the-mesh.example',
      THROTTLE_LIMIT: '5',
    });

    expect(env.PORT).toBe(8080);
    expect(env.TRUST_PROXY).toBe(1);
    expect(env.WEB_ORIGINS).toEqual(['https://the-mesh.example', 'https://www.the-mesh.example']);
    expect(env.THROTTLE_LIMIT).toBe(5);
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
    PUBLIC_ASSETS_URL: 'https://mesh.example/api/v1/uploads',
    WEB_ORIGINS: 'https://mesh.example',
    TRUST_PROXY: '1',
    WEB_URL: 'https://social.bodrie.dev',
    EMAIL_TRANSPORT: 'smtp',
    SMTP_URL: 'smtps://resend:key@smtp.resend.com:465',
    EMAIL_FROM: 'The Mesh <noreply@social.bodrie.dev>',
  };

  it('accepts an explicit configuration', () => {
    expect(validateEnv(production).NODE_ENV).toBe('production');
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
