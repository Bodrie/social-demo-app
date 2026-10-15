import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import type { Env } from './config/env.js';
import { setupOpenApi } from './openapi.js';

export const API_PREFIX = 'api/v1';

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
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }) ? 1 : false);

  app.use(
    helmet({
      // Swagger UI needs inline scripts; it is only mounted outside production.
      contentSecurityPolicy: isProduction ? undefined : false,
      // Uploaded images are public and may be embedded from the web origin in dev.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({ origin: config.get('WEB_ORIGINS', { infer: true }), credentials: true });
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });

  if (!isProduction) {
    setupOpenApi(app);
  }

  return app;
}
