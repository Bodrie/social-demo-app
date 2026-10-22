import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AccountModule } from './account/account.module.js';
import { AchievementsModule } from './achievements/achievements.module.js';
import { ActivitiesModule } from './activities/activities.module.js';
import { AdminModule } from './admin/admin.module.js';
import { RolesGuard } from './admin/roles.guard.js';
import { AssetsModule } from './assets/assets.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { CREDENTIAL_THROTTLERS } from './auth/credential-throttle.js';
import { ChatModule } from './chat/chat.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { HttpThrottlerGuard } from './common/guards/http-throttler.guard.js';
import { type Env, validateEnv } from './config/env.js';
import { FollowsModule } from './follows/follows.module.js';
import { HealthModule } from './health/health.module.js';
import { InvitesModule } from './invites/invites.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { AppLoggerModule } from './logging/logger.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PostsModule } from './posts/posts.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PushModule } from './push/push.module.js';
import { SearchModule } from './search/search.module.js';
import { TagsModule } from './tags/tags.module.js';
import { TokensModule } from './tokens/tokens.module.js';
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
    // For the global AuthGuard below.
    TokensModule,
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
    InvitesModule,
    ActivitiesModule,
    NotificationsModule,
    AchievementsModule,
    PushModule,
    ConversationsModule,
    ChatModule,
    JobsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Every JSON handler declares its shape with @ZodResponse: the answer is parsed with the
    // shared schema (unknown keys dropped, a mismatch is a logged 500) and documented in OpenAPI.
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    // Order matters: rate limiting first, then authentication, then the role (needs the token's claim).
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
