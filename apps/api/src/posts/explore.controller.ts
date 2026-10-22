import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Paginated, Post } from '@beso/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { PostListDto } from '../common/responses.dto.js';
import { ExploreQueryDto } from './posts.dto.js';
import { PostsService } from './posts.service.js';

/** Explore (F1): the posts of everyone, for a newcomer whose own feed is still empty. */
@ApiTags('explore')
@Controller('explore')
export class ExploreController {
  constructor(private readonly posts: PostsService) {}

  @Get('posts')
  @ZodResponse({ status: 200, type: PostListDto })
  explore(
    @CurrentUser() user: AuthUser,
    @Query() query: ExploreQueryDto,
  ): Promise<Paginated<Post>> {
    return this.posts.explore(user.id, query);
  }
}
