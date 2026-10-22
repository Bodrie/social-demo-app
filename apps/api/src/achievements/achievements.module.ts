import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AchievementCounter } from './achievement-counter.js';
import { AchievementsController } from './achievements.controller.js';
import { AchievementsListener } from './achievements.listener.js';
import { AchievementsService } from './achievements.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [AchievementsController],
  providers: [AchievementsService, AchievementCounter, AchievementsListener],
  exports: [AchievementsService],
})
export class AchievementsModule {}
