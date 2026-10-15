import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepts a healthy payload', () => {
    const payload = { status: 'ok', timestamp: '2026-10-15T10:00:00.000Z' };

    expect(healthResponseSchema.parse(payload)).toEqual(payload);
  });

  it('rejects an unknown status', () => {
    const result = healthResponseSchema.safeParse({
      status: 'down',
      timestamp: '2026-10-15T10:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a timestamp that is not ISO 8601', () => {
    const result = healthResponseSchema.safeParse({ status: 'ok', timestamp: 'yesterday' });

    expect(result.success).toBe(false);
  });
});
