import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module.js';
import { TagsController } from './tags.controller.js';
import { TagsService } from './tags.service.js';

@Module({
  imports: [PostsModule],
  controllers: [TagsController],
  providers: [TagsService],
})
export class TagsModule {}
