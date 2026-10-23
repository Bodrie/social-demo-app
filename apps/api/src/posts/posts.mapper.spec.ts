import { postSchema } from '@beso/shared';
import { type PostRow, toPost } from './posts.mapper.js';

const VIEWER = '01a13ed6-d3ec-71cb-b39f-fbc256a293b6';
const AUTHOR = '01a13ed6-d3ec-71cb-b39f-fbc256a293b8';

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
    id: AUTHOR,
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
  poll: null,
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
    const post = toPost(row, 'http://assets.local', VIEWER);

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
    expect(toPost({ ...row, images: [] }, 'http://assets.local', VIEWER)).toMatchObject({
      images: [],
      imageUrl: null,
    });
  });

  it('reports likedByMe false when the viewer has no like row', () => {
    expect(toPost({ ...row, likes: [] }, 'http://assets.local', VIEWER).likedByMe).toBe(false);
  });

  describe('a poll', () => {
    const [yes, no] = [
      '01a13ed6-d3ec-71cb-b39f-fbc256a29301',
      '01a13ed6-d3ec-71cb-b39f-fbc256a29302',
    ];
    const closesAt = new Date('2026-10-16T10:00:00.000Z');
    const before = { now: new Date('2026-10-16T09:00:00.000Z') };
    const polled = (myVote: string | null): PostRow => ({
      ...row,
      poll: {
        closesAt,
        options: [
          { id: yes, text: 'Yes', _count: { votes: 3 } },
          { id: no, text: 'No', _count: { votes: 1 } },
        ],
        votes: myVote ? [{ optionId: myVote }] : [],
      },
    });

    it('shows how many voted, but not for what, before the viewer votes', () => {
      const post = toPost(polled(null), 'http://assets.local', VIEWER, before);
      expect(postSchema.parse(post)).toEqual(post);
      expect(post.poll).toEqual({
        options: [
          { id: yes, text: 'Yes', votes: null },
          { id: no, text: 'No', votes: null },
        ],
        totalVotes: 4,
        myVote: null,
        closesAt: '2026-10-16T10:00:00.000Z',
        closed: false,
      });
    });

    it('shows the counts once voted, to the author, and to everyone after the close', () => {
      const counts = [3, 1];
      const votes = (post: ReturnType<typeof toPost>) => post.poll?.options.map((o) => o.votes);
      const voted = toPost(polled(no), 'http://assets.local', VIEWER, before);
      expect(votes(voted)).toEqual(counts);
      expect(voted.poll?.myVote).toBe(no);
      expect(votes(toPost(polled(null), 'http://assets.local', AUTHOR, before))).toEqual(counts);
      const after = toPost(polled(null), 'http://assets.local', VIEWER, { now: closesAt });
      expect(after.poll).toMatchObject({ closed: true, myVote: null });
      expect(votes(after)).toEqual(counts);
    });
  });
});
