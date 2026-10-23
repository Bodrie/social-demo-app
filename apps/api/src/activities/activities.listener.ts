import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { AssetsService } from '../assets/assets.service.js';
import { ActivityRecordedEvent } from '../events/activity.events.js';
import { CommentCreatedEvent } from '../events/comment.events.js';
import {
  PostCreatedEvent,
  PostLikedEvent,
  PostQuotedEvent,
  PostRepostedEvent,
  PostUnlikedEvent,
  PostUnrepostedEvent,
} from '../events/post.events.js';
import {
  ProfileUpdatedEvent,
  UserFollowedEvent,
  UserRegisteredEvent,
  UserUnfollowedEvent,
} from '../events/user.events.js';
import type { Prisma } from '../generated/prisma/client.js';
import { VisibilityService } from '../moderation/visibility.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type ActivityRow, activitySelect, toActivity } from './activities.mapper.js';

const PICTURE_FIELDS = new Set(['avatarKey', 'coverKey', 'avatarPreset', 'coverPreset']);
/** Followers a new activity is pushed to, newest follows first; no member comes near it today. */
export const ACTIVITY_PUSH_AUDIENCE = 1000;

/**
 * Turns domain events into activity rows and pushes each new row to the actor's followers who
 * may see it (C7). Services `emitAsync` these events, so the row exists before the triggering
 * request returns. A failure here is logged and never fails the request that caused it.
 */
@Injectable()
export class ActivitiesListener {
  private readonly logger = new Logger(ActivitiesListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly visibility: VisibilityService,
    private readonly events: EventEmitter2,
  ) {}

  @OnEvent(UserRegisteredEvent.EVENT)
  onUserRegistered(event: UserRegisteredEvent): Promise<void> {
    return this.record({ actorId: event.userId, type: 'USER_REGISTERED' });
  }

  @OnEvent(ProfileUpdatedEvent.EVENT)
  async onProfileUpdated(event: ProfileUpdatedEvent): Promise<void> {
    if (!event.changedFields.some((field) => PICTURE_FIELDS.has(field))) return;
    await this.record({ actorId: event.userId, type: 'PROFILE_UPDATED' });
  }

  @OnEvent(PostCreatedEvent.EVENT)
  onPostCreated(event: PostCreatedEvent): Promise<void> {
    return this.record({ actorId: event.authorId, type: 'POST_CREATED', postId: event.postId });
  }

  @OnEvent(PostLikedEvent.EVENT)
  onPostLiked(event: PostLikedEvent): Promise<void> {
    return this.record({ actorId: event.actorId, type: 'POST_LIKED', postId: event.postId });
  }

  @OnEvent(PostUnlikedEvent.EVENT)
  onPostUnliked(event: PostUnlikedEvent): Promise<void> {
    return this.remove({ actorId: event.actorId, type: 'POST_LIKED', postId: event.postId });
  }

  /** "bob reposted alice's post": the original is the subject, its author the target. */
  @OnEvent(PostRepostedEvent.EVENT)
  onPostReposted(event: PostRepostedEvent): Promise<void> {
    return this.record({
      actorId: event.actorId,
      type: 'POST_REPOSTED',
      postId: event.postId,
      targetUserId: event.authorId,
    });
  }

  @OnEvent(PostUnrepostedEvent.EVENT)
  onPostUnreposted(event: PostUnrepostedEvent): Promise<void> {
    return this.remove({ actorId: event.actorId, type: 'POST_REPOSTED', postId: event.postId });
  }

  /** "bob quoted alice's post": the quote is the subject (its words are shown), alice the target. */
  @OnEvent(PostQuotedEvent.EVENT)
  onPostQuoted(event: PostQuotedEvent): Promise<void> {
    return this.record({
      actorId: event.actorId,
      type: 'POST_QUOTED',
      postId: event.quoteId,
      targetUserId: event.originalAuthorId,
    });
  }

  @OnEvent(CommentCreatedEvent.EVENT)
  onCommentCreated(event: CommentCreatedEvent): Promise<void> {
    return this.record({
      actorId: event.authorId,
      type: 'COMMENT_CREATED',
      postId: event.postId,
      commentId: event.commentId,
    });
  }

  @OnEvent(UserFollowedEvent.EVENT)
  onUserFollowed(event: UserFollowedEvent): Promise<void> {
    return this.record({
      actorId: event.followerId,
      type: 'USER_FOLLOWED',
      targetUserId: event.followeeId,
    });
  }

  @OnEvent(UserUnfollowedEvent.EVENT)
  onUserUnfollowed(event: UserUnfollowedEvent): Promise<void> {
    return this.remove({
      actorId: event.followerId,
      type: 'USER_FOLLOWED',
      targetUserId: event.followeeId,
    });
  }

  private async record(data: Prisma.ActivityUncheckedCreateInput): Promise<void> {
    let row: ActivityRow;
    try {
      row = await this.prisma.activity.create({ data, select: activitySelect });
    } catch (error) {
      this.logger.error({ err: error, activity: data }, 'Could not record activity');
      return;
    }
    try {
      await this.announce(row);
    } catch (error) {
      this.logger.error({ err: error, activityId: row.id }, 'Could not push activity');
    }
  }

  /**
   * The followers who would find the row in `GET /activities`: the same rule as
   * `ActivitiesService.forViewer` (nothing by, about or on the posts of someone hidden from them).
   */
  private async announce(row: ActivityRow): Promise<void> {
    const follows = await this.prisma.follow.findMany({
      where: { followeeId: row.actor.id },
      select: { followerId: true },
      orderBy: { createdAt: 'desc' },
      take: ACTIVITY_PUSH_AUDIENCE,
    });
    if (follows.length === 0) return;
    const subjects = [row.actor.id, row.targetUser?.id, row.post?.authorId].filter(
      (id): id is string => id !== undefined,
    );
    const recipients = await this.visibility.viewersOf(
      follows.map((follow) => follow.followerId),
      subjects,
    );
    if (recipients.length === 0) return;
    await this.events.emitAsync(
      ActivityRecordedEvent.EVENT,
      new ActivityRecordedEvent(toActivity(row, this.assets.base), recipients),
    );
  }

  private async remove(where: Prisma.ActivityWhereInput): Promise<void> {
    try {
      await this.prisma.activity.deleteMany({ where });
    } catch (error) {
      this.logger.error({ err: error, activity: where }, 'Could not remove activity');
    }
  }
}
