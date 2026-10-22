import { Module } from '@nestjs/common';
import { FollowsModule } from '../follows/follows.module.js';
import { InvitesController } from './invites.controller.js';
import { InvitesListener } from './invites.listener.js';
import { InvitesService } from './invites.service.js';

@Module({
  imports: [FollowsModule],
  controllers: [InvitesController],
  providers: [InvitesService, InvitesListener],
  exports: [InvitesService],
})
export class InvitesModule {}
