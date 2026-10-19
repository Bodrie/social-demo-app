import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AccountExport, DeleteAccountData } from '@the-mesh/shared';
import { AssetsService } from '../assets/assets.service.js';
import { verifyPassword } from '../auth/password.js';
import { validationError } from '../common/errors.js';
import { EmailService } from '../email/email.service.js';
import { SessionsRevokedEvent } from '../events/auth.events.js';
import { ConversationDeletedEvent, ConversationLeftEvent } from '../events/conversation.events.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { toUserPrivate, userPrivateSelect } from '../users/users.mapper.js';

const iso = (date: Date): string => date.toISOString();

/** The member's own account as a whole: a copy of it, and its end (ADR 0012). */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly email: EmailService,
    private readonly events: EventEmitter2,
    private readonly assets: AssetsService,
  ) {}

  /** Everything the account holds, as the shared `accountExportSchema` describes it. */
  async export(userId: string): Promise<AccountExport> {
    // The profile select carries the viewer-relative follow flags under the same relation names
    // as the lists below, so the two are read separately.
    const profile = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: userPrivateSelect(userId),
    });
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        posts: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            imageKey: true,
            createdAt: true,
            editedAt: true,
            hashtags: { select: { tag: true }, orderBy: { tag: 'asc' } },
            revisions: { select: { content: true, editedAt: true }, orderBy: { editedAt: 'asc' } },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            postId: true,
            content: true,
            createdAt: true,
            editedAt: true,
            revisions: { select: { content: true, editedAt: true }, orderBy: { editedAt: 'asc' } },
          },
        },
        postLikes: { select: { postId: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        commentReactions: {
          select: { commentId: true, type: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        following: {
          select: { createdAt: true, followee: { select: { id: true, username: true } } },
          orderBy: { createdAt: 'asc' },
        },
        followers: {
          select: { createdAt: true, follower: { select: { id: true, username: true } } },
          orderBy: { createdAt: 'asc' },
        },
        sentMessages: {
          select: {
            id: true,
            conversationId: true,
            content: true,
            imageKey: true,
            createdAt: true,
            conversation: { select: { title: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        uploads: {
          select: { key: true, kind: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    const url = (key: string | null) => (key === null ? null : this.assets.url(key));
    return {
      exportedAt: iso(new Date()),
      user: toUserPrivate(profile, this.assets.base),
      posts: user.posts.map((post) => ({
        id: post.id,
        content: post.content,
        imageUrl: url(post.imageKey),
        hashtags: post.hashtags.map((hashtag) => hashtag.tag),
        createdAt: iso(post.createdAt),
        editedAt: post.editedAt === null ? null : iso(post.editedAt),
        revisions: post.revisions.map((r) => ({ content: r.content, editedAt: iso(r.editedAt) })),
      })),
      comments: user.comments.map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        content: comment.content,
        createdAt: iso(comment.createdAt),
        editedAt: comment.editedAt === null ? null : iso(comment.editedAt),
        revisions: comment.revisions.map((r) => ({
          content: r.content,
          editedAt: iso(r.editedAt),
        })),
      })),
      likes: user.postLikes.map((like) => ({
        postId: like.postId,
        createdAt: iso(like.createdAt),
      })),
      reactions: user.commentReactions.map((reaction) => ({
        commentId: reaction.commentId,
        type: reaction.type,
        createdAt: iso(reaction.createdAt),
      })),
      following: user.following.map((follow) => ({
        userId: follow.followee.id,
        username: follow.followee.username,
        since: iso(follow.createdAt),
      })),
      followers: user.followers.map((follow) => ({
        userId: follow.follower.id,
        username: follow.follower.username,
        since: iso(follow.createdAt),
      })),
      messages: user.sentMessages.map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        conversationTitle: message.conversation.title,
        content: message.content,
        imageUrl: url(message.imageKey),
        createdAt: iso(message.createdAt),
      })),
      uploads: user.uploads.map((upload) => ({
        key: upload.key,
        kind: upload.kind,
        url: this.assets.url(upload.key),
        createdAt: iso(upload.createdAt),
      })),
    };
  }

  /**
   * Erases the account (ADR 0012): the password is checked first, then one transaction deletes
   * the user row (everything else cascades), the direct threads and the groups where this was
   * the last member, keeps the denormalised counters of what remains correct, and afterwards
   * the files go, the sockets are cut, the other members are told and a last mail is sent.
   */
  async delete(userId: string, input: DeleteAccountData): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        passwordHash: true,
        email: true,
        name: true,
        uploads: { select: { key: true } },
        conversations: {
          select: {
            conversationId: true,
            conversation: { select: { kind: true, members: { select: { userId: true } } } },
          },
        },
      },
    });
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw validationError({ password: 'Wrong password' });
    }

    const removed: { id: string; others: string[] }[] = [];
    const left: { id: string; remaining: string[] }[] = [];
    for (const membership of user.conversations) {
      const others = membership.conversation.members
        .map((member) => member.userId)
        .filter((memberId) => memberId !== userId);
      if (membership.conversation.kind === 'direct' || others.length === 0) {
        removed.push({ id: membership.conversationId, others });
      } else {
        left.push({ id: membership.conversationId, remaining: others });
      }
    }

    await this.prisma.$transaction([
      // Other people's comments must not keep counting reactions that go with this account.
      this.prisma.$executeRaw`
        UPDATE comments c SET reactions_count = c.reactions_count - 1
        FROM comment_reactions r
        WHERE r.comment_id = c.id AND r.user_id = ${userId}::uuid`,
      this.prisma.conversation.deleteMany({
        where: { id: { in: removed.map((conversation) => conversation.id) } },
      }),
      this.prisma.user.delete({ where: { id: userId } }),
      // Groups that stay: their newest message may have been this member's.
      ...(left.length > 0
        ? [
            this.prisma.$executeRaw`
              UPDATE conversations c
              SET last_message_at = (SELECT max(m.created_at) FROM messages m WHERE m.conversation_id = c.id)
              WHERE c.id IN (${Prisma.join(left.map((group) => Prisma.sql`${group.id}::uuid`))})`,
          ]
        : []),
    ]);

    await this.events.emitAsync(SessionsRevokedEvent.EVENT, new SessionsRevokedEvent(userId));
    await Promise.all([
      ...left.map((group) =>
        this.events.emitAsync(
          ConversationLeftEvent.EVENT,
          new ConversationLeftEvent(group.id, userId, group.remaining),
        ),
      ),
      ...removed
        .filter((conversation) => conversation.others.length > 0)
        .map((conversation) =>
          this.events.emitAsync(
            ConversationDeletedEvent.EVENT,
            new ConversationDeletedEvent(conversation.id, conversation.others),
          ),
        ),
    ]);
    await this.uploads.deleteFiles(user.uploads.map((upload) => upload.key));
    void this.email
      .sendAccountDeleted({ email: user.email, name: user.name })
      .catch((error: unknown) =>
        this.logger.warn({ err: error }, 'Could not send the account deletion notice'),
      );
    this.logger.log({ userId }, 'Account deleted');
  }
}
