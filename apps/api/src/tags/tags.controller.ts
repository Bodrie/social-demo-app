import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Paginated, Post, TrendingTag } from '@beso/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FeedQueryDto } from '../posts/posts.dto.js';
import { PostsService } from '../posts/posts.service.js';
import { TagParamDto, TrendingQueryDto } from './tags.dto.js';
import { TagsService } from './tags.service.js';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(
    private readonly tags: TagsService,
    private readonly posts: PostsService,
  ) {}

  @Get('trending')
  trending(@Query() query: TrendingQueryDto): Promise<Paginated<TrendingTag>> {
    return this.tags.trending(query.limit);
  }

  /** Every post carrying the tag, newest first; an unknown tag is simply an empty list. */
  @Get(':tag/posts')
  postsForTag(
    @CurrentUser() user: AuthUser,
    @Param() params: TagParamDto,
    @Query() query: FeedQueryDto,
  ): Promise<Paginated<Post>> {
    return this.posts.byTag(user.id, params.tag, query);
  }
}
