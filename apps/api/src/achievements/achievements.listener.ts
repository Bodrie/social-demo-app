import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { type AchievementSeries } from '@beso/shared/achievements';
import { CommentCreatedEvent, CommentReactedEvent } from '../events/comment.events.js';
import {
  GroupCreatedEvent,
  MessageSentEvent,
  MessageUpdatedEvent,
} from '../events/conversation.events.js';
import {
  PostBookmarkedEvent,
  PostCreatedEvent,
  PostLikedEvent,
  PostQuotedEvent,
  PostRepostedEvent,
} from '../events/post.events.js';
import {
  ProfileUpdatedEvent,
  PushSubscribedEvent,
  UserFollowedEvent,
  UserMentionedEvent,
  UserVerifiedEvent,
} from '../events/user.events.js';
import { AchievementsService } from './achievements.service.js';

/** What a post of the member's own counts towards. */
const POST_SERIES: readonly AchievementSeries[] = [
  'posts',
  'picture-posts',
  'pictures',
  'hashtag-posts',
  'tags',
];

/**
 * Maps domain events to the member and the series they touch (F2, ADR 0021), the twin of
 * `NotificationsListener`. A failure is logged and never fails the request; the daily sweep
 * catches up on whatever was missed.
 */
@Injectable()
export class AchievementsListener {
  private readonly logger = new Logger(AchievementsListener.name);

  constructor(private readonly achievements: AchievementsService) {}

  @OnEvent(PostCreatedEvent.EVENT)
  onPostCreated(event: PostCreatedEvent): Promise<void> {
    return this.check(event.authorId, POST_SERIES);
  }

  @OnEvent(PostQuotedEvent.EVENT)
  onPostQuoted(event: PostQuotedEvent): Promise<void> {
    return this.check(event.actorId, [...POST_SERIES, 'quotes', 'amplified']);
  }

  @OnEvent(PostRepostedEvent.EVENT)
  onPostReposted(event: PostRepostedEvent): Promise<void> {
    return this.check(event.actorId, ['reposts', 'amplified']);
  }

  @OnEvent(UserMentionedEvent.EVENT)
  onUserMentioned(event: UserMentionedEvent): Promise<void> {
    return this.check(event.actorId, ['mentions-given']);
  }

  @OnEvent(CommentCreatedEvent.EVENT)
  onCommentCreated(event: CommentCreatedEvent): Promise<void> {
    return this.check(event.authorId, ['comments', 'replies']);
  }

  @OnEvent(PostLikedEvent.EVENT)
  onPostLiked(event: PostLikedEvent): Promise<void> {
    return this.check(event.actorId, ['likes-given']);
  }

  @OnEvent(CommentReactedEvent.EVENT)
  onCommentReacted(event: CommentReactedEvent): Promise<void> {
    return this.check(event.actorId, ['reactions-given']);
  }

  /** An edit or a reaction; counting the reactions again after an edit costs one count. */
  @OnEvent(MessageUpdatedEvent.EVENT)
  onMessageUpdated(event: MessageUpdatedEvent): Promise<void> {
    return this.check(event.actorId, ['reactions-given']);
  }

  @OnEvent(MessageSentEvent.EVENT)
  async onMessageSent(event: MessageSentEvent): Promise<void> {
    if (event.message.kind !== 'user') return;
    await this.check(event.message.senderId, ['messages']);
  }

  @OnEvent(GroupCreatedEvent.EVENT)
  onGroupCreated(event: GroupCreatedEvent): Promise<void> {
    return this.check(event.creatorId, ['groups-created']);
  }

  @OnEvent(UserFollowedEvent.EVENT)
  onUserFollowed(event: UserFollowedEvent): Promise<void> {
    return this.check(event.followerId, ['following']);
  }

  @OnEvent(PostBookmarkedEvent.EVENT)
  onPostBookmarked(event: PostBookmarkedEvent): Promise<void> {
    return this.check(event.userId, ['bookmarks']);
  }

  @OnEvent(PushSubscribedEvent.EVENT)
  onPushSubscribed(event: PushSubscribedEvent): Promise<void> {
    return this.check(event.userId, ['push-devices']);
  }

  @OnEvent(ProfileUpdatedEvent.EVENT)
  onProfileUpdated(event: ProfileUpdatedEvent): Promise<void> {
    return this.check(event.userId, ['avatar', 'cover', 'bio', 'full-profile']);
  }

  /** The account opened: the tenure badges a newcomer can have from day one (Pioneer, …). */
  @OnEvent(UserVerifiedEvent.EVENT)
  onUserVerified(event: UserVerifiedEvent): Promise<void> {
    return this.check(event.userId, ['membership-days', 'pioneer', 'founding', 'first-100']);
  }

  private async check(userId: string, series: readonly AchievementSeries[]): Promise<void> {
    try {
      await this.achievements.check(userId, series);
    } catch (error) {
      this.logger.error({ err: error, userId, series }, 'Could not check achievements');
    }
  }
}
