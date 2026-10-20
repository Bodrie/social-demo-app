import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Message, MessageReaction, ReactionType } from '@the-mesh/shared';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth/current-user';
import { clearMessageReaction, editMessage, setMessageReaction } from '@/lib/api/conversations';
import { queryKeys } from '@/lib/query-keys';
import { patchMessage, replaceMessage } from './message-cache';

/** The sender changes a message's text; the answer (also pushed to every member) replaces it. */
export function useEditMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      editMessage(conversationId, messageId, { content }),
    onSuccess: (message) => {
      replaceMessage(queryClient, message);
      void queryClient.invalidateQueries({ queryKey: queryKeys.revisions.message(message.id) });
    },
  });
}

const withReaction = (
  reactions: readonly MessageReaction[],
  userId: string,
  type: ReactionType | null,
): MessageReaction[] => {
  const others = reactions.filter((reaction) => reaction.userId !== userId);
  return type ? [...others, { userId, type }] : others;
};

type ReactInput = { message: Message; type: ReactionType | null };

/**
 * Optimistic: my entry in the message's reactions changes at once; the server's copy (which
 * every member gets pushed) replaces it, or the old list comes back on failure.
 */
export function useReactToMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  return useMutation({
    mutationFn: ({ message, type }: ReactInput) =>
      type
        ? setMessageReaction(conversationId, message.id, type)
        : clearMessageReaction(conversationId, message.id),
    onMutate: ({ message, type }) => {
      patchMessage(queryClient, conversationId, message.id, (item) => ({
        ...item,
        reactions: withReaction(item.reactions, me.id, type),
      }));
      return { previous: message.reactions };
    },
    onSuccess: (message) => replaceMessage(queryClient, message),
    onError: (_error, { message }, context) => {
      if (context) {
        patchMessage(queryClient, conversationId, message.id, (item) => ({
          ...item,
          reactions: context.previous,
        }));
      }
      toast.error('Could not save the reaction');
    },
  });
}
