import { apiErrorSchema, isApiError } from './errors.js';

describe('apiErrorSchema', () => {
  it('accepts a validation error with field messages and a request id', () => {
    const payload = {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fields: { email: 'Invalid email' },
      requestId: 'req-1',
    };

    expect(apiErrorSchema.parse(payload)).toEqual(payload);
    expect(isApiError(payload)).toBe(true);
  });

  it('rejects non-error status codes and unknown codes', () => {
    expect(
      apiErrorSchema.safeParse({ statusCode: 200, code: 'NOT_FOUND', message: 'x' }).success,
    ).toBe(false);
    expect(
      apiErrorSchema.safeParse({ statusCode: 404, code: 'MISSING', message: 'x' }).success,
    ).toBe(false);
  });
});
