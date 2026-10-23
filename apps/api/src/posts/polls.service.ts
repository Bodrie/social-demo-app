import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Post } from '@beso/shared';
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { PollEndedEvent, PollVotedEvent } from '../events/post.events.js';
import { VisibilityService } from '../moderation/visibility.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PostsService } from './posts.service.js';

/**
 * Polls (F3, decision P3): the one vote of a member and the end of a poll. The options are
 * written with the post (`PostsService.create`) and read with it (`postSelect`); this service
 * owns what happens afterwards.
 */
@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly visibility: VisibilityService,
    private readonly posts: PostsService,
  ) {}

  /**
   * One vote per member and poll, final; never on one's own poll, never after the close, never
   * across a block (like a like). Answers the post as the voter now sees it, results included.
   */
  async vote(viewerId: string, postId: string, optionId: string, now = new Date()): Promise<Post> {
    const poll = await this.prisma.poll.findUnique({
      where: { postId },
      select: {
        closesAt: true,
        post: { select: { authorId: true } },
        options: { select: { id: true } },
        votes: { where: { userId: viewerId }, select: { optionId: true } },
      },
    });
    if (!poll) {
      await this.posts.assertExists(postId);
      throw notFound('This post has no poll');
    }
    const authorId = poll.post.authorId;
    await this.visibility.assertNotBlocked(viewerId, authorId);
    if (authorId === viewerId) throw forbidden('You cannot vote in your own poll');
    if (poll.closesAt <= now) throw conflict('This poll has closed');
    if (poll.votes.length > 0) throw conflict('You have voted in this poll already');
    if (!poll.options.some((option) => option.id === optionId)) {
      throw badRequest('Not an option of this poll', { optionId: 'Not an option of this poll' });
    }
    // A second vote racing this one fails on the primary key (P2002 → 409).
    await this.prisma.pollVote.create({ data: { postId, userId: viewerId, optionId } });
    await this.events.emitAsync(
      PollVotedEvent.EVENT,
      new PollVotedEvent(postId, viewerId, authorId),
    );
    return this.posts.getById(viewerId, postId);
  }

  /**
   * The frequent job: every poll that closed by `now` and was not announced is stamped and
   * announced once (the stamp is taken in the same statement, so two runs never both tell).
   * A poll that fails to announce is logged; the rest go on. Returns how many ended.
   */
  async endClosed(now: Date): Promise<number> {
    const ended = await this.prisma.$queryRaw<{ postId: string }[]>`
      UPDATE polls SET ended_notified_at = ${now}
      WHERE ended_notified_at IS NULL AND closes_at <= ${now}
      RETURNING post_id AS "postId"`;
    for (const { postId } of ended) {
      try {
        // oxlint-disable-next-line no-await-in-loop -- a handful per run, one at a time
        const poll = await this.prisma.poll.findUnique({
          where: { postId },
          select: { post: { select: { authorId: true } }, votes: { select: { userId: true } } },
        });
        if (!poll) continue;
        // oxlint-disable-next-line no-await-in-loop
        await this.events.emitAsync(
          PollEndedEvent.EVENT,
          new PollEndedEvent(
            postId,
            poll.post.authorId,
            poll.votes.map((vote) => vote.userId),
          ),
        );
      } catch (error) {
        this.logger.error({ err: error, postId }, 'Could not announce the end of a poll');
      }
    }
    return ended.length;
  }
}
