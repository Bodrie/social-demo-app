import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MeResponse, UpdateSettingsInput } from '@beso/shared';
import { toast } from 'sonner';
import { setMe, updateMe } from '@/features/auth/use-me';
import { updateSettings } from '@/lib/api/users';
import { queryKeys } from '@/lib/query-keys';

/** A preference switch: flips at once, the server's copy replaces it, a failure puts it back. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => updateSettings(input),
    onMutate: (input) => {
      const previous = queryClient.getQueryData<MeResponse | null>(queryKeys.me) ?? null;
      updateMe(queryClient, (user) => ({ ...user, settings: { ...user.settings, ...input } }));
      return { previous };
    },
    onSuccess: (me) => setMe(queryClient, me),
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) setMe(queryClient, context.previous);
      toast.error('Could not save that setting');
    },
  });
}
