import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Paginated, UserPrivate, UserPublic } from '@the-mesh/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ListUsersQueryDto, SuggestionsQueryDto, UpdateProfileDto } from './users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto): Promise<Paginated<UserPublic>> {
    return this.users.list(query);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<UserPrivate> {
    return this.users.getPrivateById(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() body: UpdateProfileDto): Promise<UserPrivate> {
    return this.users.updateProfile(user.id, body);
  }

  @Get('suggestions')
  suggestions(@CurrentUser() user: AuthUser, @Query() query: SuggestionsQueryDto): Promise<UserPublic[]> {
    return this.users.suggestions(user.id, query.limit);
  }

  @Get('by-username/:username')
  byUsername(@Param('username') username: string): Promise<UserPublic> {
    return this.users.getPublicByUsername(username);
  }

  @Get(':id')
  byId(@Param('id', ParseUUIDPipe) id: string): Promise<UserPublic> {
    return this.users.getPublicById(id);
  }
}
