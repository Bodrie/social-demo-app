import {
  type ConversationList,
  type MarkReadResult,
  type Message,
  type MessageList,
  type SendMessageInput,
  conversationListSchema,
  markReadResultSchema,
  messageListSchema,
  messageSchema,
} from '@the-mesh/shared';
import { api } from './client';
import { type PageOptions, queryString } from './query';

export const fetchConversations = (signal?: AbortSignal): Promise<ConversationList> =>
  api.get('/messages', conversationListSchema, { signal });

export const fetchThread = (peerId: string, { cursor, signal }: PageOptions): Promise<MessageList> =>
  api.get(`/messages/${peerId}${queryString({ cursor })}`, messageListSchema, { signal });

/** HTTP fallbacks for when the socket is not connected. */
export const sendMessageHttp = (peerId: string, input: SendMessageInput): Promise<Message> =>
  api.post(`/messages/${peerId}`, input, { schema: messageSchema });

export const markReadHttp = (peerId: string): Promise<MarkReadResult> =>
  api.post(`/messages/${peerId}/read`, undefined, { schema: markReadResultSchema });
