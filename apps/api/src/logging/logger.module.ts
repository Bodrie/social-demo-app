import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from '../config/env.js';
import { requestId } from './request-id.js';

type SerializedRequest = {
  id?: unknown;
  method?: string;
  url?: string;
  remoteAddress?: string;
  headers?: Record<string, unknown>;
};

/** Structured JSON logs (pino) with request ids; pretty output in development only. */
export const AppLoggerModule = LoggerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) => {
    const isDevelopment = config.get('NODE_ENV', { infer: true }) === 'development';
    return {
      pinoHttp: {
        level: config.get('LOG_LEVEL', { infer: true }),
        genReqId: requestId,
        autoLogging: { ignore: (req) => (req.url ?? '').split('?')[0] === '/health' },
        customLogLevel: (_req, res, error) => {
          if (error || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        // Only what is needed to correlate and debug: no cookies, no auth headers, no bodies.
        serializers: {
          req: (req: SerializedRequest) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
            userAgent: req.headers?.['user-agent'],
          }),
        },
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
      },
    };
  },
});
