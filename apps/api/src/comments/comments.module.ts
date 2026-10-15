import { Module } from '@nestjs/common';
import { CommentsController, PostCommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
  controllers: [PostCommentsController, CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
