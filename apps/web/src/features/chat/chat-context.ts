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
  /**
   * Declares a thread as on screen (the messages page or a chat window): messages arriving
   * there are read on arrival. Returns the release; several threads can be on screen at once.
   */
  activateConversation: (conversationId: string) => () => void;
  /** Every message pushed by the server, after the cache was updated (chat bubbles listen). */
  subscribeToMessages: (listener: (message: Message) => void) => () => void;
};

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat() used outside ChatProvider');
  return value;
}
