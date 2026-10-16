import type { Message, SendMessageInput, UserSummary } from '@the-mesh/shared';
import { createContext, useContext } from 'react';

export type ChatContextValue = {
  /** The socket is open; sends go over it, otherwise over HTTP. */
  connected: boolean;
  online: UserSummary[];
  isOnline: (userId: string) => boolean;
  /** Who is writing in a conversation right now (never me); expires by itself when the signal stops. */
  typingIn: (conversationId: string) => readonly string[];
  sendMessage: (conversationId: string, input: SendMessageInput) => Promise<Message>;
  /** Fire-and-forget over the socket; silently nothing without a connection. */
  setTyping: (conversationId: string, typing: boolean) => void;
  markRead: (conversationId: string) => Promise<void>;
  /** The thread on screen; messages arriving there are read on arrival. */
  setActiveConversation: (conversationId: string | null) => void;
};

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat() used outside ChatProvider');
  return value;
}
