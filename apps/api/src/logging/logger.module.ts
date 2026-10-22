import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Options } from 'pino-http';
import type { Env } from '../config/env.js';
import { requestId } from './request-id.js';

/** What pino-http hands the `req` serializer; `raw` is the Express request itself. */
type SerializedRequest = {
  id?: unknown;
  method?: string;
  url?: string;
  headers?: Record<string, unknown>;
  raw?: { ip?: unknown };
};

/**
 * Only what is needed to correlate and debug: no cookies, no auth headers, no bodies. `ip` is
 * the client as Express resolves it through `trust proxy` (TRUST_PROXY), the address the
 * throttles and the sessions list use too: behind Caddy, the visitor. The socket's
 * `remoteAddress`, pino's default, is always Caddy's container there (review L26).
 */
export function serializeRequest(req: SerializedRequest) {
  return {
    id: req.id,
    method: req.method,
    url: req.url,
    ip: typeof req.raw?.ip === 'string' ? req.raw.ip : undefined,
    userAgent: req.headers?.['user-agent'],
  };
}

/** The pino-http options; exported so the integration tests can route the same lines to a stream. */
export function pinoHttpOptions(config: ConfigService<Env, true>): Options {
  const isDevelopment = config.get('NODE_ENV', { infer: true }) === 'development';
  return {
    level: config.get('LOG_LEVEL', { infer: true }),
    genReqId: requestId,
    autoLogging: { ignore: (req) => (req.url ?? '').split('?')[0] === '/health' },
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: { req: serializeRequest },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: { colorize: true, singleLine: true, translateTime: 'HH:MM:ss.l' },
        }
      : undefined,
  };
}

/** Structured JSON logs (pino) with request ids; pretty output in development only. */
export const AppLoggerModule = LoggerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) => ({ pinoHttp: pinoHttpOptions(config) }),
});
