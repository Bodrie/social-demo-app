import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth/current-user';
import { updateMe } from '@/features/auth/use-me';
import type { Post, UpdatePostInput } from '@the-mesh/shared';
import { createPost, deletePost, likePost, unlikePost, updatePost } from '@/lib/api/posts';
import { holdQueries, resumeQueries, runningToggles } from '@/lib/optimistic';
import { queryKeys } from '@/lib/query-keys';
import {
  postListKeysShowing,
  prependPostTo,
  removePostEverywhere,
  updatePostEverywhere,
} from './post-cache';

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
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onSuccess: (_result, postId) => {
      removePostEverywhere(queryClient, postId);
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
