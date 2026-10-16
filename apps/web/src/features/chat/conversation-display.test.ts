import type { Conversation } from '@the-mesh/shared';
import { alice, bob, carol, summaryOf } from '@/test/fixtures';
import { conversationName, directPeer, readBy, seenText, typingText } from './conversation-display';

const T0 = '2026-10-16T10:00:00.000Z';
const T1 = '2026-10-16T10:05:00.000Z';
const T2 = '2026-10-16T10:10:00.000Z';

function conversation(
  kind: Conversation['kind'],
  marks: Record<string, string | null>,
  title: string | null = null,
): Conversation {
  const members = [alice, bob, carol]
    .filter((user) => user.id in marks)
    .map((user) => ({ user: summaryOf(user), joinedAt: T0, lastReadAt: marks[user.id] ?? null }));
  return {
    id: '01a14300-0000-7000-8000-000000000001',
    kind,
    title,
    createdById: alice.id,
    createdAt: T0,
    lastMessageAt: T1,
    members,
    lastMessage: null,
    unreadCount: 0,
  };
}

describe('directPeer / conversationName', () => {
  it('names a direct thread after the other person and a group after its title', () => {
    const direct = conversation('direct', { [alice.id]: null, [bob.id]: null });
    expect(directPeer(direct, alice.id)?.id).toBe(bob.id);
    expect(conversationName(direct, alice.id)).toBe('Bob Brown');
    const group = conversation('group', { [alice.id]: null, [bob.id]: null }, 'Trip');
    expect(directPeer(group, alice.id)).toBeNull();
    expect(conversationName(group, alice.id)).toBe('Trip');
  });
});

describe('typingText', () => {
  it('reads naturally for one, two and many people', () => {
    expect(typingText([])).toBeNull();
    expect(typingText(['Bob'])).toBe('Bob is typing…');
    expect(typingText(['Bob', 'Carol'])).toBe('Bob and Carol are typing…');
    expect(typingText(['Bob', 'Carol', 'Dan'])).toBe('Bob, Carol and 1 other are typing…');
    expect(typingText(['Bob', 'Carol', 'Dan', 'Eve'])).toBe('Bob, Carol and 2 others are typing…');
  });
});

describe('readBy / seenText', () => {
  it('counts a member as having read a message once their mark passed it', () => {
    const group = conversation('group', { [alice.id]: T2, [bob.id]: T1, [carol.id]: T0 }, 'Trip');
    expect(readBy(group, alice.id, T1).map((m) => m.user.id)).toEqual([bob.id]);
    expect(readBy(group, alice.id, T2)).toEqual([]);
  });

  it('says "Seen" in a direct thread and names readers in a group', () => {
    const direct = conversation('direct', { [alice.id]: T2, [bob.id]: T1 });
    expect(seenText(direct, alice.id, T1)).toBe('Seen');
    expect(seenText(direct, alice.id, T2)).toBeNull();

    const group = conversation('group', { [alice.id]: T2, [bob.id]: T1, [carol.id]: null }, 'Trip');
    expect(seenText(group, alice.id, T1)).toBe('Seen by Bob');
    const everyone = conversation(
      'group',
      { [alice.id]: T2, [bob.id]: T1, [carol.id]: T1 },
      'Trip',
    );
    expect(seenText(everyone, alice.id, T1)).toBe('Seen by everyone');
  });
});
