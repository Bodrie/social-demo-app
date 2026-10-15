import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiError, type ErrorCode, errorCodeSchema } from '@the-mesh/shared';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { Prisma } from '../../generated/prisma/client.js';
import { isRecord } from '../guards.js';

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

function codeForStatus(status: number): ErrorCode {
  return CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
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

/** terminus throws its health result as a ServiceUnavailableException; pass it through untouched. */
function isHealthCheckResult(value: unknown): value is Record<string, unknown> {
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
      return { statusCode: 409, code: 'CONFLICT', message: 'Resource already exists', fields, requestId };
    }
    case 'P2025':
      return { statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found', requestId };
    case 'P2003':
      return { statusCode: 400, code: 'BAD_REQUEST', message: 'Related resource not found', requestId };
    default:
      return { statusCode: 500, code: 'INTERNAL_ERROR', message: GENERIC_SERVER_ERROR, requestId };
  }
}

/** Pure mapping from anything thrown to the shared ApiError envelope. */
export function toApiError(exception: unknown, requestId?: string): ApiError {
  if (exception instanceof ZodValidationException) {
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
  return { statusCode: 500, code: 'INTERNAL_ERROR', message: GENERIC_SERVER_ERROR, requestId };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { id?: string | number }>();
    const requestId = request.id === undefined ? undefined : String(request.id);

    if (exception instanceof HttpException && isHealthCheckResult(exception.getResponse())) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const error = toApiError(exception, requestId);
    if (error.statusCode >= 500) {
      this.logger.error({ err: exception, requestId }, 'Request failed');
    }
    response.status(error.statusCode).json(error);
  }
}
