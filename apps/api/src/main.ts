import { Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureApp(app);

  // Backstop for promises nobody awaits (framework hooks drop them): log the failure instead of
  // letting Node's default end the process, and every open request and socket with it.
  const processLogger = new NestLogger('Process');
  process.on('unhandledRejection', (reason) => {
    processLogger.error({ err: reason }, 'Unhandled promise rejection');
  });

  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  app.get(Logger).log(`API listening on port ${port} (${config.get('NODE_ENV', { infer: true })})`);
}

await bootstrap();
