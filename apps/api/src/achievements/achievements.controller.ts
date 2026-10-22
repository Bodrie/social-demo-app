import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type AchievementList,
  type AchievementStats,
  type MyAchievements,
} from '@beso/shared/achievements';
import { ZodResponse } from 'nestjs-zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UserIdParamDto } from '../common/params.dto.js';
import {
  AchievementListDto,
  AchievementStatsDto,
  MyAchievementsDto,
} from '../common/responses.dto.js';
import { AchievementsService } from './achievements.service.js';

@ApiTags('achievements')
@Controller()
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  /** Declared before `users/:userId/achievements`, which would take `me` for an id. */
  @Get('users/me/achievements')
  @ZodResponse({ status: 200, type: MyAchievementsDto })
  mine(@CurrentUser() user: AuthUser): Promise<MyAchievements> {
    return this.achievements.mine(user.id);
  }

  @Get('users/:userId/achievements')
  @ZodResponse({ status: 200, type: AchievementListDto })
  list(@CurrentUser() user: AuthUser, @Param() params: UserIdParamDto): Promise<AchievementList> {
    return this.achievements.list(user.id, params.userId);
  }

  @Get('achievements/stats')
  @ZodResponse({ status: 200, type: AchievementStatsDto })
  stats(): Promise<AchievementStats> {
    return this.achievements.stats();
  }
}
