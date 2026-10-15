import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Conversation, MarkReadResult, Message, Paginated } from '@the-mesh/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UserIdParamDto } from '../common/params.dto.js';
import { MessagesQueryDto, SendMessageDto } from './messages.dto.js';
import { MessagesService } from './messages.service.js';

@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  conversations(@CurrentUser() user: AuthUser): Promise<Paginated<Conversation>> {
    return this.messages.conversations(user.id);
  }

  @Get(':userId')
  history(
    @CurrentUser() user: AuthUser,
    @Param() params: UserIdParamDto,
    @Query() query: MessagesQueryDto,
  ): Promise<Paginated<Message>> {
    return this.messages.history(user.id, params.userId, query);
  }

  /** HTTP fallback for sending; delivery to open sockets happens through the gateway either way. */
  @Post(':userId')
  @HttpCode(201)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  send(
    @CurrentUser() user: AuthUser,
    @Param() params: UserIdParamDto,
    @Body() body: SendMessageDto,
  ): Promise<Message> {
    return this.messages.send(user.id, params.userId, body);
  }

  @Post(':userId/read')
  @HttpCode(200)
  markRead(@CurrentUser() user: AuthUser, @Param() params: UserIdParamDto): Promise<MarkReadResult> {
    return this.messages.markRead(user.id, params.userId);
  }
}
