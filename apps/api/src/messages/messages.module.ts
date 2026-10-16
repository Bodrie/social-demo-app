import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module.js';
import { UsersModule } from '../users/users.module.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [UsersModule, UploadsModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
