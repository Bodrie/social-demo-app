import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth/current-user';
import { updateMe } from '@/features/auth/use-me';
import type { UpdatePostInput } from '@the-mesh/shared';
import { createPost, deletePost, likePost, unlikePost, updatePost } from '@/lib/api/posts';
import { queryKeys } from '@/lib/query-keys';
import { resumePendingQueries } from '@/lib/query-snapshot';
import {
  prependPostTo,
  removePostEverywhere,
  restorePostLists,
  snapshotPostLists,
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

/** Optimistic: the count and the heart flip at once and roll back if the request fails. */
export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, liked }: ToggleLikeInput) =>
      liked ? unlikePost(postId) : likePost(postId),
    onMutate: async ({ postId, liked }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.posts.lists });
      const snapshot = snapshotPostLists(queryClient);
      updatePostEverywhere(queryClient, postId, (post) => ({
        ...post,
        likedByMe: !liked,
        likeCount: Math.max(0, post.likeCount + (liked ? -1 : 1)),
      }));
      return { snapshot };
    },
    onError: (_error, _input, context) => {
      if (context) restorePostLists(queryClient, context.snapshot);
      toast.error('Could not update the like');
    },
    onSettled: () => resumePendingQueries(queryClient, { queryKey: queryKeys.posts.lists }),
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
