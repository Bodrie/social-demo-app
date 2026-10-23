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
import type { Paginated, Post as PostItem, Revision } from '@beso/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CursorQueryDto, IdParamDto, UserIdParamDto } from '../common/params.dto.js';
import { PostDto, PostListDto, RevisionListDto } from '../common/responses.dto.js';
import {
  CreatePostDto,
  FeedQueryDto,
  UpdatePostDto,
  UserPostsQueryDto,
  VotePollDto,
} from './posts.dto.js';
import { PollsService } from './polls.service.js';
import { PostsService } from './posts.service.js';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly polls: PollsService,
  ) {}

  @Get()
  @ZodResponse({ status: 200, type: PostListDto })
  feed(@CurrentUser() user: AuthUser, @Query() query: FeedQueryDto): Promise<Paginated<PostItem>> {
    return this.posts.feed(user.id, query);
  }

  @Post()
  @ZodResponse({ status: 201, type: PostDto })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(@CurrentUser() user: AuthUser, @Body() body: CreatePostDto): Promise<PostItem> {
    return this.posts.create(user.id, body);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: PostDto })
  byId(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<PostItem> {
    return this.posts.getById(user.id, params.id);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: PostDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param() params: IdParamDto,
    @Body() body: UpdatePostDto,
  ): Promise<PostItem> {
    return this.posts.update(user.id, params.id, body);
  }

  @Get(':id/revisions')
  @ZodResponse({ status: 200, type: RevisionListDto })
  revisions(
    @Param() params: IdParamDto,
    @Query() query: CursorQueryDto,
  ): Promise<Paginated<Revision>> {
    return this.posts.revisions(params.id, query);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<void> {
    return this.posts.delete(user.id, params.id);
  }

  @Put(':id/like')
  @HttpCode(204)
  like(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<void> {
    return this.posts.like(user.id, params.id);
  }

  @Delete(':id/like')
  @HttpCode(204)
  unlike(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<void> {
    return this.posts.unlike(user.id, params.id);
  }

  @Put(':id/bookmark')
  @HttpCode(204)
  bookmark(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<void> {
    return this.posts.bookmark(user.id, params.id);
  }

  @Delete(':id/bookmark')
  @HttpCode(204)
  unbookmark(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<void> {
    return this.posts.unbookmark(user.id, params.id);
  }

  /** A plain repost; a quote is `POST /posts` with `quotedPostId` (ADR 0017). */
  @Put(':id/repost')
  @HttpCode(204)
  repost(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<void> {
    return this.posts.repost(user.id, params.id);
  }

  @Delete(':id/repost')
  @HttpCode(204)
  unrepost(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<void> {
    return this.posts.unrepost(user.id, params.id);
  }

  /** One vote, final (F3); the answer carries the results the voter may now see. */
  @Put(':id/poll/vote')
  @ZodResponse({ status: 200, type: PostDto })
  vote(
    @CurrentUser() user: AuthUser,
    @Param() params: IdParamDto,
    @Body() body: VotePollDto,
  ): Promise<PostItem> {
    return this.polls.vote(user.id, params.id, body.optionId);
  }
}

@ApiTags('posts')
@Controller('users/:userId/posts')
export class UserPostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @ZodResponse({ status: 200, type: PostListDto })
  byAuthor(
    @CurrentUser() user: AuthUser,
    @Param() params: UserIdParamDto,
    @Query() query: UserPostsQueryDto,
  ): Promise<Paginated<PostItem>> {
    return this.posts.byAuthor(user.id, params.userId, query);
  }
}

/** The viewer's own saved posts (C3a); there is no list of anyone else's. */
@ApiTags('posts')
@Controller('users/me/bookmarks')
export class BookmarksController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @ZodResponse({ status: 200, type: PostListDto })
  list(@CurrentUser() user: AuthUser, @Query() query: FeedQueryDto): Promise<Paginated<PostItem>> {
    return this.posts.bookmarks(user.id, query);
  }
}
