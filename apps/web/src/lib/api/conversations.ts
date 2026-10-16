import {
  type AddMembersInput,
  type Conversation,
  type ConversationList,
  type CreateGroupInput,
  type MarkReadResult,
  type Message,
  type MessageList,
  type SendMessageInput,
  conversationListSchema,
  conversationSchema,
  markReadResultSchema,
  messageListSchema,
  messageSchema,
} from '@the-mesh/shared';
import { api } from './client';
import { type PageOptions, queryString } from './query';

export const fetchConversations = (signal?: AbortSignal): Promise<ConversationList> =>
  api.get('/conversations', conversationListSchema, { signal });

export const fetchConversation = (id: string, signal?: AbortSignal): Promise<Conversation> =>
  api.get(`/conversations/${id}`, conversationSchema, { signal });

/** The direct thread with someone, created the first time it is opened. */
export const ensureDirectConversation = (userId: string): Promise<Conversation> =>
  api.put(`/conversations/direct/${userId}`, undefined, { schema: conversationSchema });

export const createGroup = (input: CreateGroupInput): Promise<Conversation> =>
  api.post('/conversations', input, { schema: conversationSchema });

export const addMembers = (id: string, input: AddMembersInput): Promise<Conversation> =>
  api.post(`/conversations/${id}/members`, input, { schema: conversationSchema });

export const leaveGroup = (id: string): Promise<void> =>
  api.delete(`/conversations/${id}/members/me`);

export const fetchMessages = (id: string, { cursor, signal }: PageOptions): Promise<MessageList> =>
  api.get(`/conversations/${id}/messages${queryString({ cursor })}`, messageListSchema, {
    signal,
  });

/** HTTP fallbacks for when the socket is not connected. */
export const sendMessageHttp = (id: string, input: SendMessageInput): Promise<Message> =>
  api.post(`/conversations/${id}/messages`, input, { schema: messageSchema });

export const markReadHttp = (id: string): Promise<MarkReadResult> =>
  api.post(`/conversations/${id}/read`, undefined, { schema: markReadResultSchema });
