import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { type ApiError, type ErrorCode, errorCodeSchema } from '@the-mesh/shared';
import { Prisma } from '../generated/prisma/client.js';
import { isRecord } from './type-guards.js';

// --- constructors used by services ----------------------------------------

export const notFound = (message: string): NotFoundException => new NotFoundException(message);
export const forbidden = (message: string): ForbiddenException => new ForbiddenException(message);
export const unauthorized = (message: string): UnauthorizedException =>
  new UnauthorizedException(message);
export const badRequest = (message: string, fields?: Record<string, string>): BadRequestException =>
  new BadRequestException({ message, fields });
export const conflict = (message: string, fields?: Record<string, string>): ConflictException =>
  new ConflictException({ message, fields });
export const unsupportedMedia = (
  message: string,
  fields?: Record<string, string>,
): UnsupportedMediaTypeException => new UnsupportedMediaTypeException({ message, fields });
/** A limit enforced by a service (per account), as opposed to the request throttlers. */
export const tooManyRequests = (message: string): HttpException =>
  new HttpException({ message }, HttpStatus.TOO_MANY_REQUESTS);
/** A dependency we need is not answering; `code` names it so clients can say what to retry. */
export const serviceUnavailable = (message: string, code: ErrorCode = 'SERVICE_UNAVAILABLE') =>
  new HttpException({ message, code }, HttpStatus.SERVICE_UNAVAILABLE);
/** A 400 that forms map onto inputs, like the automatic zod validation errors. */
export const validationError = (
  fields: Record<string, string>,
  message = 'Validation failed',
): BadRequestException => new BadRequestException({ code: 'VALIDATION_ERROR', message, fields });

// --- mapping anything thrown to the shared envelope ------------------------

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

const GENERIC_SERVER_ERROR = 'Internal server error';
const SERVICE_UNAVAILABLE = 503;

type ZodIssueLike = { path: PropertyKey[]; message: string };

function isZodIssue(value: unknown): value is ZodIssueLike {
  return isRecord(value) && Array.isArray(value.path) && typeof value.message === 'string';
}

function hasIssues(value: unknown): value is { issues: ZodIssueLike[] } {
  return isRecord(value) && Array.isArray(value.issues) && value.issues.every(isZodIssue);
}

/** nestjs-zod's ZodValidationException exposes the ZodError through getZodError(). */
function isZodValidationException(value: unknown): value is { getZodError: () => unknown } {
  return (
    value instanceof HttpException &&
    'getZodError' in value &&
    typeof value.getZodError === 'function'
  );
}

/** body-parser / multer errors from the `http-errors` package: a status and `expose: true`. */
function isExposedHttpError(value: unknown): value is { status: number; message: string } {
  return (
    isRecord(value) &&
    typeof value.status === 'number' &&
    value.status >= 400 &&
    value.status < 500 &&
    value.expose === true &&
    typeof value.message === 'string'
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

export function codeForStatus(status: number): ErrorCode {
  return CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
}

/** First issue per input path, keyed like "email" or "address.city". */
export function fieldsFromIssues(issues: readonly ZodIssueLike[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

/** terminus throws its health result as a ServiceUnavailableException; it is passed through untouched. */
export function isHealthCheckResult(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && 'status' in value && 'details' in value;
}

function fromHttpException(exception: HttpException, requestId?: string): ApiError {
  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  let message = exception.message;
  let code = codeForStatus(statusCode);
  let fields: Record<string, string> | undefined;

  if (typeof response === 'string') {
    message = response;
  } else if (isRecord(response)) {
    if (typeof response.message === 'string') message = response.message;
    else if (Array.isArray(response.message)) message = response.message.map(String).join('; ');
    const parsedCode = errorCodeSchema.safeParse(response.code);
    if (parsedCode.success) code = parsedCode.data;
    if (isStringRecord(response.fields)) fields = response.fields;
  }

  if (statusCode >= 500 && statusCode !== SERVICE_UNAVAILABLE) {
    message = GENERIC_SERVER_ERROR;
  }

  return { statusCode, code, message, fields, requestId };
}

function fromPrismaError(
  exception: Prisma.PrismaClientKnownRequestError,
  requestId?: string,
): ApiError {
  switch (exception.code) {
    case 'P2002': {
      const target = exception.meta?.target;
      const fields = Array.isArray(target)
        ? Object.fromEntries(target.map((column) => [String(column), 'Already in use']))
        : undefined;
      return {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Resource already exists',
        fields,
        requestId,
      };
    }
    case 'P2025':
      return { statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found', requestId };
    case 'P2003':
      return {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Related resource not found',
        requestId,
      };
    default:
      return { statusCode: 500, code: 'INTERNAL_ERROR', message: GENERIC_SERVER_ERROR, requestId };
  }
}

/** Pure mapping from anything thrown to the shared ApiError envelope. */
export function toApiError(exception: unknown, requestId?: string): ApiError {
  if (isZodValidationException(exception)) {
    const zodError: unknown = exception.getZodError();
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fields: hasIssues(zodError) ? fieldsFromIssues(zodError.issues) : {},
      requestId,
    };
  }
  if (exception instanceof HttpException) {
    return fromHttpException(exception, requestId);
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    return fromPrismaError(exception, requestId);
  }
  if (isExposedHttpError(exception)) {
    return {
      statusCode: exception.status,
      code: codeForStatus(exception.status),
      message: exception.message,
      requestId,
    };
  }
  return { statusCode: 500, code: 'INTERNAL_ERROR', message: GENERIC_SERVER_ERROR, requestId };
}
