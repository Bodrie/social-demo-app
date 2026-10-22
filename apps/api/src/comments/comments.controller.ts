import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Comment, Paginated, ReactionSummary, Revision } from '@beso/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CursorQueryDto, IdParamDto, PostIdParamDto } from '../common/params.dto.js';
import {
  CommentDto,
  CommentListDto,
  ReactionSummaryDto,
  RevisionListDto,
} from '../common/responses.dto.js';
import {
  CommentsQueryDto,
  CreateCommentDto,
  SetReactionDto,
  UpdateCommentDto,
} from './comments.dto.js';
import { CommentsService } from './comments.service.js';

@ApiTags('comments')
@Controller('posts/:postId/comments')
export class PostCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @ZodResponse({ status: 200, type: CommentListDto })
  list(
    @CurrentUser() user: AuthUser,
    @Param() params: PostIdParamDto,
    @Query() query: CommentsQueryDto,
  ): Promise<Paginated<Comment>> {
    return this.comments.listForPost(user.id, params.postId, query);
  }

  @Post()
  @ZodResponse({ status: 201, type: CommentDto })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(
    @CurrentUser() user: AuthUser,
    @Param() params: PostIdParamDto,
    @Body() body: CreateCommentDto,
  ): Promise<Comment> {
    return this.comments.create(user.id, params.postId, body);
  }
}

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  /** A single comment, for permalinks (`/p/:postId?comment=:id`) that point past the first page. */
  @Get(':id')
  @ZodResponse({ status: 200, type: CommentDto })
  byId(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<Comment> {
    return this.comments.getById(user.id, params.id);
  }

  /** The replies under a top-level comment, oldest first. */
  @Get(':id/replies')
  @ZodResponse({ status: 200, type: CommentListDto })
  replies(
    @CurrentUser() user: AuthUser,
    @Param() params: IdParamDto,
    @Query() query: CursorQueryDto,
  ): Promise<Paginated<Comment>> {
    return this.comments.replies(user.id, params.id, query);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: CommentDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateCommentDto,
  ): Promise<Comment> {
    return this.comments.update(user.id, params.id, body);
  }

  @Get(':id/revisions')
  @ZodResponse({ status: 200, type: RevisionListDto })
  revisions(
    @Param() params: IdParamDto,
    @Query() query: CursorQueryDto,
  ): Promise<Paginated<Revision>> {
    return this.comments.revisions(params.id, query);
  }

  /** Sets or switches the caller's reaction; answers with the fresh summary. */
  @Put(':id/reaction')
  @ZodResponse({ status: 200, type: ReactionSummaryDto })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  react(
    @CurrentUser() user: AuthUser,
    @Param() params: IdParamDto,
    @Body() body: SetReactionDto,
  ): Promise<ReactionSummary> {
    return this.comments.react(user.id, params.id, body.type);
  }

  @Delete(':id/reaction')
  @ZodResponse({ status: 200, type: ReactionSummaryDto })
  unreact(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<ReactionSummary> {
    return this.comments.unreact(user.id, params.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<void> {
    return this.comments.delete(user.id, params.id);
  }
}
