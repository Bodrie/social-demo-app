import { useQueryClient } from '@tanstack/react-query';
import {
  type ConversationReadPayload,
  conversationReadPayloadSchema,
  type ConversationRef,
  conversationRefSchema,
  type Message,
  messageSchema,
  type PresenceUpdate,
  presenceUpdateSchema,
  type SendMessageInput,
  SOCKET_EVENTS,
  type TypingUpdate,
  typingUpdateSchema,
  type UserSummary,
} from '@the-mesh/shared';
import type { z } from 'zod';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth/current-user';
import { ApiClientError, notifySessionLost, refreshSession } from '@/lib/api/client';
import { markReadHttp, sendMessageHttp } from '@/lib/api/conversations';
import type { ChatSocket } from '@/lib/socket';
import { ChatContext, type ChatContextValue } from './chat-context';
import {
  appendToThread,
  heldMessageIds,
  refreshConversation,
  replaceMessage,
  resyncConversations,
  setMemberReadAt,
  upsertConversation,
} from './message-cache';
import { forgetConversation } from './use-conversations';

const ACK_TIMEOUT_MS = 8000;
/** A "typing" that is not refreshed by then (composer every 2.5 s) is treated as over. */
export const TYPING_EXPIRY_MS = 6000;
/** How long a tab refused for having too many siblings waits before knocking again. */
export const REFUSED_RETRY_MS = 10_000;
const NOBODY: readonly string[] = [];

type TypingMap = ReadonlyMap<string, readonly string[]>;

const onException = (error: { message: string }) => toast.error(error.message);

/** Back-off for a session refresh that failed outright (offline, API restarting): 1 s, 2 s … 30 s. */
export const REFRESH_RETRY_BASE_MS = 1000;
const REFRESH_RETRY_MAX_MS = 30_000;

function withTyping(map: TypingMap, conversationId: string, userId: string, typing: boolean) {
  const current = map.get(conversationId) ?? NOBODY;
  if (current.includes(userId) === typing) return map;
  const next = new Map(map);
  const people = typing ? [...current, userId] : current.filter((id) => id !== userId);
  if (people.length === 0) next.delete(conversationId);
  else next.set(conversationId, people);
  return next;
}

