import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller.js';
import { ActivitiesListener } from './activities.listener.js';
import { ActivitiesService } from './activities.service.js';

@Module({
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivitiesListener],
})
export class ActivitiesModule {}
