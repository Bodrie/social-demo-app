import {
  type AccountExport,
  deleteAccountSchema,
  updateProfileSchema,
  updateSettingsSchema,
} from '@the-mesh/shared';
import { HttpResponse, http } from 'msw/http';
import { TEST_PASSWORD } from '../fixtures';
import { API, apiError, unauthorized } from './auth';
import { mockDb, paginate, toPublic } from './db';

const param = (value: string | readonly string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';
const notFound = () => apiError(404, 'NOT_FOUND', 'User not found');
const noContent = () => new HttpResponse(null, { status: 204 });
const assetUrl = (key: string) => `http://localhost/api/v1/uploads/${key}`;

export const userHandlers = [
  http.patch(`${API}/users/me/settings`, async ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const body = updateSettingsSchema.parse(await request.json());
    mockDb.user.settings = {
      ...mockDb.user.settings,
      ...Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined)),
    };
    return HttpResponse.json({ user: mockDb.user });
  }),

  http.get(`${API}/users/me/export`, () => {
    if (!mockDb.user) return unauthorized();
    const me = mockDb.user;
    mockDb.calls.exports += 1;
    const data: AccountExport = {
      exportedAt: new Date().toISOString(),
      user: me,
      posts: mockDb.posts
        .filter((post) => post.author.id === me.id)
        .map((post) => ({
          id: post.id,
          content: post.content,
          imageUrl: post.imageUrl,
          hashtags: post.hashtags,
          createdAt: post.createdAt,
          editedAt: post.editedAt,
          revisions: [],
        })),
      comments: [],
      likes: [],
      reactions: [],
      following: [],
      followers: [],
      messages: [],
      uploads: [],
    };
    return HttpResponse.json(data);
  }),

  http.delete(`${API}/users/me`, async ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const body = deleteAccountSchema.parse(await request.json());
    if (body.password !== TEST_PASSWORD) {
      return apiError(400, 'VALIDATION_ERROR', 'Validation failed', { password: 'Wrong password' });
    }
    const gone = mockDb.user.id;
    mockDb.calls.deletions += 1;
    mockDb.users = mockDb.users.filter((user) => user.id !== gone);
    mockDb.posts = mockDb.posts.filter((post) => post.author.id !== gone);
    mockDb.user = null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/users`, ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const viewer = mockDb.user;
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    if (q.length > 80) {
      return apiError(400, 'VALIDATION_ERROR', 'Validation failed', { q: 'Too long' });
    }
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
];
