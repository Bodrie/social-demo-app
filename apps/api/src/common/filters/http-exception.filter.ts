import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isHealthCheckResult, toApiError } from '../errors.js';

/**
 * Catch-all filter: every HTTP error becomes the shared ApiError envelope,
 * terminus health results pass through, and WebSocket handler errors are
 * emitted to the client as an `exception` event with the same envelope.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

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
    if (error.statusCode >= 500) {
      this.logger.error({ err: exception, requestId }, 'Request failed');
    }
    response.status(error.statusCode).json(error);
  }
}
