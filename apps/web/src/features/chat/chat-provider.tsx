import { useQueryClient } from '@tanstack/react-query';
import {
  type ConversationReadPayload,
  type Message,
  type PresenceUpdate,
  SOCKET_EVENTS,
  type UserSummary,
} from '@the-mesh/shared';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth/current-user';
import { ApiClientError, notifySessionLost, refreshSession } from '@/lib/api/client';
import { markReadHttp, sendMessageHttp } from '@/lib/api/messages';
import type { ChatSocket } from '@/lib/socket';
import { ChatContext, type ChatContextValue } from './chat-context';
import {
  appendToThread,
  markReceivedRead,
  markSentRead,
  peerOf,
  upsertConversation,
} from './message-cache';

const ACK_TIMEOUT_MS = 8000;

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

/**
 * Owns the chat socket for the lifetime of a session: connects on mount, disconnects on
 * unmount (sign-out), keeps presence in state and mirrors pushes into the query cache.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<UserSummary[]>([]);
  const activePeer = useRef<string | null>(null);
  const socketRef = useRef<ChatSocket | null>(null);

  const markRead = useCallback(
    async (peerId: string) => {
      markReceivedRead(queryClient, peerId, new Date().toISOString());
      const socket = socketRef.current;
      try {
        if (socket?.connected) {
          const ack = await socket
            .timeout(ACK_TIMEOUT_MS)
            .emitWithAck(SOCKET_EVENTS.messageRead, { userId: peerId });
          if (!ack.ok) throw new ApiClientError(ack.error);
        } else {
          await markReadHttp(peerId);
        }
      } catch {
        // The badge was cleared optimistically; the next conversations fetch corrects it if needed.
      }
    },
    [queryClient],
  );

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const onConnect = () => setConnected(true);
    const onPresence = (users: PresenceUpdate) => setOnline(users);
    const onMessage = (message: Message) => {
      const peerId = peerOf(message, me.id);
      const fromPeer = message.senderId !== me.id;
      const onScreen =
        fromPeer && activePeer.current === peerId && document.visibilityState === 'visible';
      appendToThread(queryClient, peerId, message);
      upsertConversation(queryClient, me.id, message, { countUnread: fromPeer && !onScreen });
      if (onScreen) void markRead(peerId);
    };
    const onRead = ({ userId, readAt }: ConversationReadPayload) =>
      markSentRead(queryClient, userId, me.id, readAt);

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
      socket.on(SOCKET_EVENTS.exception, onException);
      socket.connect();

      cleanup = () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('connect_error', onConnectError);
        socket.off(SOCKET_EVENTS.presenceUpdate, onPresence);
        socket.off(SOCKET_EVENTS.messageNew, onMessage);
        socket.off(SOCKET_EVENTS.conversationRead, onRead);
        socket.off(SOCKET_EVENTS.exception, onException);
        socket.disconnect();
        socketRef.current = null;
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
      setConnected(false);
      setOnline([]);
    };
  }, [me.id, queryClient, markRead]);

  const sendMessage = useCallback(async (recipientId: string, content: string) => {
    const socket = socketRef.current;
    if (!socket?.connected) return sendMessageHttp(recipientId, { content });
    const ack = await socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(SOCKET_EVENTS.messageSend, { recipientId, content });
    if (!ack.ok) throw new ApiClientError(ack.error);
    return ack.message;
  }, []);

  const setActivePeer = useCallback((peerId: string | null) => {
    activePeer.current = peerId;
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      connected,
      online,
      isOnline: (userId) => online.some((user) => user.id === userId),
      sendMessage,
      markRead,
      setActivePeer,
    }),
    [connected, online, sendMessage, markRead, setActivePeer],
  );

  return <ChatContext value={value}>{children}</ChatContext>;
}
