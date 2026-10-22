import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountModule } from '../account/account.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PushModule } from '../push/push.module.js';
import { UploadsModule } from '../uploads/uploads.module.js';
import { JobsScheduler } from './jobs.scheduler.js';
import { JobsService } from './jobs.service.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    AccountModule,
    UploadsModule,
    NotificationsModule,
    PushModule,
  ],
  providers: [JobsService, JobsScheduler],
  exports: [JobsService],
})
export class JobsModule {}
