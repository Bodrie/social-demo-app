import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Conversation, Message, Paginated } from '@the-mesh/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { MessagesQueryDto, SendMessageDto } from './messages.dto.js';
import { MessagesService } from './messages.service.js';

@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  conversations(@CurrentUser() user: AuthUser): Promise<Conversation[]> {
    return this.messages.conversations(user.id);
  }

  @Get(':userId')
  history(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: MessagesQueryDto,
  ): Promise<Paginated<Message>> {
    return this.messages.history(user.id, userId, query);
  }

  /** HTTP fallback for sending; delivery to open sockets happens through the gateway either way. */
  @Post(':userId')
  @HttpCode(201)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  send(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: SendMessageDto,
  ): Promise<Message> {
    return this.messages.send(user.id, userId, body);
  }

  @Post(':userId/read')
  @HttpCode(200)
  markRead(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string): Promise<{ count: number }> {
    return this.messages.markRead(user.id, userId);
  }
}
