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
import type { Paginated, Post as PostItem, Revision } from '@the-mesh/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CursorQueryDto, IdParamDto, UserIdParamDto } from '../common/params.dto.js';
import { CreatePostDto, FeedQueryDto, UpdatePostDto } from './posts.dto.js';
import { PostsService } from './posts.service.js';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  feed(@CurrentUser() user: AuthUser, @Query() query: FeedQueryDto): Promise<Paginated<PostItem>> {
    return this.posts.feed(user.id, query);
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(@CurrentUser() user: AuthUser, @Body() body: CreatePostDto): Promise<PostItem> {
    return this.posts.create(user.id, body);
  }

  @Get(':id')
  byId(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<PostItem> {
    return this.posts.getById(user.id, params.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param() params: IdParamDto,
    @Body() body: UpdatePostDto,
  ): Promise<PostItem> {
    return this.posts.update(user.id, params.id, body);
  }

  @Get(':id/revisions')
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
}

@ApiTags('posts')
@Controller('users/:userId/posts')
export class UserPostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  byAuthor(
    @CurrentUser() user: AuthUser,
    @Param() params: UserIdParamDto,
    @Query() query: FeedQueryDto,
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
  list(@CurrentUser() user: AuthUser, @Query() query: FeedQueryDto): Promise<Paginated<PostItem>> {
    return this.posts.bookmarks(user.id, query);
  }
}
