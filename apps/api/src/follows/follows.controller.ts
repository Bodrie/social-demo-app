import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Paginated, UserPublic } from '@the-mesh/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FollowsQueryDto } from './follows.dto.js';
import { FollowsService } from './follows.service.js';

@ApiTags('follows')
@Controller('users/:userId')
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @Put('follow')
  @HttpCode(204)
  follow(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    return this.follows.follow(user.id, userId);
  }

  @Delete('follow')
  @HttpCode(204)
  unfollow(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    return this.follows.unfollow(user.id, userId);
  }

  @Get('followers')
  followers(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: FollowsQueryDto,
  ): Promise<Paginated<UserPublic>> {
    return this.follows.followers(user.id, userId, query);
  }

  @Get('following')
  following(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: FollowsQueryDto,
  ): Promise<Paginated<UserPublic>> {
    return this.follows.following(user.id, userId, query);
  }
}
