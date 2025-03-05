import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerCall } from './common/services/logger.service';

async function bootstrap() {
  const PORT = process.env.PORT || 8080;
  const ORIGINS = process.env.ORIGINS || 'http://localhost:3000';
  const app = await NestFactory.create(AppModule, {
    cors: { origin: ORIGINS },
    // logger: new LoggerCall(),
  });

  app.setGlobalPrefix('api/v2');

  await app.listen(PORT);
}
bootstrap();
