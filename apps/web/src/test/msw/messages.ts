import { type Conversation, type Message, sendMessageSchema } from '@the-mesh/shared';
import { HttpResponse, http } from 'msw/http';
import { makeMessage, summaryOf } from '../fixtures';
import { API, apiError, unauthorized } from './auth';
import { mockDb, paginate } from './db';

const param = (value: string | readonly string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';
const byNewest = (a: Message, b: Message) => b.createdAt.localeCompare(a.createdAt);

export function conversationsFor(viewerId: string): Conversation[] {
  const byPeer = new Map<string, Message[]>();
  for (const message of mockDb.messages) {
    const peerId =
      message.senderId === viewerId
        ? message.recipientId
        : message.recipientId === viewerId
          ? message.senderId
          : null;
    if (!peerId) continue;
    byPeer.set(peerId, [...(byPeer.get(peerId) ?? []), message]);
  }
  const rows: Conversation[] = [];
  for (const [peerId, messages] of byPeer) {
    const peer = mockDb.users.find((user) => user.id === peerId);
    if (!peer) continue;
    const sorted = messages.toSorted(byNewest);
    rows.push({
      peer: summaryOf(peer),
      lastMessage: sorted[0]!,
      unreadCount: messages.filter((m) => m.senderId === peerId && !m.readAt).length,
    });
  }
  return rows.toSorted((a, b) => byNewest(a.lastMessage, b.lastMessage));
}

export const messageHandlers = [
  http.get(`${API}/messages`, () => {
    if (!mockDb.user) return unauthorized();
    return HttpResponse.json({ items: conversationsFor(mockDb.user.id), nextCursor: null });
  }),

  http.get(`${API}/messages/:userId`, ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const me = mockDb.user.id;
    const peerId = param(params.userId);
    const thread = mockDb.messages
      .filter(
        (m) =>
          (m.senderId === me && m.recipientId === peerId) ||
          (m.senderId === peerId && m.recipientId === me),
      )
      .toSorted(byNewest);
    return HttpResponse.json(paginate(thread, new URL(request.url)));
  }),

  http.post(`${API}/messages/:userId`, async ({ request, params }) => {
    if (!mockDb.user) return unauthorized();
    const peerId = param(params.userId);
    if (!mockDb.users.some((user) => user.id === peerId))
      return apiError(404, 'NOT_FOUND', 'User not found');
    const body = sendMessageSchema.parse(await request.json());
    const message = makeMessage(mockDb.user.id, peerId, body.content, {
      createdAt: new Date().toISOString(),
    });
    mockDb.messages.push(message);
    return HttpResponse.json(message, { status: 201 });
  }),

  http.post(`${API}/messages/:userId/read`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    const me = mockDb.user.id;
    const peerId = param(params.userId);
    const readAt = new Date().toISOString();
    let count = 0;
    for (const message of mockDb.messages) {
      if (message.senderId === peerId && message.recipientId === me && !message.readAt) {
        message.readAt = readAt;
        count += 1;
      }
    }
    return HttpResponse.json({ count });
  }),
];
