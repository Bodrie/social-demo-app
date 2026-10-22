import {
  type ArgumentsHost,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ZodSerializationException, ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import { fieldsFromIssues, serializationIssues, toApiError } from '../errors.js';
import { ApiExceptionFilter } from './api-exception.filter.js';

function zodFailure(): ZodValidationException {
  const result = z
    .object({ email: z.email(), age: z.number().min(18) })
    .safeParse({ email: 'x', age: 1 });
  if (result.success) throw new Error('expected a failure');
  return new ZodValidationException(result.error);
}

/** What the serializer throws when a handler's answer does not match its @ZodResponse schema. */
function responseMismatch(): ZodSerializationException {
  const result = z
    .object({ user: z.object({ email: z.email() }) })
    .safeParse({ user: { email: 'alice-at-example' } });
  if (result.success) throw new Error('expected a failure');
  return new ZodSerializationException(result.error);
}

describe('toApiError', () => {
  it('maps zod validation failures to VALIDATION_ERROR with one message per field', () => {
    const error = toApiError(zodFailure(), 'req-1');

    expect(error).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR', requestId: 'req-1' });
    expect(Object.keys(error.fields ?? {})).toEqual(['email', 'age']);
  });

  it('masks a response that failed its schema as a 500, never as a client error', () => {
    expect(toApiError(responseMismatch(), 'req-2')).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      fields: undefined,
      requestId: 'req-2',
    });
  });

  it('maps HttpExceptions by status and keeps their message', () => {
    expect(toApiError(new NotFoundException('No such post'))).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'No such post',
    });
  });

  it('lets services override the code and attach field errors', () => {
    const error = toApiError(
      new ConflictException({
        code: 'CONFLICT',
        message: 'Email taken',
        fields: { email: 'Already registered' },
      }),
    );

    expect(error).toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      fields: { email: 'Already registered' },
    });
  });

  it('maps Prisma unique violations to 409 with the offending columns', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    });

    expect(toApiError(prismaError)).toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      fields: { email: 'Already in use' },
    });
  });

  it('maps Prisma missing-record errors to 404', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    });

    expect(toApiError(prismaError).statusCode).toBe(404);
  });

  it('maps body-parser style http-errors by their status and keeps the message', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      expose: true,
    });

    expect(toApiError(tooLarge)).toMatchObject({
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'request entity too large',
    });
  });

  it('never trusts http-errors marked as not exposable or with 5xx status', () => {
    const internal = Object.assign(new Error('db password leaked'), { status: 502, expose: true });
    expect(toApiError(internal).statusCode).toBe(500);
    const hidden = Object.assign(new Error('hidden'), { status: 400, expose: false });
    expect(toApiError(hidden).statusCode).toBe(500);
  });

  it('hides internals of unexpected errors', () => {
    const error = toApiError(new Error('secret connection string'), 'req-2');

    expect(error).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      fields: undefined,
      requestId: 'req-2',
    });
  });
});

describe('fieldsFromIssues', () => {
  it('joins nested paths and keeps the first message per path', () => {
    expect(
      fieldsFromIssues([
        { path: ['address', 'city'], message: 'Required' },
        { path: ['address', 'city'], message: 'Too short' },
        { path: [], message: 'Unexpected key' },
      ]),
    ).toEqual({ 'address.city': 'Required', _: 'Unexpected key' });
  });
});

describe('serializationIssues', () => {
  it('lists the failing paths of a response without their values', () => {
    const issues = serializationIssues(responseMismatch());
    expect(issues).toEqual([
      { path: 'user.email', code: 'invalid_format', message: expect.any(String) },
    ]);
    expect(JSON.stringify(issues)).not.toContain('alice-at-example');
    expect(serializationIssues(zodFailure())).toBeUndefined();
  });
});

describe('ApiExceptionFilter', () => {
  function hostWith(requestId?: string) {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      getType: () => 'http',
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ id: requestId }),
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  }

  it('emits an exception event with the envelope on WebSocket contexts', () => {
    const emit = vi.fn();
    const host = {
      getType: () => 'ws',
      switchToWs: () => ({ getClient: () => ({ emit }) }),
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(new NotFoundException('gone'), host);

    expect(emit).toHaveBeenCalledWith(
      'exception',
      expect.objectContaining({ code: 'NOT_FOUND', message: 'gone' }),
    );
  });

  it('writes the envelope with the request id', () => {
    const { host, status, json } = hostWith('abc');

    new ApiExceptionFilter().catch(new NotFoundException('gone'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_FOUND', message: 'gone', requestId: 'abc' }),
    );
  });

  it('passes terminus health results through untouched', () => {
    const { host, status, json } = hostWith();
    const healthResult = {
      status: 'error',
      info: {},
      error: { database: { status: 'down' } },
      details: {},
    };

    new ApiExceptionFilter().catch(new ServiceUnavailableException(healthResult), host);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(healthResult);
  });
});
