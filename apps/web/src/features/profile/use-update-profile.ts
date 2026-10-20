import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Post, UpdateProfileInput, UserSummary } from '@beso/shared';
import { setMe } from '@/features/auth/use-me';
import { updateProfile } from '@/lib/api/users';
import { type Pages, mapItems } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: ({ user }) => {
      setMe(queryClient, { user });
      // Posts embed the author summary; patch it in place so the feed does not need a refetch.
      const summary: UserSummary = {
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      };
      queryClient.setQueriesData<Pages<Post>>(
        { queryKey: queryKeys.posts.lists },
        (data) =>
          data &&
          mapItems(data, (post) =>
            post.author.id === user.id ? { ...post, author: summary } : post,
          ),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
  });
}
