import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CommentCreatedEvent, CommentReactedEvent } from '../events/comment.events.js';
import {
  PostLikedEvent,
  PostQuotedEvent,
  PostRepostedEvent,
  PostUnlikedEvent,
  PostUnrepostedEvent,
} from '../events/post.events.js';
import {
  UserFollowedEvent,
  UserMentionedEvent,
  UserUnfollowedEvent,
} from '../events/user.events.js';
import { type NotificationInput, NotificationsService } from './notifications.service.js';

/**
 * Turns domain events into notifications for the person they concern (ADR 0015), the way
 * `ActivitiesListener` turns them into activity rows. Services `emitAsync`, so the row and
 * its push exist before the triggering request returns; a failure here is logged and never
 * fails that request.
 */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(PostLikedEvent.EVENT)
  onPostLiked(event: PostLikedEvent): Promise<void> {
    return this.notify({
      userId: event.authorId,
      type: 'POST_LIKED',
      actorId: event.actorId,
      postId: event.postId,
    });
  }

  @OnEvent(PostUnlikedEvent.EVENT)
  onPostUnliked(event: PostUnlikedEvent): Promise<void> {
    return this.retract({ type: 'POST_LIKED', actorId: event.actorId, postId: event.postId });
  }

  @OnEvent(PostRepostedEvent.EVENT)
  onPostReposted(event: PostRepostedEvent): Promise<void> {
    return this.notify({
      userId: event.authorId,
      type: 'POST_REPOSTED',
      actorId: event.actorId,
      postId: event.postId,
    });
  }

  @OnEvent(PostUnrepostedEvent.EVENT)
  onPostUnreposted(event: PostUnrepostedEvent): Promise<void> {
    return this.retract({ type: 'POST_REPOSTED', actorId: event.actorId, postId: event.postId });
  }

  /** The quote is the subject: its page shows the quoter's words above the embedded original. */
  @OnEvent(PostQuotedEvent.EVENT)
  onPostQuoted(event: PostQuotedEvent): Promise<void> {
    return this.notify({
      userId: event.originalAuthorId,
      type: 'POST_QUOTED',
      actorId: event.actorId,
      postId: event.quoteId,
    });
  }

  @OnEvent(CommentCreatedEvent.EVENT)
  onCommentCreated(event: CommentCreatedEvent): Promise<void> {
    return this.notify({
      userId: event.postAuthorId,
      type: 'POST_COMMENTED',
      actorId: event.authorId,
      postId: event.postId,
      commentId: event.commentId,
    });
  }

  @OnEvent(CommentReactedEvent.EVENT)
  onCommentReacted(event: CommentReactedEvent): Promise<void> {
    return this.notify({
      userId: event.commentAuthorId,
      type: 'COMMENT_REACTED',
      actorId: event.actorId,
      postId: event.postId,
      commentId: event.commentId,
    });
  }

  @OnEvent(UserFollowedEvent.EVENT)
  onUserFollowed(event: UserFollowedEvent): Promise<void> {
    return this.notify({
      userId: event.followeeId,
      type: 'USER_FOLLOWED',
      actorId: event.followerId,
    });
  }

  @OnEvent(UserUnfollowedEvent.EVENT)
  onUserUnfollowed(event: UserUnfollowedEvent): Promise<void> {
    return this.retract({
      userId: event.followeeId,
      type: 'USER_FOLLOWED',
      actorId: event.followerId,
    });
  }

  @OnEvent(UserMentionedEvent.EVENT)
  onUserMentioned(event: UserMentionedEvent): Promise<void> {
    return this.notify({
      userId: event.targetUserId,
      type: event.commentId === null ? 'MENTIONED_IN_POST' : 'MENTIONED_IN_COMMENT',
      actorId: event.actorId,
      postId: event.postId,
      commentId: event.commentId,
    });
  }

  private async notify(input: NotificationInput): Promise<void> {
    try {
      await this.notifications.notify(input);
    } catch (error) {
      this.logger.error({ err: error, notification: input }, 'Could not write notification');
    }
  }

  private async retract(where: Parameters<NotificationsService['retract']>[0]): Promise<void> {
    try {
      await this.notifications.retract(where);
    } catch (error) {
      this.logger.error({ err: error, notification: where }, 'Could not remove notification');
    }
  }
}
