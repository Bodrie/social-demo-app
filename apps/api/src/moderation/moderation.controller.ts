import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Paginated, Report, UserSummary } from '@beso/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CursorQueryDto, UserIdParamDto } from '../common/params.dto.js';
import { MemberListDto, ReportDto } from '../common/responses.dto.js';
import { CreateReportDto } from './moderation.dto.js';
import { ModerationService } from './moderation.service.js';

@ApiTags('moderation')
@Controller('users')
export class BlocksController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('me/blocked')
  @ZodResponse({ status: 200, type: MemberListDto })
  blocked(
    @CurrentUser() user: AuthUser,
    @Query() query: CursorQueryDto,
  ): Promise<Paginated<UserSummary>> {
    return this.moderation.blocked(user.id, query);
  }

  @Get('me/muted')
  @ZodResponse({ status: 200, type: MemberListDto })
  muted(
    @CurrentUser() user: AuthUser,
    @Query() query: CursorQueryDto,
  ): Promise<Paginated<UserSummary>> {
    return this.moderation.muted(user.id, query);
  }

  @Put(':userId/block')
  @HttpCode(204)
  block(@CurrentUser() user: AuthUser, @Param() params: UserIdParamDto): Promise<void> {
    return this.moderation.block(user.id, params.userId);
  }

  @Delete(':userId/block')
  @HttpCode(204)
  unblock(@CurrentUser() user: AuthUser, @Param() params: UserIdParamDto): Promise<void> {
    return this.moderation.unblock(user.id, params.userId);
  }

  @Put(':userId/mute')
  @HttpCode(204)
  mute(@CurrentUser() user: AuthUser, @Param() params: UserIdParamDto): Promise<void> {
    return this.moderation.mute(user.id, params.userId);
  }

  @Delete(':userId/mute')
  @HttpCode(204)
  unmute(@CurrentUser() user: AuthUser, @Param() params: UserIdParamDto): Promise<void> {
    return this.moderation.unmute(user.id, params.userId);
  }
}

@ApiTags('moderation')
@Controller('reports')
export class ReportsController {
  constructor(private readonly moderation: ModerationService) {}

  /** Ten an hour is plenty for a person and little for a flood. */
  @Post()
  @ZodResponse({ status: 201, type: ReportDto })
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  report(@CurrentUser() user: AuthUser, @Body() body: CreateReportDto): Promise<Report> {
    return this.moderation.report(user.id, body);
  }
}
