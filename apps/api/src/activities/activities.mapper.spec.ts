import { activitySchema } from '@beso/shared';
import { type ActivityRow, excerpt, toActivity } from './activities.mapper.js';

const actor = {
  id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b8',
  username: 'bob',
  name: 'Bob',
  avatarKey: 'avatar/x.webp',
};

describe('excerpt', () => {
  it('collapses whitespace and truncates with an ellipsis', () => {
    expect(excerpt('  hello\n\n  world ')).toBe('hello world');
    const long = excerpt('a'.repeat(200));
    expect(long).toHaveLength(80);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('toActivity', () => {
  it('maps subjects that are present and nulls the rest', () => {
    const row: ActivityRow = {
      id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9',
      type: 'COMMENT_CREATED',
      createdAt: new Date('2026-10-15T10:00:00.000Z'),
      actor,
      post: {
        id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b7',
        content: 'the post',
        authorId: '01a13ed6-d3ec-71cb-b39f-fbc256a293b5',
      },
      comment: { id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b6', content: 'the comment' },
      targetUser: null,
    };

    const activity = toActivity(row, 'http://assets.local');

    expect(activitySchema.parse(activity)).toEqual(activity);
    expect(activity).toMatchObject({
      type: 'COMMENT_CREATED',
      actor: { username: 'bob', avatarUrl: 'http://assets.local/avatar/x.webp' },
      post: { excerpt: 'the post' },
      comment: { excerpt: 'the comment' },
      targetUser: null,
    });
  });
});
