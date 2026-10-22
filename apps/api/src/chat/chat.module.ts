import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { TokensModule } from '../tokens/tokens.module.js';
import { UsersModule } from '../users/users.module.js';
import { ChatGateway } from './chat.gateway.js';
import { PresenceService } from './presence.service.js';

@Module({
  imports: [TokensModule, UsersModule, ConversationsModule],
  providers: [ChatGateway, PresenceService],
})
export class ChatModule {}
