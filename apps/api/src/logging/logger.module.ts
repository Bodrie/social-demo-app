import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from '../config/env.js';
import { requestId } from './request-id.js';

/** Structured JSON logs (pino) with request ids; pretty output in development only. */
export const AppLoggerModule = LoggerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) => {
    const isDevelopment = config.get('NODE_ENV', { infer: true }) === 'development';
    return {
      pinoHttp: {
        level: config.get('LOG_LEVEL', { infer: true }),
        genReqId: requestId,
        autoLogging: { ignore: (req) => req.url === '/health' },
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