/**
 * Owns the chat socket for the lifetime of a session: connects on mount, disconnects on
 * unmount (sign-out), keeps presence and typing in state and mirrors pushes into the query cache.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<UserSummary[]>([]);
  const [typing, setTypingMap] = useState<TypingMap>(() => new Map());
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Threads on screen, counted: the messages page and up to two chat windows at once. */
  const activeConversations = useRef(new Map<string, number>());
  const messageListeners = useRef(new Set<(message: Message) => void>());
  const socketRef = useRef<ChatSocket | null>(null);

  const setPeerTyping = useCallback((conversationId: string, userId: string, isTyping: boolean) => {
    const timers = typingTimers.current;
    const key = `${conversationId}:${userId}`;
    const timer = timers.get(key);
    if (timer) clearTimeout(timer);
    timers.delete(key);
    if (isTyping) {
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          setTypingMap((map) => withTyping(map, conversationId, userId, false));
        }, TYPING_EXPIRY_MS),
      );
    }
    setTypingMap((map) => withTyping(map, conversationId, userId, isTyping));
  }, []);

  const markRead = useCallback(
    async (conversationId: string) => {
      const optimistic = new Date().toISOString();
      setMemberReadAt(queryClient, conversationId, me.id, optimistic, { clearUnread: true });
      const socket = socketRef.current;
      try {
        let readAt: string;
        if (socket?.connected) {
          const ack = await socket
            .timeout(ACK_TIMEOUT_MS)
            .emitWithAck(SOCKET_EVENTS.messageRead, { conversationId });
          if (!ack.ok) throw new ApiClientError(ack.error);
          readAt = ack.readAt;
        } else {
          readAt = (await markReadHttp(conversationId)).readAt;
        }
        setMemberReadAt(queryClient, conversationId, me.id, readAt, { clearUnread: true });
      } catch {
        // The badge was cleared optimistically; the next conversations fetch corrects it if needed.
      }
    },
    [queryClient, me.id],
  );

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    /** The messages held when pushes stopped arriving; null while nothing can have been missed. */
    let heldBeforeGap: ReadonlySet<string> | null = null;
    const gapStarted = () => {
      heldBeforeGap ??= heldMessageIds(queryClient);
    };
    const retryLater = (task: () => void, delayMs: number) => {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(task, delayMs);
    };

    const onConnect = () => {
      setConnected(true);
      if (heldBeforeGap) void resyncConversations(queryClient, heldBeforeGap);
      heldBeforeGap = null;
    };
    /**
     * A push whose shape drifted from the shared contract is dropped instead of corrupting the
     * cache (HTTP responses are parsed the same way in the API client).
     */
    const guarded =
      <T,>(schema: z.ZodType<T>, handler: (payload: T) => void) =>
      (payload: unknown) => {
        const parsed = schema.safeParse(payload);
        if (parsed.success) handler(parsed.data);
        // oxlint-disable-next-line no-console -- a dropped push should be visible while developing
        else if (import.meta.env.DEV) console.warn('Dropped a socket push', parsed.error.issues);
      };
    const onPresence = guarded(presenceUpdateSchema, (users: PresenceUpdate) => setOnline(users));
    const onMessage = guarded(messageSchema, (message: Message) => {
      // A system line (the server about a membership change or rename) is shown but is nobody's
      // unread and reads nothing.
      const fromOther = message.kind === 'user' && message.senderId !== me.id;
      const onScreen =
        fromOther &&
        activeConversations.current.has(message.conversationId) &&
        document.visibilityState === 'visible';
      if (fromOther) setPeerTyping(message.conversationId, message.senderId, false);
      appendToThread(queryClient, message.conversationId, message);
      upsertConversation(queryClient, message, { countUnread: fromOther && !onScreen });
      if (onScreen) void markRead(message.conversationId);
      for (const listener of messageListeners.current) listener(message);
    });
    const onMessageDeleted = guarded(messageSchema, (message: Message) =>
      replaceMessage(queryClient, message),
    );
    const onRead = guarded(
      conversationReadPayloadSchema,
      // My own read, made in another tab, lowers this tab's badge too (review L9).
      ({ conversationId, userId, readAt }: ConversationReadPayload) =>
        setMemberReadAt(queryClient, conversationId, userId, readAt, {
          clearUnread: userId === me.id,
        }),
    );
    const onTyping = guarded(
      typingUpdateSchema,
      ({ conversationId, userId, typing: isTyping }: TypingUpdate) =>
        setPeerTyping(conversationId, userId, isTyping),
    );
    const onConversationUpdate = guarded(
      conversationRefSchema,
      ({ conversationId }: ConversationRef) =>
        void refreshConversation(queryClient, conversationId),
    );
    const onConversationRemoved = guarded(conversationRefSchema, ({ conversationId }) =>
      forgetConversation(queryClient, conversationId),
    );

    // socket.io-client is its own chunk; it loads once the shell is already on screen.
    void (async () => {
      const { getChatSocket } = await import('@/lib/socket');
      if (disposed) return;
      const socket = getChatSocket();
      socketRef.current = socket;

      /**
       * socket.io gives up on a socket the server closed or whose handshake it refused; only a
       * fresh access cookie helps then. A refresh that fails outright is tried again later.
       */
      const reconnectWithFreshToken = async (attempt = 0): Promise<void> => {
        let refreshed: boolean;
        try {
          refreshed = await refreshSession();
        } catch {
          if (disposed) return;
          const delay = Math.min(REFRESH_RETRY_BASE_MS * 2 ** attempt, REFRESH_RETRY_MAX_MS);
          retryLater(() => void reconnectWithFreshToken(attempt + 1), delay);
          return;
        }
        if (disposed) return;
        if (!refreshed) notifySessionLost();
        else if (!socket.active) socket.connect();
      };

      const onDisconnect = (reason: Socket.DisconnectReason) => {
        setConnected(false);
        setOnline([]);
        gapStarted();
        // Token expiry or revoked sessions. Any other reason: socket.io reconnects by itself.
        if (reason === 'io server disconnect') void reconnectWithFreshToken();
      };
      const onConnectError = (error: Error) => {
        gapStarted();
        // The cookie expired while the connection was down (sleep, a deploy).
        if (error.message === 'Unauthorized') void reconnectWithFreshToken();
        // Past MAX_SOCKETS_PER_USER (or after too many attempts): knock again once closed
        // tabs have had time to drop off.
        else if (error.message === 'Too many connections') {
          retryLater(() => socket.connect(), REFUSED_RETRY_MS);
        }
      };

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.on(SOCKET_EVENTS.presenceUpdate, onPresence);
      socket.on(SOCKET_EVENTS.messageNew, onMessage);
      socket.on(SOCKET_EVENTS.messageDeleted, onMessageDeleted);
      socket.on(SOCKET_EVENTS.conversationRead, onRead);
      socket.on(SOCKET_EVENTS.conversationUpdate, onConversationUpdate);
      socket.on(SOCKET_EVENTS.conversationRemoved, onConversationRemoved);
      socket.on(SOCKET_EVENTS.typingUpdate, onTyping);
      socket.on(SOCKET_EVENTS.exception, onException);
      socket.connect();

      cleanup = () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('connect_error', onConnectError);
        clearTimeout(retryTimer);
        socket.off(SOCKET_EVENTS.presenceUpdate, onPresence);
        socket.off(SOCKET_EVENTS.messageNew, onMessage);
        socket.off(SOCKET_EVENTS.messageDeleted, onMessageDeleted);
        socket.off(SOCKET_EVENTS.conversationRead, onRead);
        socket.off(SOCKET_EVENTS.conversationUpdate, onConversationUpdate);
        socket.off(SOCKET_EVENTS.conversationRemoved, onConversationRemoved);
        socket.off(SOCKET_EVENTS.typingUpdate, onTyping);
        socket.off(SOCKET_EVENTS.exception, onException);
        socket.disconnect();
        socketRef.current = null;
      };
    })();

    const timers = typingTimers.current;
    return () => {
      disposed = true;
      cleanup?.();
      setConnected(false);
      setOnline([]);
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      setTypingMap(new Map());
    };
  }, [me.id, queryClient, markRead, setPeerTyping]);

  const sendMessage = useCallback(async (conversationId: string, input: SendMessageInput) => {
    const socket = socketRef.current;
    if (!socket?.connected) return sendMessageHttp(conversationId, input);
    const ack = await socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(SOCKET_EVENTS.messageSend, { conversationId, ...input });
    if (!ack.ok) throw new ApiClientError(ack.error);
    return ack.message;
  }, []);

  const setTyping = useCallback((conversationId: string, isTyping: boolean) => {
    const socket = socketRef.current;
    if (socket?.connected) socket.emit(SOCKET_EVENTS.typing, { conversationId, typing: isTyping });
  }, []);

  const activateConversation = useCallback((conversationId: string) => {
    const active = activeConversations.current;
    active.set(conversationId, (active.get(conversationId) ?? 0) + 1);
    return () => {
      const left = (active.get(conversationId) ?? 1) - 1;
      if (left <= 0) active.delete(conversationId);
      else active.set(conversationId, left);
    };
  }, []);

  const subscribeToMessages = useCallback((listener: (message: Message) => void) => {
    messageListeners.current.add(listener);
    return () => {
      messageListeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      connected,
      online,
      isOnline: (userId) => online.some((user) => user.id === userId),
      typingIn: (conversationId) => typing.get(conversationId) ?? NOBODY,
      sendMessage,
      setTyping,
      markRead,
      activateConversation,
      subscribeToMessages,
    }),
    [
      connected,
      online,
      typing,
      sendMessage,
      setTyping,
      markRead,
      activateConversation,
      subscribeToMessages,
    ],
  );

  return <ChatContext value={value}>{children}</ChatContext>;
}
