import { parseOrigins, validateEnv } from './env.js';

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
    expect(env.TRUST_PROXY).toBe(true);
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
  it('splits on commas and drops blanks', () => {
    expect(parseOrigins(' http://a , ,http://b')).toEqual(['http://a', 'http://b']);
  });
});
