import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppSocketIoAdapter } from './chat/socket.adapter.js';
import { API_PREFIX } from './common/constants.js';
import { originCheck } from './common/origin-check.js';
import type { Env } from './config/env.js';
import { setupOpenApi } from './openapi.js';

/**
 * Everything that is configured on the application instance rather than in a
 * module: logger, proxy trust, security headers, CORS, URL prefix, OpenAPI.
 * Shared by main.ts and the integration tests so they exercise the same setup.
 */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const config = app.get(ConfigService<Env, true>);
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));

  app.use(cookieParser());
  app.use(
    helmet({
      // Swagger UI needs inline scripts; it is only mounted outside production.
      contentSecurityPolicy: isProduction ? undefined : false,
      // Uploaded images are public and may be embedded from the web origin in dev.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  const origins = config.get('WEB_ORIGINS', { infer: true });
  // Cookie sessions: a browser page we did not serve may read nothing (CORS) and change nothing (Origin check).
  app.use(originCheck(origins));
  app.enableCors({ origin: origins, credentials: true });
  app.useWebSocketAdapter(new AppSocketIoAdapter(app, origins));
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });

  if (!isProduction) {
    setupOpenApi(app);
  }

  return app;
}
