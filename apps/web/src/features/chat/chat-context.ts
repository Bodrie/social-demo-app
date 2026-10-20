import type { Message, SendMessageInput, UserSummary } from '@beso/shared';
import { createContext, useContext } from 'react';

/** What the receiving tab knew when a message was pushed. */
export type MessageContext = {
  /**
   * The conversation was on screen in this tab (the open thread or a chat window, tab visible),
   * so the message was read on arrival: no bubble, no badge, no sound.
   */
  onScreen: boolean;
};

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
  /** Every message pushed by the server, after the cache was updated (chat bubbles and alerts listen). */
  subscribeToMessages: (
    listener: (message: Message, context: MessageContext) => void,
  ) => () => void;
};

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat() used outside ChatProvider');
  return value;
}
