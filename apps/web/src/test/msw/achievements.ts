import { HttpResponse, http } from 'msw/http';
import { API, unauthorized } from './auth';
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
