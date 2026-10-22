import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isHealthCheckResult, serializationIssues, toApiError } from '../errors.js';

/**
 * Catch-all filter: every HTTP error becomes the shared ApiError envelope (Prisma and
 * body-parser errors included), terminus health results pass through, a response that
 * fails its `@ZodResponse` schema is a masked 500 logged with the failing paths, and
 * WebSocket handler errors are emitted to the client as an `exception` event with the
 * same envelope.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'ws') {
      const client = host.switchToWs().getClient<{
        id?: string;
        data?: { userId?: string };
        emit: (event: string, payload: unknown) => void;
      }>();
      const error = toApiError(exception);
      if (error.statusCode >= 500) {
        this.logger.error(
          { err: exception, socketId: client.id, userId: client.data?.userId },
          'Socket handler failed',
        );
      }
      client.emit('exception', error);
      return;
    }

    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { id?: string | number }>();
    const requestId = request.id === undefined ? undefined : String(request.id);

    if (exception instanceof HttpException && isHealthCheckResult(exception.getResponse())) {
      this.logger.warn({ requestId, health: exception.getResponse() }, 'Health check failed');
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const error = toApiError(exception, requestId);
    const issues = serializationIssues(exception);
    if (issues) {
      this.logger.error(
        { requestId, method: request.method, url: request.originalUrl, issues },
        'Response does not match its schema',
      );
    } else if (error.statusCode >= 500) {
      this.logger.error({ err: exception, requestId }, 'Request failed');
    }
    response.status(error.statusCode).json(error);
  }
}
