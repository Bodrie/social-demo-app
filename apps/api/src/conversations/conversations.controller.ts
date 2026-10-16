import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Conversation, MarkReadResult, Message, Paginated } from '@the-mesh/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { IdParamDto, UserIdParamDto } from '../common/params.dto.js';
import {
  AddMembersDto,
  CreateGroupDto,
  MessagesQueryDto,
  SendMessageDto,
} from './conversations.dto.js';
import { ConversationsService } from './conversations.service.js';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<Paginated<Conversation>> {
    return this.conversations.list(user.id);
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  createGroup(@CurrentUser() user: AuthUser, @Body() body: CreateGroupDto): Promise<Conversation> {
    return this.conversations.createGroup(user.id, body);
  }

  /** Idempotent: opens the direct thread with someone, creating it the first time. */
  @Put('direct/:userId')
  @HttpCode(200)
  ensureDirect(
    @CurrentUser() user: AuthUser,
    @Param() params: UserIdParamDto,
  ): Promise<Conversation> {
    return this.conversations.ensureDirect(user.id, params.userId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<Conversation> {
    return this.conversations.get(user.id, params.id);
  }

  @Get(':id/messages')
  history(
    @CurrentUser() user: AuthUser,
    @Param() params: IdParamDto,
    @Query() query: MessagesQueryDto,
  ): Promise<Paginated<Message>> {
    return this.conversations.history(user.id, params.id, query);
  }

  /** HTTP fallback for sending; delivery to open sockets happens through the gateway either way. */
  @Post(':id/messages')
  @HttpCode(201)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  send(
    @CurrentUser() user: AuthUser,
    @Param() params: IdParamDto,
    @Body() body: SendMessageDto,
  ): Promise<Message> {
    return this.conversations.send(user.id, params.id, body);
  }

  @Post(':id/read')
  @HttpCode(200)
  markRead(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<MarkReadResult> {
    return this.conversations.markRead(user.id, params.id);
  }

  @Post(':id/members')
  @HttpCode(200)
  addMembers(
    @CurrentUser() user: AuthUser,
    @Param() params: IdParamDto,
    @Body() body: AddMembersDto,
  ): Promise<Conversation> {
    return this.conversations.addMembers(user.id, params.id, body);
  }

  @Delete(':id/members/me')
  @HttpCode(204)
  leave(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<void> {
    return this.conversations.leave(user.id, params.id);
  }
}
