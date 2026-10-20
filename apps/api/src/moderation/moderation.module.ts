import { Global, Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { BlocksController, ReportsController } from './moderation.controller.js';
import { ModerationService } from './moderation.service.js';
import { VisibilityService } from './visibility.service.js';

/** Global so that every list service can ask `VisibilityService` without importing the module. */
@Global()
@Module({
  imports: [UsersModule],
  controllers: [BlocksController, ReportsController],
  providers: [VisibilityService, ModerationService],
  exports: [VisibilityService, ModerationService],
})
export class ModerationModule {}
