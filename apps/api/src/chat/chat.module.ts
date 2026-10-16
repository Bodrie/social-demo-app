import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { UsersModule } from '../users/users.module.js';
import { ChatGateway } from './chat.gateway.js';
import { PresenceService } from './presence.service.js';

@Module({
  imports: [AuthModule, UsersModule, ConversationsModule],
  providers: [ChatGateway, PresenceService],
})
export class ChatModule {}
