import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module.js';
import { UsersModule } from '../users/users.module.js';
import { ExploreController } from './explore.controller.js';
import { BookmarksController, PostsController, UserPostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  imports: [UploadsModule, UsersModule],
  controllers: [PostsController, UserPostsController, BookmarksController, ExploreController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
