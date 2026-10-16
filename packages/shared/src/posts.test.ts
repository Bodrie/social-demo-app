import { createPostSchema, postSchema } from './posts.js';

describe('createPostSchema', () => {
  it('trims content and limits its length', () => {
    expect(createPostSchema.parse({ content: '  hello  ' })).toEqual({ content: 'hello' });
    expect(createPostSchema.safeParse({ content: '   ' }).success).toBe(false);
    expect(createPostSchema.safeParse({ content: 'x'.repeat(501) }).success).toBe(false);
  });

  it('only accepts post-kind image keys', () => {
    const ok = { content: 'pic', imageKey: 'post/01a13ed6-d3ec-71cb-b39f-fbc256a293b9.webp' };
    const wrongKind = {
      content: 'pic',
      imageKey: 'avatar/01a13ed6-d3ec-71cb-b39f-fbc256a293b9.webp',
    };
    expect(createPostSchema.safeParse(ok).success).toBe(true);
    expect(createPostSchema.safeParse(wrongKind).success).toBe(false);
  });
});

describe('postSchema', () => {
  it('describes a feed item', () => {
    const post = {
      id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9',
      content: 'hi',
      imageUrl: null,
      author: {
        id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b8',
        username: 'alice',
        name: 'Alice',
        avatarUrl: null,
      },
      likeCount: 2,
      commentCount: 0,
      likedByMe: true,
      editedAt: null,
      createdAt: '2026-10-15T10:00:00.000Z',
      updatedAt: '2026-10-15T10:00:00.000Z',
    };
    expect(postSchema.parse(post)).toEqual(post);
  });
});
