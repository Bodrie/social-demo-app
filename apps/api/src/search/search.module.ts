import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module.js';
import { SearchController } from './search.controller.js';

@Module({
  imports: [PostsModule],
  controllers: [SearchController],
})
export class SearchModule {}
