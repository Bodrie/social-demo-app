import { commentSchema, createCommentSchema } from './comments.js';

describe('createCommentSchema', () => {
  it('trims and bounds the content', () => {
    expect(createCommentSchema.parse({ content: ' nice ' })).toEqual({ content: 'nice' });
    expect(createCommentSchema.safeParse({ content: ' ' }).success).toBe(false);
    expect(createCommentSchema.safeParse({ content: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('commentSchema', () => {
  it('describes a comment with its author', () => {
    const comment = {
      id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9',
      postId: '01a13ed6-d3ec-71cb-b39f-fbc256a293b8',
      parentId: null,
      editedAt: null,
      reactions: { counts: { LIKE: 1, LOVE: 0, LAUGH: 0, WOW: 0, SAD: 0 }, total: 1, mine: 'LIKE' },
      content: 'nice',
      author: {
        id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b7',
        username: 'bob',
        name: 'Bob',
        avatarUrl: null,
        ring: null,
      },
      mentions: [],
      replyCount: 0,
      createdAt: '2026-10-15T10:00:00.000Z',
      updatedAt: '2026-10-15T10:00:00.000Z',
    };
    expect(commentSchema.parse(comment)).toEqual(comment);
  });
});
