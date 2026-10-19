import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module.js';
import { UsersModule } from '../users/users.module.js';
import { CommentsController, PostCommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
  imports: [PostsModule, UsersModule],
  controllers: [PostCommentsController, CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
