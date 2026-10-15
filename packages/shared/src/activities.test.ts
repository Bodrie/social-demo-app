import { activitySchema } from './activities.js';

describe('activitySchema', () => {
  it('describes a followed user liking a post', () => {
    const activity = {
      id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9',
      type: 'POST_LIKED',
      actor: {
        id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b8',
        username: 'bob',
        name: 'Bob',
        avatarUrl: null,
      },
      post: { id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b7', excerpt: 'hello world' },
      comment: null,
      targetUser: null,
      createdAt: '2026-10-15T10:00:00.000Z',
    };
    expect(activitySchema.parse(activity)).toEqual(activity);
  });

  it('rejects unknown types', () => {
    expect(activitySchema.safeParse({ type: 'DANCED' }).success).toBe(false);
  });
});
