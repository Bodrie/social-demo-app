import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { type Env, validateEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { AppLoggerModule } from './logging/logger.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    AppLoggerModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get('THROTTLE_TTL_MS', { infer: true }),
            limit: config.get('THROTTLE_LIMIT', { infer: true }),
          },
        ],
      }),
    }),
    PrismaModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
