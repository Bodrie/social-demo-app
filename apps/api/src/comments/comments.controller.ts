import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Comment, Paginated } from '@the-mesh/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CommentsQueryDto, CreateCommentDto } from './comments.dto.js';
import { CommentsService } from './comments.service.js';

@ApiTags('comments')
@Controller('posts/:postId/comments')
export class PostCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: CommentsQueryDto,
  ): Promise<Paginated<Comment>> {
    return this.comments.listForPost(postId, query);
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() body: CreateCommentDto,
  ): Promise<Comment> {
    return this.comments.create(user.id, postId, body);
  }
}

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.comments.delete(user.id, id);
  }
}
