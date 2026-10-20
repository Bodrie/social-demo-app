import {
  type Comment,
  type Revision,
  type UserSummary,
  createCommentSchema,
  createPostSchema,
  extractEntities,
  setReactionSchema,
  updateCommentSchema,
  updatePostSchema,
} from '@the-mesh/shared';
import { HttpResponse, http } from 'msw/http';
import { makeComment, makePost, summaryOf, testId } from '../fixtures';

let revisionSeq = 0;
const makeRevision = (content: string): Revision => ({
  id: testId('comment', 500 + ++revisionSeq),
  content,
  editedAt: new Date().toISOString(),
});
/** As the API answers it: the viewer's reactions and the live count of replies. */
const withReactions = (comment: Comment, viewerId: string): Comment => ({
  ...comment,
  reactions: reactionsFor(comment.id, viewerId),
  replyCount: mockDb.comments.filter((item) => item.parentId === comment.id).length,
});
/** Like the API: only members that exist are mentions; tags are lower-cased and distinct. */
export const entitiesOf = (content: string): { mentions: UserSummary[]; hashtags: string[] } => {
  const entities = extractEntities(content);
  return {
    mentions: mockDb.users
      .filter((user) => entities.mentions.includes(user.username))
      .map(summaryOf),
    hashtags: entities.hashtags.toSorted(),
  };
};
import { API, apiError, unauthorized } from './auth';
import { mockDb, paginate, reactionsFor } from './db';

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

  http.get(`${API}/posts/:id`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const post = mockDb.posts.find((item) => item.id === param(params.id));
    return post ? HttpResponse.json(post) : notFound('Post');
  }),

  /** Every word must occur in the text, like the API's `websearch_to_tsquery` does for plain words. */
  http.get(`${API}/search/posts`, ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    if (q.trim().length < 2 || q.length > 100) {
      return apiError(400, 'VALIDATION_ERROR', 'Validation failed', { q: 'Invalid query' });
    }
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const posts = mockDb.posts.filter((post) =>
      words.every((word) => post.content.toLowerCase().includes(word)),
    );
    return HttpResponse.json(paginate(posts, url));
  }),

  http.get(`${API}/comments/:id`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const comment = mockDb.comments.find((item) => item.id === param(params.id));
    return comment
      ? HttpResponse.json(withReactions(comment, mockDb.user.id))
      : notFound('Comment');
  }),

  /** Oldest first, like the API. */
  http.get(`${API}/comments/:id/replies`, ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const viewerId = mockDb.user.id;
    if (!mockDb.comments.some((item) => item.id === param(params.id))) return notFound('Comment');
    const replies = mockDb.comments
      .filter((item) => item.parentId === param(params.id))
      .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((item) => withReactions(item, viewerId));
    return HttpResponse.json(paginate(replies, new URL(request.url)));
  }),

  http.put(`${API}/posts/:id/repost`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const post = mockDb.posts.find((item) => item.id === param(params.id));
    if (!post) return notFound('Post');
    if (post.author.id === mockDb.user.id) {
      return apiError(400, 'BAD_REQUEST', 'You cannot repost your own post');
    }
    if (!post.repostedByMe) {
      post.repostedByMe = true;
      post.repostCount += 1;
    }
    return noContent();
  }),

  http.delete(`${API}/posts/:id/repost`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const post = mockDb.posts.find((item) => item.id === param(params.id));
    if (!post) return notFound('Post');
    if (post.repostedByMe) {
      post.repostedByMe = false;
      post.repostCount -= 1;
    }
    return noContent();
  }),

  http.get(`${API}/users/me/bookmarks`, ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const saved = mockDb.posts.filter((post) => post.bookmarkedByMe);
    return HttpResponse.json(paginate(saved, new URL(request.url)));
  }),

  http.put(`${API}/posts/:id/bookmark`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const post = mockDb.posts.find((item) => item.id === param(params.id));
    if (!post) return notFound('Post');
    post.bookmarkedByMe = true;
    return noContent();
  }),

  http.delete(`${API}/posts/:id/bookmark`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const post = mockDb.posts.find((item) => item.id === param(params.id));
    if (!post) return notFound('Post');
    post.bookmarkedByMe = false;
    return noContent();
  }),

  http.get(`${API}/users/:userId/posts`, ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const posts = mockDb.posts.filter((post) => post.author.id === param(params.userId));
    return HttpResponse.json(paginate(posts, new URL(request.url)));
  }),

  http.post(`${API}/posts`, async ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const body = createPostSchema.parse(await request.json());
    // A quote embeds the original (one level deep) and counts on it, like the API.
    const original = body.quotedPostId
      ? mockDb.posts.find((item) => item.id === body.quotedPostId)
      : undefined;
    if (body.quotedPostId && !original) {
      return apiError(400, 'BAD_REQUEST', 'Unknown post', { quotedPostId: 'Unknown post' });
    }
    if (original) original.repostCount += 1;
    const post = makePost({
      content: body.content,
      imageUrl: body.imageKey ? `http://localhost/api/v1/uploads/${body.imageKey}` : null,
      author: summaryOf(mockDb.user),
      createdAt: new Date().toISOString(),
      quotedPost: original
        ? {
            id: original.id,
            author: original.author,
            content: original.content,
            imageUrl: original.imageUrl,
            createdAt: original.createdAt,
          }
        : null,
      ...entitiesOf(body.content),
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
    if (!mockDb.posts.some((item) => item.id === param(params.postId))) return notFound('Post');
    const viewerId = mockDb.user.id;
    const url = new URL(request.url);
    const comments = mockDb.comments
      .filter((comment) => comment.postId === param(params.postId) && comment.parentId === null)
      .map((comment) => withReactions(comment, viewerId));
    const sorted =
      url.searchParams.get('sort') === 'top'
        ? comments.toSorted(
            (a, b) =>
              b.reactions.total - a.reactions.total || b.createdAt.localeCompare(a.createdAt),
          )
        : comments;
    return HttpResponse.json(paginate(sorted, url));
  }),

  http.post(`${API}/posts/:postId/comments`, async ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const post = mockDb.posts.find((item) => item.id === param(params.postId));
    if (!post) return notFound('Post');
    const body = createCommentSchema.parse(await request.json());
    // A reply goes under a top-level comment of the post; a reply to a reply under its parent.
    const target = body.parentId
      ? mockDb.comments.find((item) => item.id === body.parentId && item.postId === post.id)
      : undefined;
    if (body.parentId && !target) {
      return apiError(400, 'VALIDATION_ERROR', 'Validation failed', {
        parentId: 'No such comment on this post',
      });
    }
    const comment = makeComment(post.id, {
      parentId: target ? (target.parentId ?? target.id) : null,
      content: body.content,
      author: summaryOf(mockDb.user),
      createdAt: new Date().toISOString(),
      mentions: entitiesOf(body.content).mentions,
    });
    mockDb.comments.unshift(comment);
    post.commentCount += 1;
    return HttpResponse.json(withReactions(comment, mockDb.user.id), { status: 201 });
  }),

  http.delete(`${API}/comments/:id`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const comment = mockDb.comments.find((item) => item.id === param(params.id));
    if (!comment) return notFound('Comment');
    const post = mockDb.posts.find((item) => item.id === comment.postId);
    const allowed = comment.author.id === mockDb.user.id || post?.author.id === mockDb.user.id;
    if (!allowed)
      return forbidden('Only the comment author or the post author can delete a comment');
    // Replies go with their parent, like the database cascade.
    const gone = mockDb.comments.filter(
      (item) => item.id === comment.id || item.parentId === comment.id,
    );
    mockDb.comments = mockDb.comments.filter((item) => !gone.includes(item));
    if (post) post.commentCount -= gone.length;
    return noContent();
  }),

  http.patch(`${API}/posts/:id`, async ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const post = mockDb.posts.find((item) => item.id === param(params.id));
    if (!post) return notFound('Post');
    if (post.author.id !== mockDb.user.id) return forbidden('You can only edit your own posts');
    const body = updatePostSchema.parse(await request.json());
    if (body.content !== post.content) {
      const history = mockDb.postRevisions.get(post.id) ?? [];
      mockDb.postRevisions.set(post.id, [makeRevision(post.content), ...history]);
      post.content = body.content;
      post.editedAt = new Date().toISOString();
      Object.assign(post, entitiesOf(body.content));
    }
    return HttpResponse.json(post);
  }),

  http.get(`${API}/posts/:id/revisions`, ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    if (!mockDb.posts.some((item) => item.id === param(params.id))) return notFound('Post');
    return HttpResponse.json(
      paginate(mockDb.postRevisions.get(param(params.id)) ?? [], new URL(request.url)),
    );
  }),

  http.patch(`${API}/comments/:id`, async ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const comment = mockDb.comments.find((item) => item.id === param(params.id));
    if (!comment) return notFound('Comment');
    if (comment.author.id !== mockDb.user.id) {
      return forbidden('You can only edit your own comments');
    }
    const body = updateCommentSchema.parse(await request.json());
    if (body.content !== comment.content) {
      const history = mockDb.commentRevisions.get(comment.id) ?? [];
      mockDb.commentRevisions.set(comment.id, [makeRevision(comment.content), ...history]);
      comment.content = body.content;
      comment.editedAt = new Date().toISOString();
      comment.mentions = entitiesOf(body.content).mentions;
    }
    return HttpResponse.json(withReactions(comment, mockDb.user.id));
  }),

  http.get(`${API}/comments/:id/revisions`, ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    if (!mockDb.comments.some((item) => item.id === param(params.id))) return notFound('Comment');
    return HttpResponse.json(
      paginate(mockDb.commentRevisions.get(param(params.id)) ?? [], new URL(request.url)),
    );
  }),

  http.put(`${API}/comments/:id/reaction`, async ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const commentId = param(params.id);
    if (!mockDb.comments.some((item) => item.id === commentId)) return notFound('Comment');
    const { type } = setReactionSchema.parse(await request.json());
    const userId = mockDb.user.id;
    const existing = mockDb.reactions.find((r) => r.commentId === commentId && r.userId === userId);
    if (existing) existing.type = type;
    else mockDb.reactions.push({ commentId, userId, type });
    return HttpResponse.json(reactionsFor(commentId, userId));
  }),

  http.delete(`${API}/comments/:id/reaction`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const commentId = param(params.id);
    if (!mockDb.comments.some((item) => item.id === commentId)) return notFound('Comment');
    const userId = mockDb.user.id;
    mockDb.reactions = mockDb.reactions.filter(
      (r) => !(r.commentId === commentId && r.userId === userId),
    );
    return HttpResponse.json(reactionsFor(commentId, userId));
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
