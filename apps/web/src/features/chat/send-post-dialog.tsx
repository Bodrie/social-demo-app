import { MESSAGE_MAX_LENGTH, type Conversation, type Post, type UserSummary } from '@beso/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { cn } from 'cn';
import { CheckIcon, SearchIcon, XIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/current-user';
import { usersQueryOptions } from '@/features/users/use-users';
import { isApiClientError } from '@/lib/api/client';
import { flattenPages } from '@/lib/infinite';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useChat } from './chat-context';
import { ConversationAvatar } from './conversation-avatar';
import { conversationName, directPeer, listNames } from './conversation-display';
import { useConversations, useEnsureDirect } from './use-conversations';

/** Chats one send reaches at most; each gets a message of its own. */
export const SEND_POST_MAX_TARGETS = 10;
const RECENT = 20;
const MAX_PEOPLE = 8;

/** A chat that exists, or a person to start one with when Send is pressed. */
type Target =
  | { key: string; kind: 'conversation'; conversation: Conversation; name: string }
  | { key: string; kind: 'person'; user: UserSummary; name: string };

type SendPostDialogProps = {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Send" on a post (ADR 0009 amendment 4): pick up to ten chats or people, add a message if you
 * like, and the post goes to each as a message of its own. The pushes put it in every list and
 * thread, so nothing is written to the cache here; the viewer stays where they are.
 */
export function SendPostDialog({ post, open, onOpenChange }: SendPostDialogProps) {
  const me = useCurrentUser();
  const { sendMessage } = useChat();
  const ensureDirect = useEnsureDirect();
  const searchId = useId();
  const noteId = useId();
  const [input, setInput] = useState('');
  const q = useDebouncedValue(input.trim(), 250);
  const [chosen, setChosen] = useState<readonly Target[]>([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const conversations = useConversations();
  const people = useInfiniteQuery({ ...usersQueryOptions(q), enabled: q.length > 0 });

  const chats = flattenPages(conversations.data);
  // Someone with a direct chat already is offered as that chat, never twice.
  const peers = new Set(chats.flatMap((c) => directPeer(c, me.id)?.id ?? []));
  const needle = q.toLowerCase();
  const matches = (c: Conversation) =>
    conversationName(c, me.id).toLowerCase().includes(needle) ||
    c.members.some((m) => m.user.id !== me.id && m.user.username.toLowerCase().includes(needle));
  const chatTargets: Target[] = (q ? chats.filter(matches) : chats.slice(0, RECENT)).map((c) => ({
    key: c.id,
    kind: 'conversation',
    conversation: c,
    name: conversationName(c, me.id),
  }));
  const personTargets: Target[] = q
    ? flattenPages(people.data)
        .filter((user) => user.id !== me.id && !peers.has(user.id))
        .slice(0, MAX_PEOPLE)
        .map((user) => ({ key: `user:${user.id}`, kind: 'person', user, name: user.name }))
    : [];

  const isChosen = (target: Target) => chosen.some((t) => t.key === target.key);
  const full = chosen.length >= SEND_POST_MAX_TARGETS;
  const toggle = (target: Target) =>
    setChosen((current) =>
      current.some((t) => t.key === target.key)
        ? current.filter((t) => t.key !== target.key)
        : current.length < SEND_POST_MAX_TARGETS
          ? [...current, target]
          : current,
    );

  const loading = conversations.isPending || (q.length > 0 && people.isPending);
  const found = chatTargets.length + personTargets.length;
  const status = loading
    ? ''
    : found === 0
      ? 'Nothing found'
      : `${found} ${found === 1 ? 'chat or person' : 'chats and people'} found`;

  const reset = () => {
    setInput('');
    setChosen([]);
    setNote('');
  };

  const sendTo = async (target: Target) => {
    const conversationId =
      target.kind === 'conversation'
        ? target.conversation.id
        : (await ensureDirect.mutateAsync(target.user.id)).id;
    await sendMessage(conversationId, { content: note.trim(), postId: post.id });
  };

  const send = async () => {
    if (chosen.length === 0 || sending) return;
    setSending(true);
    const results = await Promise.allSettled(chosen.map(sendTo));
    setSending(false);
    const failed = chosen.filter((_, index) => results[index]?.status === 'rejected');
    if (failed.length === 0) {
      toast.success(
        chosen.length === 1 ? `Sent to ${chosen[0]?.name}` : `Sent to ${chosen.length} chats`,
      );
      reset();
      onOpenChange(false);
      return;
    }
    // What went out stays sent; what did not stays chosen, for another try.
    const firstError = results.find((r) => r.status === 'rejected')?.reason;
    toast.error(
      `Could not send to ${listNames(failed.map((t) => t.name))}` +
        (isApiClientError(firstError) ? `: ${firstError.message}` : ''),
    );
    setChosen(failed);
  };

  const row = (target: Target) => {
    const selected = isChosen(target);
    return (
      <li key={target.key}>
        <button
          type="button"
          aria-pressed={selected}
          disabled={!selected && full}
          className={cn(
            'hover:bg-muted flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left disabled:opacity-50',
            selected && 'bg-accent/60',
          )}
          onClick={() => toggle(target)}
        >
          {target.kind === 'conversation' ? (
            <ConversationAvatar conversation={target.conversation} meId={me.id} size="lg" />
          ) : (
            <UserAvatar user={target.user} size="lg" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{target.name}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {target.kind === 'person'
                ? `@${target.user.username}`
                : target.conversation.kind === 'group'
                  ? `${target.conversation.members.length} members`
                  : `@${directPeer(target.conversation, me.id)?.username ?? ''}`}
            </span>
          </span>
          {selected ? (
            <CheckIcon className="text-primary size-4 shrink-0" aria-hidden="true" />
          ) : null}
        </button>
      </li>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send post</DialogTitle>
          <DialogDescription>
            Send it to up to {SEND_POST_MAX_TARGETS} chats, with a message if you like.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          <div className="relative">
            <SearchIcon
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              type="search"
              aria-label="Search chats and people"
              placeholder="Search chats and people"
              autoComplete="off"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="pl-9"
            />
          </div>
          <output className="sr-only block">{status}</output>

          {chosen.length > 0 ? (
            <ul aria-label="Sending to" className="flex flex-wrap gap-1.5">
              {chosen.map((target) => (
                <li key={target.key}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    className="rounded-full"
                    aria-label={`Remove ${target.name}`}
                    onClick={() => toggle(target)}
                  >
                    {target.name}
                    <XIcon aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {loading ? (
            <div className="space-y-2" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : found === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {q ? 'Nothing found.' : 'No chats yet. Search for someone to send it to.'}
            </p>
          ) : (
            <ul
              aria-label="Chats and people"
              // Scrollable, so it must be reachable from the keyboard.
              tabIndex={0}
              className="focus-visible:ring-ring/50 max-h-72 space-y-3 overflow-y-auto rounded-lg outline-none focus-visible:ring-2"
            >
              {chatTargets.length > 0 ? (
                <li>
                  <ul aria-label={q ? 'Chats' : 'Recent chats'} className="space-y-1">
                    {chatTargets.map(row)}
                  </ul>
                </li>
              ) : null}
              {personTargets.length > 0 ? (
                <li>
                  <ul aria-label="People" className="space-y-1">
                    {personTargets.map(row)}
                  </ul>
                </li>
              ) : null}
            </ul>
          )}
          {full ? (
            <p className="text-muted-foreground text-xs">
              That is {SEND_POST_MAX_TARGETS}, the most one send can reach.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor={noteId}>Message (optional)</Label>
            <Textarea
              id={noteId}
              value={note}
              maxLength={MESSAGE_MAX_LENGTH}
              rows={2}
              placeholder="Add a message"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={chosen.length === 0 || sending}
            onClick={() => void send()}
          >
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
