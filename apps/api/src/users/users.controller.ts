import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { MeResponse, Paginated, UserPublic } from '@the-mesh/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { IdParamDto, UsernameParamDto } from '../common/params.dto.js';
import {
  ListUsersQueryDto,
  SuggestionsQueryDto,
  UpdateProfileDto,
  UpdateSettingsDto,
} from './users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<Paginated<UserPublic>> {
    return this.users.list(user.id, query);
  }

  /** The caller's own profile is read through GET /auth/me; this is the only writer. */
  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateProfileDto,
  ): Promise<MeResponse> {
    return { user: await this.users.updateProfile(user.id, body) };
  }

  /** Account-level preferences; any subset of the keys, answered with the full profile. */
  @Patch('me/settings')
  async updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateSettingsDto,
  ): Promise<MeResponse> {
    return { user: await this.users.updateSettings(user.id, body) };
  }

  @Get('suggestions')
  suggestions(
    @CurrentUser() user: AuthUser,
    @Query() query: SuggestionsQueryDto,
  ): Promise<Paginated<UserPublic>> {
    return this.users.suggestions(user.id, query.limit);
  }

  @Get('by-username/:username')
  byUsername(
    @CurrentUser() user: AuthUser,
    @Param() params: UsernameParamDto,
  ): Promise<UserPublic> {
    return this.users.getPublicByUsername(user.id, params.username);
  }

  @Get(':id')
  byId(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<UserPublic> {
    return this.users.getPublicById(user.id, params.id);
  }
}
