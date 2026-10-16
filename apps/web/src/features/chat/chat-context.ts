import type { Message, SendMessageInput, UserSummary } from '@the-mesh/shared';
import { createContext, useContext } from 'react';

export type ChatContextValue = {
  /** The socket is open; sends go over it, otherwise over HTTP. */
  connected: boolean;
  online: UserSummary[];
  isOnline: (userId: string) => boolean;
  /** `userId` is writing to me right now (expires by itself when the signal stops). */
  isTyping: (userId: string) => boolean;
  sendMessage: (recipientId: string, input: SendMessageInput) => Promise<Message>;
  /** Fire-and-forget over the socket; silently nothing without a connection. */
  setTyping: (recipientId: string, typing: boolean) => void;
  markRead: (peerId: string) => Promise<void>;
  /** The thread on screen; messages from that person are read on arrival. */
  setActivePeer: (peerId: string | null) => void;
};

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat() used outside ChatProvider');
  return value;
}
