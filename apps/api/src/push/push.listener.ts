import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SessionsEndedEvent } from '../events/auth.events.js';
import { MessageSentEvent } from '../events/conversation.events.js';
import { NotificationCreatedEvent } from '../events/notification.events.js';
import { PushService } from './push.service.js';

/**
 * Turns notifications and messages into pushes and forgets the devices of ended sessions
 * (ADR 0022). Sending talks to the browsers' push services, so it runs detached from the
 * request that caused it: a slow or failing push service never delays an answer. Nothing here
 * throws.
 */
@Injectable()
export class PushListener {
  private readonly logger = new Logger(PushListener.name);

  constructor(private readonly push: PushService) {}

  @OnEvent(NotificationCreatedEvent.EVENT)
  onNotificationCreated(event: NotificationCreatedEvent): void {
    this.detach(this.push.notify(event.userId, event.notification), 'notification');
  }

  @OnEvent(MessageSentEvent.EVENT)
  onMessageSent(event: MessageSentEvent): void {
    this.detach(this.push.message(event.message, event.memberIds), 'message');
  }

  /** Awaited: once a sign-out answers, that device gets nothing more. */
  @OnEvent(SessionsEndedEvent.EVENT)
  async onSessionsEnded(event: SessionsEndedEvent): Promise<void> {
    try {
      await this.push.pruneEnded(new Date(), event.userId);
    } catch (error) {
      this.logger.error({ err: error, userId: event.userId }, 'Could not forget push devices');
    }
  }

  private detach(work: Promise<void>, kind: string): void {
    work.catch((error: unknown) => {
      this.logger.error({ err: error, kind }, 'Could not send push');
    });
  }
}
