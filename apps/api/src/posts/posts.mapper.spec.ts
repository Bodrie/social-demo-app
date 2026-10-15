import { postSchema } from '@the-mesh/shared';
import { type PostRow, toPost } from './posts.mapper.js';

const row: PostRow = {
  id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9',
  content: 'hello',
  imageKey: 'post/01a13ed6-d3ec-71cb-b39f-fbc256a293b1.webp',
  createdAt: new Date('2026-10-15T10:00:00.000Z'),
  updatedAt: new Date('2026-10-15T10:05:00.000Z'),
  author: { id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b8', username: 'alice', name: 'Alice', avatarKey: null },
  _count: { likes: 3, comments: 2 },
  likes: [{ userId: 'viewer' }],
};

describe('toPost', () => {
  it('maps counts, viewer like state, author and asset URLs', () => {
    const post = toPost(row, 'http://assets.local');

    expect(postSchema.parse(post)).toEqual(post);
    expect(post).toMatchObject({
      likeCount: 3,
      commentCount: 2,
      likedByMe: true,
      imageUrl: 'http://assets.local/post/01a13ed6-d3ec-71cb-b39f-fbc256a293b1.webp',
      author: { username: 'alice', avatarUrl: null },
      createdAt: '2026-10-15T10:00:00.000Z',
    });
  });

  it('reports likedByMe false when the viewer has no like row', () => {
    expect(toPost({ ...row, likes: [] }, 'http://assets.local').likedByMe).toBe(false);
  });
});
