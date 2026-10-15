import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepts a terminus result with every indicator up', () => {
    const payload = {
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    };

    expect(healthResponseSchema.parse(payload)).toEqual(payload);
  });

  it('accepts a failing result that carries extra indicator data', () => {
    const result = healthResponseSchema.safeParse({
      status: 'error',
      info: {},
      error: { database: { status: 'down', message: 'timeout' } },
      details: { database: { status: 'down', message: 'timeout' } },
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown statuses', () => {
    const result = healthResponseSchema.safeParse({ status: 'fine', details: {} });

    expect(result.success).toBe(false);
  });
});
