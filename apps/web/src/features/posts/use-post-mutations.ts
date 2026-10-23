import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth/current-user';
import { updateMe } from '@/features/auth/use-me';
import { type Post, type UpdatePostInput, isAvailableEmbed } from '@beso/shared';
import {
  bookmarkPost,
  createPost,
  deletePost,
  fetchPost,
  likePost,
  repostPost,
  unbookmarkPost,
  unlikePost,
  unrepostPost,
  updatePost,
  votePoll,
} from '@/lib/api/posts';
import { isApiClientError } from '@/lib/api/client';
import { type Pages, filterItems } from '@/lib/infinite';
import { holdQueries, resumeQueries, runningToggles } from '@/lib/optimistic';
import { queryKeys } from '@/lib/query-keys';
import {
  findCachedPost,
  postListKeysShowing,
  prependPostTo,
  removePostEverywhere,
  updatePostEverywhere,
} from './post-cache';

/** The original of a quote, as cached lists show it, counts the quote with its reposts. */
function adjustQuotedCount(queryClient: QueryClient, post: Post | undefined, delta: number): void {
  if (!post?.quotedPost || !isAvailableEmbed(post.quotedPost)) return;
  updatePostEverywhere(queryClient, post.quotedPost.id, (original) => ({
    ...original,
    repostCount: Math.max(0, original.repostCount + delta),
  }));
}

function adjustMyPostCount(queryClient: QueryClient, delta: number): void {
  updateMe(queryClient, (user) => ({
    ...user,
    counts: { ...user.counts, posts: Math.max(0, user.counts.posts + delta) },
  }));
  void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  return useMutation({
    mutationFn: createPost,
    onSuccess: (post) => {
      prependPostTo(queryClient, queryKeys.posts.feed, post);
      prependPostTo(queryClient, queryKeys.posts.byUser(me.id), post);
      adjustMyPostCount(queryClient, 1);
      adjustQuotedCount(queryClient, post, 1);
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onSuccess: (_result, postId) => {
      const gone = findCachedPost(queryClient, postId);
      removePostEverywhere(queryClient, postId);
      adjustQuotedCount(queryClient, gone, -1);
      queryClient.removeQueries({ queryKey: queryKeys.comments.ofPost(postId) });
      adjustMyPostCount(queryClient, -1);
      toast.success('Post deleted');
    },
    onError: () => toast.error('Could not delete the post'),
  });
}

type ToggleLikeInput = { postId: string; liked: boolean };
const LIKE_KEY = ['posts', 'like'] as const;

/** The post with my like set to `liked`; unchanged if it already is, so repeating it is safe. */
function withLike(post: Post, liked: boolean): Post {
  if (post.likedByMe === liked) return post;
  return { ...post, likedByMe: liked, likeCount: Math.max(0, post.likeCount + (liked ? 1 : -1)) };
}

/**
 * Optimistic: the heart and the count flip at once. Only this post is ever touched, so other
 * likes in flight keep theirs: a failure puts this one back and refetches the lists showing
 * it; a success sets it again in case one of them was refetched with the old state meanwhile.
 */
export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: LIKE_KEY,
    mutationFn: ({ postId, liked }: ToggleLikeInput) =>
      liked ? unlikePost(postId) : likePost(postId),
    onMutate: async ({ postId, liked }) => {
      const interrupted = await holdQueries(queryClient, postListKeysShowing(queryClient, postId));
      updatePostEverywhere(queryClient, postId, (post) => withLike(post, !liked));
      return { interrupted };
    },
    onSuccess: (_result, { postId, liked }) => {
      if (runningToggles(queryClient, LIKE_KEY, { postId }) > 1) return;
      updatePostEverywhere(queryClient, postId, (post) => withLike(post, !liked));
    },
    onError: (_error, { postId, liked }) => {
      const showing = postListKeysShowing(queryClient, postId);
      updatePostEverywhere(queryClient, postId, (post) => withLike(post, liked));
      for (const queryKey of showing) void queryClient.invalidateQueries({ queryKey, exact: true });
      toast.error('Could not update the like');
    },
    onSettled: (_result, _error, _input, context) =>
      resumeQueries(queryClient, context?.interrupted ?? []),
  });
}

type ToggleBookmarkInput = { postId: string; bookmarked: boolean };
const BOOKMARK_KEY = ['posts', 'bookmark'] as const;

/** The post with my bookmark set to `bookmarked`; unchanged if it already is. */
function withBookmark(post: Post, bookmarked: boolean): Post {
  return post.bookmarkedByMe === bookmarked ? post : { ...post, bookmarkedByMe: bookmarked };
}

/**
 * Same discipline as the like: only this post changes, and only its own state. On the
 * Bookmarks page a removed bookmark drops the card at once (a failure refetches that list,
 * like every list showing the post); a new one goes to the top of that list when it is loaded.
 */
