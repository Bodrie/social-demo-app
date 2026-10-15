import { createCommentSchema, createPostSchema } from '@the-mesh/shared';
import { HttpResponse, http } from 'msw/http';
import { makeComment, makePost, summaryOf, testId } from '../fixtures';
import { API, apiError, unauthorized } from './auth';
import { mockDb, paginate } from './db';

const notFound = (what: string) => apiError(404, 'NOT_FOUND', `${what} not found`);
const forbidden = (message: string) => apiError(403, 'FORBIDDEN', message);
const noContent = () => new HttpResponse(null, { status: 204 });
const param = (value: string | readonly string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export const postHandlers = [
  http.get(`${API}/posts`, ({ request }) => {
    if (!mockDb.user) return unauthorized();
    return HttpResponse.json(paginate(mockDb.posts, new URL(request.url)));
  }),

  http.get(`${API}/users/:userId/posts`, ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const posts = mockDb.posts.filter((post) => post.author.id === param(params.userId));
    return HttpResponse.json(paginate(posts, new URL(request.url)));
  }),

  http.post(`${API}/posts`, async ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const body = createPostSchema.parse(await request.json());
    const post = makePost({
      content: body.content,
      imageUrl: body.imageKey ? `http://localhost/api/v1/uploads/${body.imageKey}` : null,
      author: summaryOf(mockDb.user),
      createdAt: new Date().toISOString(),
    });
    mockDb.posts.unshift(post);
    return HttpResponse.json(post, { status: 201 });
  }),

  http.delete(`${API}/posts/:id`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const post = mockDb.posts.find((item) => item.id === param(params.id));
    if (!post) return notFound('Post');
    if (post.author.id !== mockDb.user.id) return forbidden('You can only delete your own posts');
    mockDb.posts = mockDb.posts.filter((item) => item.id !== post.id);
    mockDb.comments = mockDb.comments.filter((item) => item.postId !== post.id);
    return noContent();
  }),

  http.put(`${API}/posts/:id/like`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const post = mockDb.posts.find((item) => item.id === param(params.id));
    if (!post) return notFound('Post');
    if (!post.likedByMe) {
      post.likedByMe = true;
      post.likeCount += 1;
    }
    return noContent();
  }),

  http.delete(`${API}/posts/:id/like`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const post = mockDb.posts.find((item) => item.id === param(params.id));
    if (!post) return notFound('Post');
    if (post.likedByMe) {
      post.likedByMe = false;
      post.likeCount -= 1;
    }
    return noContent();
  }),

  http.get(`${API}/posts/:postId/comments`, ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const comments = mockDb.comments.filter((comment) => comment.postId === param(params.postId));
    return HttpResponse.json(paginate(comments, new URL(request.url)));
  }),

  http.post(`${API}/posts/:postId/comments`, async ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const post = mockDb.posts.find((item) => item.id === param(params.postId));
    if (!post) return notFound('Post');
    const body = createCommentSchema.parse(await request.json());
    const comment = makeComment(post.id, {
      content: body.content,
      author: summaryOf(mockDb.user),
      createdAt: new Date().toISOString(),
    });
    mockDb.comments.unshift(comment);
    post.commentCount += 1;
    return HttpResponse.json(comment, { status: 201 });
  }),

  http.delete(`${API}/comments/:id`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const comment = mockDb.comments.find((item) => item.id === param(params.id));
    if (!comment) return notFound('Comment');
    const post = mockDb.posts.find((item) => item.id === comment.postId);
    const allowed = comment.author.id === mockDb.user.id || post?.author.id === mockDb.user.id;
    if (!allowed)
      return forbidden('Only the comment author or the post author can delete a comment');
    mockDb.comments = mockDb.comments.filter((item) => item.id !== comment.id);
    if (post) post.commentCount -= 1;
    return noContent();
  }),

  http.post(`${API}/uploads`, async ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const kind = new URL(request.url).searchParams.get('kind') ?? 'post';
    const file = (await request.formData()).get('file');
    if (!file || typeof file === 'string') {
      return apiError(400, 'VALIDATION_ERROR', 'Validation failed', { file: 'A file is required' });
    }
    mockDb.uploads += 1;
    const key = `${kind}/${testId('post', 900 + mockDb.uploads).replace('01a13f00', '0f0f0f0f')}.webp`;
    return HttpResponse.json(
      {
        key,
        url: `http://localhost/api/v1/uploads/${key}`,
        width: 64,
        height: 64,
        bytes: file.size,
      },
      { status: 201 },
    );
  }),
];
