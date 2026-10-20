import type { EventEmitter2 } from '@nestjs/event-emitter';
import { UserMentionedEvent } from '../events/user.events.js';

/**
 * Emits `user.mentioned` for every member in `targetIds` except the author (a self-mention
 * links but tells nobody). Callers pass only the mentions that are new to the text.
 */
export async function emitMentions(
  events: EventEmitter2,
  actorId: string,
  targetIds: readonly string[],
  target: { postId: string; commentId: string | null },
): Promise<void> {
  await Promise.all(
    targetIds
      .filter((targetUserId) => targetUserId !== actorId)
      .map((targetUserId) =>
        events.emitAsync(
          UserMentionedEvent.EVENT,
          new UserMentionedEvent(actorId, targetUserId, target.postId, target.commentId),
        ),
      ),
  );
}
