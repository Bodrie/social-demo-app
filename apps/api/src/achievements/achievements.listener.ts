import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { type AchievementSeries } from '@beso/shared/achievements';
import { CommentCreatedEvent, CommentReactedEvent } from '../events/comment.events.js';
import {
  ConversationUpdatedEvent,
  GroupCreatedEvent,
  MessageSentEvent,
  MessageUpdatedEvent,
} from '../events/conversation.events.js';
import {
  PostBookmarkedEvent,
  PostCreatedEvent,
  PostEditedEvent,
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

/** What the words of a post count towards; an edit can change them. */
const TEXT_SERIES: readonly AchievementSeries[] = [
  'hashtag-posts',
  'tags',
  'home-team',
  'emoji-only',
  'palindrome',
  'full-length',
  'trick-or-treat',
  'un-beso',
];

/** What a post of the member's own counts towards. */
const POST_SERIES: readonly AchievementSeries[] = [
  'posts',
  'picture-posts',
  'pictures',
  ...TEXT_SERIES,
  'night-owl',
  'early-bird',
  'make-a-wish',
  'weekend-posts',
  'new-year',
  'leap-day',
  'friday-13',
  'welcome-back',
];

/**
 * Maps domain events to the members and the series they touch (F2, ADR 0021), the twin of
 * `NotificationsListener`: the doer's series, and the series of whoever the doing concerns
 * (the author of a liked post, the followed member). "Around the clock" and tenure are left to
 * the daily sweep, which also catches up on whatever was missed. A failure is logged and never
 * fails the request.
 */
@Injectable()
export class AchievementsListener {
  private readonly logger = new Logger(AchievementsListener.name);

  constructor(private readonly achievements: AchievementsService) {}

  @OnEvent(PostCreatedEvent.EVENT)
  async onPostCreated(event: PostCreatedEvent): Promise<void> {
    await this.check(event.authorId, POST_SERIES);
    await this.run('tag originators', () => this.achievements.checkTagOriginators(event.postId));
  }

  @OnEvent(PostQuotedEvent.EVENT)
  async onPostQuoted(event: PostQuotedEvent): Promise<void> {
    await this.check(event.actorId, [...POST_SERIES, 'quotes', 'amplified', 'inception']);
    await this.check(event.originalAuthorId, ['top-post-reposts']);
    await this.run('tag originators', () => this.achievements.checkTagOriginators(event.quoteId));
  }

  @OnEvent(PostEditedEvent.EVENT)
  async onPostEdited(event: PostEditedEvent): Promise<void> {
    await this.check(event.authorId, [...TEXT_SERIES, 'perfectionist']);
    await this.run('tag originators', () => this.achievements.checkTagOriginators(event.postId));
  }

  @OnEvent(PostRepostedEvent.EVENT)
  async onPostReposted(event: PostRepostedEvent): Promise<void> {
    await this.check(event.actorId, ['reposts', 'amplified']);
    await this.check(event.authorId, ['top-post-reposts']);
  }

  @OnEvent(UserMentionedEvent.EVENT)
  async onUserMentioned(event: UserMentionedEvent): Promise<void> {
    await this.check(event.actorId, ['mentions-given']);
    await this.check(event.targetUserId, ['mentioned-by']);
  }

  @OnEvent(CommentCreatedEvent.EVENT)
  async onCommentCreated(event: CommentCreatedEvent): Promise<void> {
    await this.check(event.authorId, [
      'comments',
      'replies',
      'night-owl',
      'first-responses',
      'newcomers-welcomed',
      'quick-draw',
      'archaeologist',
      'self-reply',
    ]);
    await this.check(event.postAuthorId, ['top-post-comments']);
  }

  @OnEvent(PostLikedEvent.EVENT)
  async onPostLiked(event: PostLikedEvent): Promise<void> {
    await this.check(event.actorId, ['likes-given']);
    await this.check(event.authorId, ['likes-received', 'top-post-likes']);
  }

  /** A first reaction or a switch of emoji: Full range counts the kinds in use. */
  @OnEvent(CommentReactedEvent.EVENT)
  async onCommentReacted(event: CommentReactedEvent): Promise<void> {
    await this.check(event.actorId, ['reactions-given', 'full-range']);
    await this.check(event.commentAuthorId, ['top-comment-reactions']);
  }

  /** An edit or a reaction; counting the reactions again after an edit costs one count. */
  @OnEvent(MessageUpdatedEvent.EVENT)
  onMessageUpdated(event: MessageUpdatedEvent): Promise<void> {
    return this.check(event.actorId, ['reactions-given']);
  }

  @OnEvent(MessageSentEvent.EVENT)
  async onMessageSent(event: MessageSentEvent): Promise<void> {
    if (event.message.kind !== 'user') return;
    await this.check(event.message.senderId, ['messages', 'un-beso']);
  }

  @OnEvent(GroupCreatedEvent.EVENT)
  onGroupCreated(event: GroupCreatedEvent): Promise<void> {
    return this.check(event.creatorId, ['groups-created']);
  }

  /** Members joined (or anything else changed): Crew and Big table look at the group's size. */
  @OnEvent(ConversationUpdatedEvent.EVENT)
  onConversationUpdated(event: ConversationUpdatedEvent): Promise<void> {
    return this.run('group', () => this.achievements.checkGroup(event.conversationId));
  }

  @OnEvent(UserFollowedEvent.EVENT)
  async onUserFollowed(event: UserFollowedEvent): Promise<void> {
    await this.check(event.followerId, ['following', 'mutual-follows', 'newcomers-welcomed']);
    await this.check(event.followeeId, ['followers', 'mutual-follows']);
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

  /** The account opened: the tenure badges a newcomer can have from day one, and the inviter's. */
  @OnEvent(UserVerifiedEvent.EVENT)
  async onUserVerified(event: UserVerifiedEvent): Promise<void> {
    await this.check(event.userId, ['membership-days', 'pioneer', 'founding', 'first-100']);
    await this.run('inviter', () => this.achievements.checkInviterOf(event.userId));
  }

  private async check(userId: string, series: readonly AchievementSeries[]): Promise<void> {
    await this.run('achievements', () => this.achievements.check(userId, series), userId);
  }

  private async run(what: string, work: () => Promise<unknown>, userId?: string): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.error({ err: error, userId, what }, 'Could not check achievements');
    }
  }
}
