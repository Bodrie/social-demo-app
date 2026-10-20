import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Activity, Paginated } from '@beso/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ActivitiesQueryDto } from './activities.dto.js';
import { ActivitiesService } from './activities.service.js';

@ApiTags('activities')
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ActivitiesQueryDto,
  ): Promise<Paginated<Activity>> {
    return this.activities.forViewer(user.id, query);
  }
}
