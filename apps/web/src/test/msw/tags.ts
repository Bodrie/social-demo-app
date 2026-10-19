import { HttpResponse, http } from 'msw/http';
import { API, unauthorized } from './auth';
import { mockDb, paginate } from './db';

const param = (value: string | readonly string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export const tagHandlers = [
  http.get(`${API}/tags/trending`, ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? 5);
    const counts = new Map<string, number>();
    for (const post of mockDb.posts) {
      for (const tag of post.hashtags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    const items = [...counts]
      .map(([tag, count]) => ({ tag, count }))
      .toSorted((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, limit);
    return HttpResponse.json({ items, nextCursor: null });
  }),

  http.get(`${API}/tags/:tag/posts`, ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const tag = decodeURIComponent(param(params.tag)).replace(/^#/, '').toLowerCase();
    const posts = mockDb.posts.filter((post) => post.hashtags.includes(tag));
    return HttpResponse.json(paginate(posts, new URL(request.url)));
  }),
];
