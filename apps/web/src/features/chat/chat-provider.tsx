import { useQueryClient } from '@tanstack/react-query';
import {
  type ConversationReadPayload,
  type ConversationRef,
  type Message,
  type PresenceUpdate,
  SOCKET_EVENTS,
  type SendMessageInput,
  type TypingUpdate,
  type UserSummary,
} from '@the-mesh/shared';
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
  refreshConversation,
  setMemberReadAt,
  upsertConversation,
} from './message-cache';
import { forgetConversation } from './use-conversations';

const ACK_TIMEOUT_MS = 8000;
/** A "typing" that is not refreshed by then (composer every 2.5 s) is treated as over. */
export const TYPING_EXPIRY_MS = 6000;
const NOBODY: readonly string[] = [];

type TypingMap = ReadonlyMap<string, readonly string[]>;

const onException = (error: { message: string }) => toast.error(error.message);

/** socket.io keeps retrying by itself; a refreshed cookie makes the next attempt succeed. */
const onConnectError = (error: Error) => {
  if (error.message === 'Unauthorized') {
    void (async () => {
      if (!(await refreshSession())) notifySessionLost();
    })();
  }
};

/** After the server closed the socket (token expiry, revoked sessions), only a fresh token helps. */
async function reconnectWithFreshToken(socket: ChatSocket): Promise<void> {
  if (await refreshSession()) socket.connect();
  else notifySessionLost();
}

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
  const activeConversation = useRef<string | null>(null);
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

    const onConnect = () => setConnected(true);
    const onPresence = (users: PresenceUpdate) => setOnline(users);
    const onMessage = (message: Message) => {
      const fromOther = message.senderId !== me.id;
      const onScreen =
        fromOther &&
        activeConversation.current === message.conversationId &&
        document.visibilityState === 'visible';
      if (fromOther) setPeerTyping(message.conversationId, message.senderId, false);
      appendToThread(queryClient, message.conversationId, message);
      upsertConversation(queryClient, message, { countUnread: fromOther && !onScreen });
      if (onScreen) void markRead(message.conversationId);
    };
    const onRead = ({ conversationId, userId, readAt }: ConversationReadPayload) =>
      setMemberReadAt(queryClient, conversationId, userId, readAt, { clearUnread: false });
    const onTyping = ({ conversationId, userId, typing: isTyping }: TypingUpdate) =>
      setPeerTyping(conversationId, userId, isTyping);
    const onConversationUpdate = ({ conversationId }: ConversationRef) =>
      void refreshConversation(queryClient, conversationId);
    const onConversationRemoved = ({ conversationId }: ConversationRef) =>
      forgetConversation(queryClient, conversationId);

    // socket.io-client is its own chunk; it loads once the shell is already on screen.
    void (async () => {
      const { getChatSocket } = await import('@/lib/socket');
      if (disposed) return;
      const socket = getChatSocket();
      socketRef.current = socket;
      const onDisconnect = (reason: Socket.DisconnectReason) => {
        setConnected(false);
        setOnline([]);
        if (reason === 'io server disconnect') void reconnectWithFreshToken(socket);
      };

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.on(SOCKET_EVENTS.presenceUpdate, onPresence);
      socket.on(SOCKET_EVENTS.messageNew, onMessage);
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
        socket.off(SOCKET_EVENTS.presenceUpdate, onPresence);
        socket.off(SOCKET_EVENTS.messageNew, onMessage);
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

  const setActiveConversation = useCallback((conversationId: string | null) => {
    activeConversation.current = conversationId;
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
      setActiveConversation,
    }),
    [connected, online, typing, sendMessage, setTyping, markRead, setActiveConversation],
  );

  return <ChatContext value={value}>{children}</ChatContext>;
}
