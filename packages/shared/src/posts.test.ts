import { createPostSchema, postSchema } from './posts.js';

const key = (n: number) => `post/01a13ed6-d3ec-71cb-b39f-fbc256a293b${n}.webp`;

describe('createPostSchema', () => {
  it('trims content and limits its length', () => {
    expect(createPostSchema.parse({ content: '  hello  ' })).toEqual({ content: 'hello' });
    expect(createPostSchema.safeParse({ content: '   ' }).success).toBe(false);
    expect(createPostSchema.safeParse({ content: 'x'.repeat(501) }).success).toBe(false);
  });

  it('only accepts post-kind image keys', () => {
    const ok = { content: 'pic', imageKeys: [key(1)] };
    const wrongKind = { content: 'pic', imageKeys: [key(1).replace('post/', 'avatar/')] };
    expect(createPostSchema.safeParse(ok).success).toBe(true);
    expect(createPostSchema.safeParse(wrongKind).success).toBe(false);
    // The single key of tabs opened before D2 still parses.
    expect(createPostSchema.safeParse({ content: 'pic', imageKey: key(1) }).success).toBe(true);
  });

  it('takes up to four different pictures', () => {
    const four = [1, 2, 3, 4].map(key);
    expect(createPostSchema.parse({ content: 'pics', imageKeys: four }).imageKeys).toEqual(four);
    expect(
      createPostSchema.safeParse({ content: 'pics', imageKeys: [...four, key(5)] }).success,
    ).toBe(false);
    expect(
      createPostSchema.safeParse({ content: 'pics', imageKeys: [key(1), key(1)] }).success,
    ).toBe(false);
  });
});

describe('postSchema', () => {
  it('describes a feed item', () => {
    const post = {
      id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9',
      content: 'hi',
      images: [{ url: 'http://localhost/api/v1/uploads/x.webp', width: 1200, height: 800 }],
      imageUrl: 'http://localhost/api/v1/uploads/x.webp',
      author: {
        id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b8',
        username: 'alice',
        name: 'Alice',
        avatarUrl: null,
      },
      likeCount: 2,
      commentCount: 0,
      likedByMe: true,
      bookmarkedByMe: false,
      repostCount: 0,
      repostedByMe: false,
      quotedPost: null,
      repost: null,
      editedAt: null,
      mentions: [],
      hashtags: ['hi'],
      createdAt: '2026-10-15T10:00:00.000Z',
      updatedAt: '2026-10-15T10:00:00.000Z',
    };
    expect(postSchema.parse(post)).toEqual(post);
  });
});
