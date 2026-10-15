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

  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  app.get(Logger).log(`API listening on port ${port} (${config.get('NODE_ENV', { infer: true })})`);
}

await bootstrap();
