import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Paginated, Post as PostItem } from '@the-mesh/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CreatePostDto, FeedQueryDto } from './posts.dto.js';
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
  byId(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PostItem> {
    return this.posts.getById(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.posts.delete(user.id, id);
  }

  @Put(':id/like')
  @HttpCode(204)
  like(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.posts.like(user.id, id);
  }

  @Delete(':id/like')
  @HttpCode(204)
  unlike(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.posts.unlike(user.id, id);
  }
}

@ApiTags('posts')
@Controller('users/:userId/posts')
export class UserPostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  byAuthor(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: FeedQueryDto,
  ): Promise<Paginated<PostItem>> {
    return this.posts.byAuthor(user.id, userId, query);
  }
}
