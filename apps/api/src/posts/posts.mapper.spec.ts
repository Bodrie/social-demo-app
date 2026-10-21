import { postSchema } from '@beso/shared';
import { type PostRow, toPost } from './posts.mapper.js';

const row: PostRow = {
  id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9',
  content: 'hello',
  images: [
    { upload: { key: 'post/01a13ed6-d3ec-71cb-b39f-fbc256a293b1.webp', width: 1200, height: 800 } },
    {
      upload: { key: 'post/01a13ed6-d3ec-71cb-b39f-fbc256a293b3.webp', width: null, height: null },
    },
  ],
  editedAt: null,
  createdAt: new Date('2026-10-15T10:00:00.000Z'),
  updatedAt: new Date('2026-10-15T10:05:00.000Z'),
  author: {
    id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b8',
    username: 'alice',
    name: 'Alice',
    avatarKey: null,
  },
  _count: { likes: 3, comments: 2 },
  likes: [{ userId: 'viewer' }],
  bookmarks: [],
  repostCount: 0,
  reposts: [],
  wasQuote: false,
  quotedPost: null,
  mentions: [
    {
      user: {
        id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b7',
        username: 'bob',
        name: 'Bob',
        avatarKey: 'avatar/01a13ed6-d3ec-71cb-b39f-fbc256a293b2.webp',
      },
    },
  ],
  hashtags: [{ tag: 'hello' }],
};

describe('toPost', () => {
  it('maps counts, viewer like state, author and asset URLs', () => {
    const post = toPost(row, 'http://assets.local');

    expect(postSchema.parse(post)).toEqual(post);
    expect(post).toMatchObject({
      likeCount: 3,
      commentCount: 2,
      likedByMe: true,
      editedAt: null,
      images: [
        {
          url: 'http://assets.local/post/01a13ed6-d3ec-71cb-b39f-fbc256a293b1.webp',
          width: 1200,
          height: 800,
        },
        {
          url: 'http://assets.local/post/01a13ed6-d3ec-71cb-b39f-fbc256a293b3.webp',
          width: null,
          height: null,
        },
      ],
      // The first picture, for tabs opened before D2.
      imageUrl: 'http://assets.local/post/01a13ed6-d3ec-71cb-b39f-fbc256a293b1.webp',
      author: { username: 'alice', avatarUrl: null },
      mentions: [
        {
          username: 'bob',
          avatarUrl: 'http://assets.local/avatar/01a13ed6-d3ec-71cb-b39f-fbc256a293b2.webp',
        },
      ],
      hashtags: ['hello'],
      createdAt: '2026-10-15T10:00:00.000Z',
    });
  });

  it('has no pictures and no legacy URL for a text-only post', () => {
    expect(toPost({ ...row, images: [] }, 'http://assets.local')).toMatchObject({
      images: [],
      imageUrl: null,
    });
  });

  it('reports likedByMe false when the viewer has no like row', () => {
    expect(toPost({ ...row, likes: [] }, 'http://assets.local').likedByMe).toBe(false);
  });
});
