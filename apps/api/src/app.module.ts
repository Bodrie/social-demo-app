import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { AccountModule } from './account/account.module.js';
import { ActivitiesModule } from './activities/activities.module.js';
import { AssetsModule } from './assets/assets.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { CREDENTIAL_THROTTLERS } from './auth/credential-throttle.js';
import { ChatModule } from './chat/chat.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { HttpThrottlerGuard } from './common/guards/http-throttler.guard.js';
import { type Env, validateEnv } from './config/env.js';
import { FollowsModule } from './follows/follows.module.js';
import { HealthModule } from './health/health.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { AppLoggerModule } from './logging/logger.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PostsModule } from './posts/posts.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SearchModule } from './search/search.module.js';
import { TagsModule } from './tags/tags.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Tests pin every variable they need; a developer's .env must not leak into them.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    AppLoggerModule,
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get('THROTTLE_TTL_MS', { infer: true }),
            limit: config.get('THROTTLE_LIMIT', { infer: true }),
          },
          ...CREDENTIAL_THROTTLERS,
        ],
      }),
    }),
    PrismaModule,
    AssetsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ModerationModule,
    AccountModule,
    UploadsModule,
    PostsModule,
    CommentsModule,
    TagsModule,
    SearchModule,
    FollowsModule,
    ActivitiesModule,
    NotificationsModule,
    ConversationsModule,
    ChatModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // No response serializer: nothing is annotated with @ZodSerializerDto (backlog: @ZodResponse).
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    // Order matters: rate limiting first, then authentication.
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
