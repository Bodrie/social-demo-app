import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserVerifiedEvent } from '../events/user.events.js';
import { InvitesService } from './invites.service.js';

/** A new member's account opened: follow whoever invited them (F1). Never throws. */
@Injectable()
export class InvitesListener {
  private readonly logger = new Logger(InvitesListener.name);

  constructor(private readonly invites: InvitesService) {}

  @OnEvent(UserVerifiedEvent.EVENT)
  async onUserVerified(event: UserVerifiedEvent): Promise<void> {
    try {
      await this.invites.welcome(event.userId);
    } catch (error) {
      this.logger.error({ err: error, userId: event.userId }, 'Could not follow the inviter');
    }
  }
}