export function useToggleBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: BOOKMARK_KEY,
    mutationFn: ({ postId, bookmarked }: ToggleBookmarkInput) =>
      bookmarked ? unbookmarkPost(postId) : bookmarkPost(postId),
    onMutate: async ({ postId, bookmarked }) => {
      const interrupted = await holdQueries(queryClient, postListKeysShowing(queryClient, postId));
      updatePostEverywhere(queryClient, postId, (post) => withBookmark(post, !bookmarked));
      if (bookmarked) {
        queryClient.setQueryData<Pages<Post>>(
          queryKeys.posts.bookmarks,
          (pages) => pages && filterItems(pages, (post) => post.id !== postId),
        );
      }
      return { interrupted };
    },
    onSuccess: (_result, { postId, bookmarked }) => {
      if (runningToggles(queryClient, BOOKMARK_KEY, { postId }) > 1) return;
      updatePostEverywhere(queryClient, postId, (post) => withBookmark(post, !bookmarked));
      if (bookmarked) return;
      const saved = queryClient.getQueryData<Pages<Post>>(queryKeys.posts.feed);
      const post = saved?.pages.flatMap((page) => page.items).find((item) => item.id === postId);
      if (post && queryClient.getQueryData(queryKeys.posts.bookmarks)) {
        prependPostTo(queryClient, queryKeys.posts.bookmarks, withBookmark(post, true));
      }
    },
    onError: (_error, { postId, bookmarked }) => {
      const showing = postListKeysShowing(queryClient, postId);
      updatePostEverywhere(queryClient, postId, (post) => withBookmark(post, bookmarked));
      for (const queryKey of showing) void queryClient.invalidateQueries({ queryKey, exact: true });
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.bookmarks, exact: true });
      toast.error('Could not update the bookmark');
    },
    onSettled: (_result, _error, _input, context) =>
      resumeQueries(queryClient, context?.interrupted ?? []),
  });
}

type ToggleRepostInput = { postId: string; reposted: boolean };
const REPOST_KEY = ['posts', 'repost'] as const;

/** The post with my plain repost set to `reposted`; unchanged if it already is. */
function withRepost(post: Post, reposted: boolean): Post {
  if (post.repostedByMe === reposted) return post;
  return {
    ...post,
    repostedByMe: reposted,
    repostCount: Math.max(0, post.repostCount + (reposted ? 1 : -1)),
  };
}

/**
 * A plain repost, with the like's optimistic discipline. The post keeps its place in the lists
 * it is in; where the repost itself turns up (the viewer's profile, their followers' feeds)
 * comes from the server on the next load.
 */
export function useToggleRepost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: REPOST_KEY,
    mutationFn: ({ postId, reposted }: ToggleRepostInput) =>
      reposted ? unrepostPost(postId) : repostPost(postId),
    onMutate: async ({ postId, reposted }) => {
      const interrupted = await holdQueries(queryClient, postListKeysShowing(queryClient, postId));
      updatePostEverywhere(queryClient, postId, (post) => withRepost(post, !reposted));
      return { interrupted };
    },
    onSuccess: (_result, { postId, reposted }) => {
      if (runningToggles(queryClient, REPOST_KEY, { postId }) > 1) return;
      updatePostEverywhere(queryClient, postId, (post) => withRepost(post, !reposted));
    },
    onError: (_error, { postId, reposted }) => {
      const showing = postListKeysShowing(queryClient, postId);
      updatePostEverywhere(queryClient, postId, (post) => withRepost(post, reposted));
      for (const queryKey of showing) void queryClient.invalidateQueries({ queryKey, exact: true });
      toast.error('Could not update the repost');
    },
    onSettled: (_result, _error, _input, context) =>
      resumeQueries(queryClient, context?.interrupted ?? []),
  });
}

/**
 * A vote is final and its counts come from the server (the viewer could not see them before),
 * so nothing is optimistic: the answer's poll replaces the cached one wherever the post shows.
 * A refusal (closed meanwhile, voted in another tab) reloads the poll as it now is.
 */
export function useVotePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, optionId }: { postId: string; optionId: string }) =>
      votePoll(postId, optionId),
    onSuccess: (post) => withPoll(queryClient, post),
    onError: (error, { postId }) => {
      toast.error(isApiClientError(error) ? error.message : 'Could not send your vote');
      void refreshPoll(queryClient, postId);
    },
  });
}

/** The poll as the server sees it now; the rest of each cached copy stays (its repost line, say). */
export async function refreshPoll(queryClient: QueryClient, postId: string): Promise<void> {
  try {
    withPoll(queryClient, await fetchPost(postId));
  } catch {
    // Gone or out of reach: the lists catch up on their next load.
  }
}

function withPoll(queryClient: QueryClient, post: Post): void {
  updatePostEverywhere(queryClient, post.id, (current) => ({ ...current, poll: post.poll }));
}

export function useUpdatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: UpdatePostInput }) =>
      updatePost(postId, input),
    onSuccess: (post) => {
      updatePostEverywhere(queryClient, post.id, () => post);
      void queryClient.invalidateQueries({ queryKey: queryKeys.revisions.post(post.id) });
    },
  });
}
