import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Paginated, Post } from '@beso/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { PostsService } from '../posts/posts.service.js';
import { SearchQueryDto } from './search.dto.js';

/** People are searched through `GET /users?q=`; this is the home of everything else. */
@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly posts: PostsService) {}

  @Get('posts')
  searchPosts(
    @CurrentUser() user: AuthUser,
    @Query() query: SearchQueryDto,
  ): Promise<Paginated<Post>> {
    return this.posts.search(user.id, query);
  }
}
