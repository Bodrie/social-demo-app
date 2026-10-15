import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module.js';
import { CommentsController, PostCommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
  imports: [PostsModule],
  controllers: [PostCommentsController, CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
