import type { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep } from 'vitest-mock-extended';
import { UserMentionedEvent } from '../events/user.events.js';
import { emitMentions } from './mentions.js';

describe('emitMentions', () => {
  it('emits one event per mentioned member, skipping the author', async () => {
    const events = mockDeep<EventEmitter2>();
    events.emitAsync.mockResolvedValue([]);

    await emitMentions(events, 'author', ['bob', 'author', 'carol'], {
      postId: 'post-1',
      commentId: null,
    });

    expect(events.emitAsync).toHaveBeenCalledTimes(2);
    expect(events.emitAsync).toHaveBeenCalledWith(
      UserMentionedEvent.EVENT,
      new UserMentionedEvent('author', 'bob', 'post-1', null),
    );
    expect(events.emitAsync).toHaveBeenCalledWith(
      UserMentionedEvent.EVENT,
      new UserMentionedEvent('author', 'carol', 'post-1', null),
    );
  });

  it('carries the comment id for mentions inside comments', async () => {
    const events = mockDeep<EventEmitter2>();
    events.emitAsync.mockResolvedValue([]);

    await emitMentions(events, 'author', ['bob'], { postId: 'post-1', commentId: 'comment-1' });

    expect(events.emitAsync).toHaveBeenCalledWith(
      UserMentionedEvent.EVENT,
      new UserMentionedEvent('author', 'bob', 'post-1', 'comment-1'),
    );
  });

  it('does nothing for an empty list', async () => {
    const events = mockDeep<EventEmitter2>();
    await emitMentions(events, 'author', [], { postId: 'post-1', commentId: null });
    expect(events.emitAsync).not.toHaveBeenCalled();
  });
});
