import { featuredBadgesSchema } from '@beso/shared/achievements';
import { HttpResponse, http } from 'msw/http';
import { API, apiError, unauthorized } from './auth';
import { mockDb } from './db';

const earnedBy = (userId: string) =>
  mockDb.achievements
    .filter((row) => row.userId === userId)
    .map(({ key, earnedAt }) => ({ key, earnedAt }));

export const achievementHandlers = [
  http.get(`${API}/users/me/achievements`, () => {
    const me = mockDb.user;
    if (!me) return unauthorized();
    return HttpResponse.json({ earned: earnedBy(me.id), progress: mockDb.achievementProgress });
  }),
  /** Held badges only, like the API; the signed-in member's profile shows them. */
  http.put(`${API}/users/me/featured-badges`, async ({ request }) => {
    const me = mockDb.user;
    if (!me) return unauthorized();
    const { keys } = featuredBadgesSchema.parse(await request.json());
    const held = new Set(earnedBy(me.id).map((row) => row.key));
    if (!keys.every((key) => held.has(key))) {
      return apiError(400, 'VALIDATION_ERROR', 'Validation failed', {
        keys: 'Earn the badge first',
      });
    }
    me.featuredBadges = keys;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${API}/users/:userId/achievements`, ({ params }) => {
    const me = mockDb.user;
    if (!me) return unauthorized();
    mockDb.calls.achievementLists += 1;
    const user = mockDb.users.find((candidate) => candidate.id === params.userId);
    const hidden = user !== undefined && user.id !== me.id && !user.settings.showAchievements;
    return HttpResponse.json({
      items: hidden ? [] : earnedBy(String(params.userId)),
      nextCursor: null,
    });
  }),
  http.get(`${API}/achievements/stats`, () => {
    const holders = new Map<string, number>();
    for (const row of mockDb.achievements) holders.set(row.key, (holders.get(row.key) ?? 0) + 1);
    return HttpResponse.json({
      members: mockDb.users.length,
      items: [...holders].map(([key, count]) => ({ key, holders: count })),
      nextCursor: null,
    });
  }),
];
