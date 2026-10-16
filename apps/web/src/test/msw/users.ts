import { updateProfileSchema } from '@the-mesh/shared';
import { HttpResponse, http } from 'msw/http';
import { API, apiError, unauthorized } from './auth';
import { mockDb, paginate, toPublic } from './db';

const param = (value: string | readonly string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';
const notFound = () => apiError(404, 'NOT_FOUND', 'User not found');
const noContent = () => new HttpResponse(null, { status: 204 });
const assetUrl = (key: string) => `http://localhost/api/v1/uploads/${key}`;

export const userHandlers = [
  http.get(`${API}/users`, ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const viewer = mockDb.user;
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const users = mockDb.users
      .filter((user) => !q || user.name.toLowerCase().includes(q) || user.username.includes(q))
      .map((user) => toPublic(user, viewer.id));
    return HttpResponse.json(paginate(users, url));
  }),

  http.get(`${API}/users/suggestions`, ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const viewer = mockDb.user;
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? 5);
    const items = mockDb.users
      .map((user) => toPublic(user, viewer.id))
      .filter((user) => user.id !== viewer.id && !user.followedByMe)
      .slice(0, limit);
    return HttpResponse.json({ items, nextCursor: null });
  }),

  http.get(`${API}/users/by-username/:username`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const user = mockDb.users.find((candidate) => candidate.username === param(params.username));
    return user ? HttpResponse.json(toPublic(user, mockDb.user.id)) : notFound();
  }),

  http.patch(`${API}/users/me`, async ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const me = mockDb.user;
    const body = updateProfileSchema.parse(await request.json());
    if (
      body.username !== undefined &&
      mockDb.users.some((user) => user.id !== me.id && user.username === body.username)
    ) {
      return apiError(409, 'CONFLICT', 'Already in use', { username: 'This username is taken' });
    }

    const { avatarKey, coverKey, ...rest } = body;
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) Object.assign(me, { [key]: value });
    }
    if (avatarKey !== undefined) me.avatarUrl = avatarKey ? assetUrl(avatarKey) : null;
    if (coverKey !== undefined) me.coverUrl = coverKey ? assetUrl(coverKey) : null;
    me.updatedAt = new Date().toISOString();
    return HttpResponse.json({ user: me });
  }),

  http.get(`${API}/users/:userId/followers`, ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const viewer = mockDb.user;
    const userId = param(params.userId);
    const followerIds = new Set(
      mockDb.follows.filter((f) => f.followingId === userId).map((f) => f.followerId),
    );
    const users = mockDb.users
      .filter((u) => followerIds.has(u.id))
      .map((u) => toPublic(u, viewer.id));
    return HttpResponse.json(paginate(users, new URL(request.url)));
  }),

  http.get(`${API}/users/:userId/following`, ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const viewer = mockDb.user;
    const userId = param(params.userId);
    const followingIds = new Set(
      mockDb.follows.filter((f) => f.followerId === userId).map((f) => f.followingId),
    );
    const users = mockDb.users
      .filter((u) => followingIds.has(u.id))
      .map((u) => toPublic(u, viewer.id));
    return HttpResponse.json(paginate(users, new URL(request.url)));
  }),

  http.put(`${API}/users/:userId/follow`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const viewer = mockDb.user;
    const userId = param(params.userId);
    if (userId === viewer.id) return apiError(400, 'BAD_REQUEST', 'You cannot follow yourself');
    if (!mockDb.users.some((u) => u.id === userId)) return notFound();
    if (!mockDb.follows.some((f) => f.followerId === viewer.id && f.followingId === userId)) {
      mockDb.follows.push({ followerId: viewer.id, followingId: userId });
    }
    return noContent();
  }),

  http.delete(`${API}/users/:userId/follow`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const viewer = mockDb.user;
    const userId = param(params.userId);
    mockDb.follows = mockDb.follows.filter(
      (f) => !(f.followerId === viewer.id && f.followingId === userId),
    );
    return noContent();
  }),

  http.get(`${API}/users/:id`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const user = mockDb.users.find((candidate) => candidate.id === param(params.id));
    return user ? HttpResponse.json(toPublic(user, mockDb.user.id)) : notFound();
  }),
];
