import {
  type Conversation,
  type Message,
  addMembersSchema,
  createGroupSchema,
  sendMessageSchema,
} from '@the-mesh/shared';
import { HttpResponse, http } from 'msw/http';
import { makeMessage, summaryOf } from '../fixtures';
import { API, apiError, unauthorized } from './auth';
import { type MockConversation, mockDb, paginate, seedConversation, seedDirect } from './db';

const param = (value: string | readonly string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';
const byNewest = (a: Message, b: Message) => b.createdAt.localeCompare(a.createdAt);
const notFound = () => apiError(404, 'NOT_FOUND', 'Conversation not found');

const messagesOf = (conversationId: string) =>
  mockDb.messages.filter((m) => m.conversationId === conversationId).toSorted(byNewest);

/** The row as `viewerId` sees it: member summaries, newest message, their unread count. */
export function conversationFor(viewerId: string, row: MockConversation): Conversation {
  const messages = messagesOf(row.id);
  const mine = row.members.find((m) => m.userId === viewerId);
  const unreadCount = messages.filter(
    (m) =>
      m.senderId !== viewerId &&
      (mine?.lastReadAt === null || m.createdAt > (mine?.lastReadAt ?? '')),
  ).length;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    createdById: row.createdById,
    createdAt: row.createdAt,
    lastMessageAt: messages[0]?.createdAt ?? null,
    members: row.members.flatMap((member) => {
      const user = mockDb.users.find((u) => u.id === member.userId);
      return user
        ? [{ user: summaryOf(user), joinedAt: member.joinedAt, lastReadAt: member.lastReadAt }]
        : [];
    }),
    lastMessage: messages[0] ?? null,
    unreadCount,
  };
}

export function conversationsFor(viewerId: string): Conversation[] {
  return mockDb.conversations
    .filter((row) => row.members.some((m) => m.userId === viewerId))
    .map((row) => conversationFor(viewerId, row))
    .filter((row) => row.kind === 'group' || row.lastMessage !== null)
    .toSorted((a, b) =>
      (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt),
    );
}

const memberRow = (viewerId: string, conversationId: string): MockConversation | undefined =>
  mockDb.conversations.find(
    (row) => row.id === conversationId && row.members.some((m) => m.userId === viewerId),
  );

/** Persists a message the way the API does: it also moves the sender's read mark. */
export function storeMessage(
  conversationId: string,
  senderId: string,
  content: string,
  imageKey?: string,
): Message {
  const message = makeMessage(conversationId, senderId, content, {
    imageUrl: imageKey ? `http://localhost/api/v1/uploads/${imageKey}` : null,
    createdAt: new Date().toISOString(),
  });
  mockDb.messages.push(message);
  const member = mockDb.conversations
    .find((row) => row.id === conversationId)
    ?.members.find((m) => m.userId === senderId);
  if (member) member.lastReadAt = message.createdAt;
  return message;
}

/** Moves the viewer's read mark to now when something is unread; returns the mark either way. */
export function markConversationRead(viewerId: string, row: MockConversation): string {
  const member = row.members.find((m) => m.userId === viewerId);
  const latest = messagesOf(row.id)[0];
  if (!member) return new Date().toISOString();
  if (latest && (member.lastReadAt === null || member.lastReadAt < latest.createdAt)) {
    member.lastReadAt = new Date().toISOString();
  }
  return member.lastReadAt ?? new Date().toISOString();
}

export const conversationHandlers = [
  http.get(`${API}/conversations`, () => {
    if (!mockDb.user) return unauthorized();
    return HttpResponse.json({ items: conversationsFor(mockDb.user.id), nextCursor: null });
  }),

  http.post(`${API}/conversations`, async ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const me = mockDb.user.id;
    const body = createGroupSchema.parse(await request.json());
    const memberIds = [...new Set(body.memberIds)].filter((id) => id !== me);
    if (memberIds.some((id) => !mockDb.users.some((u) => u.id === id))) {
      return apiError(400, 'BAD_REQUEST', 'Unknown member', {
        memberIds: 'Someone on the list does not exist',
      });
    }
    const row = seedConversation('group', [me, ...memberIds], {
      title: body.title,
      createdById: me,
      createdAt: new Date().toISOString(),
    });
    return HttpResponse.json(conversationFor(me, row), { status: 201 });
  }),

  http.put(`${API}/conversations/direct/:userId`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const me = mockDb.user.id;
    const userId = param(params.userId);
    if (userId === me) return apiError(400, 'BAD_REQUEST', 'You cannot message yourself');
    if (!mockDb.users.some((u) => u.id === userId)) {
      return apiError(404, 'NOT_FOUND', 'User not found');
    }
    return HttpResponse.json(conversationFor(me, seedDirect(me, userId)));
  }),

  http.get(`${API}/conversations/:id`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const row = memberRow(mockDb.user.id, param(params.id));
    return row ? HttpResponse.json(conversationFor(mockDb.user.id, row)) : notFound();
  }),

  http.get(`${API}/conversations/:id/messages`, ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const row = memberRow(mockDb.user.id, param(params.id));
    if (!row) return notFound();
    return HttpResponse.json(paginate(messagesOf(row.id), new URL(request.url)));
  }),

  http.post(`${API}/conversations/:id/messages`, async ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const row = memberRow(mockDb.user.id, param(params.id));
    if (!row) return notFound();
    const body = sendMessageSchema.parse(await request.json());
    const message = storeMessage(row.id, mockDb.user.id, body.content, body.imageKey);
    return HttpResponse.json(message, { status: 201 });
  }),

  http.post(`${API}/conversations/:id/read`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const row = memberRow(mockDb.user.id, param(params.id));
    if (!row) return notFound();
    return HttpResponse.json({ readAt: markConversationRead(mockDb.user.id, row) });
  }),

  http.post(`${API}/conversations/:id/members`, async ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const row = memberRow(mockDb.user.id, param(params.id));
    if (!row) return notFound();
    if (row.kind !== 'group') return apiError(400, 'BAD_REQUEST', 'Only groups have a member list');
    const body = addMembersSchema.parse(await request.json());
    const joinedAt = new Date().toISOString();
    for (const userId of new Set(body.userIds)) {
      if (!row.members.some((m) => m.userId === userId)) {
        row.members.push({ userId, joinedAt, lastReadAt: null });
      }
    }
    return HttpResponse.json(conversationFor(mockDb.user.id, row));
  }),

  http.delete(`${API}/conversations/:id/members/me`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const me = mockDb.user.id;
    const row = memberRow(me, param(params.id));
    if (!row) return notFound();
    if (row.kind !== 'group') return apiError(400, 'BAD_REQUEST', 'Only groups have a member list');
    row.members = row.members.filter((m) => m.userId !== me);
    if (row.members.length === 0) {
      mockDb.conversations = mockDb.conversations.filter((c) => c.id !== row.id);
      mockDb.messages = mockDb.messages.filter((m) => m.conversationId !== row.id);
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
