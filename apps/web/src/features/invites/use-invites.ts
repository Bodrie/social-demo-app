import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Invite } from '@beso/shared';
import { fetchMyInvite, lookupInvite, renewInvite } from '@/lib/api/invites';
import { queryKeys } from '@/lib/query-keys';

/** The member's own link; asked for only while the invite dialog is open. */
export function useMyInvite(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.invites.mine,
    queryFn: ({ signal }) => fetchMyInvite(signal),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** A new link; the old one stops working. */
export function useRenewInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: renewInvite,
    onSuccess: (invite: Invite) => queryClient.setQueryData(queryKeys.invites.mine, invite),
  });
}

/** Who a `/join/<code>` link is from; a link that does not work any more is a 404. */
export function useInviteLookup(code: string) {
  return useQuery({
    queryKey: queryKeys.invites.lookup(code),
    queryFn: ({ signal }) => lookupInvite(code, signal),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
