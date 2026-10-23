import { Body, Controller, Get, HttpCode, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type AchievementList,
  type AchievementStats,
  type MyAchievements,
  featuredBadgesSchema,
} from '@beso/shared/achievements';
import { ZodResponse, createZodDto } from 'nestjs-zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UserIdParamDto } from '../common/params.dto.js';
import {
  AchievementListDto,
  AchievementStatsDto,
  MyAchievementsDto,
} from '../common/responses.dto.js';
import { AchievementsService } from './achievements.service.js';

class FeaturedBadgesDto extends createZodDto(featuredBadgesSchema) {}

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

  /** Up to three held badges to show under the member's name; `[]` goes back to the rarest. */
  @Put('users/me/featured-badges')
  @HttpCode(204)
  feature(@CurrentUser() user: AuthUser, @Body() body: FeaturedBadgesDto): Promise<void> {
    return this.achievements.feature(user.id, body.keys);
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
