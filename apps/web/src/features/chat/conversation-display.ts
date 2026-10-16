import type { Conversation, ConversationMember, UserSummary } from '@the-mesh/shared';
import { firstName } from '@/lib/names';

export function otherMembers(conversation: Conversation, meId: string): ConversationMember[] {
  return conversation.members.filter((member) => member.user.id !== meId);
}

/** The other person in a direct conversation; null for groups. */
export function directPeer(conversation: Conversation, meId: string): UserSummary | null {
  if (conversation.kind !== 'direct') return null;
  return otherMembers(conversation, meId)[0]?.user ?? null;
}

export function conversationName(conversation: Conversation, meId: string): string {
  if (conversation.kind === 'group') return conversation.title ?? 'Group';
  return directPeer(conversation, meId)?.name ?? 'Conversation';
}

export function memberById(
  conversation: Conversation,
  userId: string,
): ConversationMember | undefined {
  return conversation.members.find((member) => member.user.id === userId);
}

/** "Bob is typing…", "Bob and Carol are typing…", "Bob, Carol and 2 others are typing…". */
export function typingText(names: readonly string[]): string | null {
  const [first, second] = names;
  if (first === undefined) return null;
  if (second === undefined) return `${first} is typing…`;
  if (names.length === 2) return `${first} and ${second} are typing…`;
  const rest = names.length - 2;
  return `${first}, ${second} and ${rest} ${rest === 1 ? 'other' : 'others'} are typing…`;
}

/** The others who have read something I sent at `createdAt` (ISO strings compare as text). */
export function readBy(
  conversation: Conversation,
  meId: string,
  createdAt: string,
): ConversationMember[] {
  return otherMembers(conversation, meId).filter(
    (member) => member.lastReadAt !== null && member.lastReadAt >= createdAt,
  );
}

/** "Seen" in a direct thread; "Seen by Bob", "Seen by everyone" in a group; null when nobody has. */
export function seenText(
  conversation: Conversation,
  meId: string,
  createdAt: string,
): string | null {
  const seen = readBy(conversation, meId, createdAt);
  if (seen.length === 0) return null;
  if (conversation.kind === 'direct') return 'Seen';
  if (seen.length === otherMembers(conversation, meId).length) return 'Seen by everyone';
  const names = seen.map((member) => firstName(member.user.name));
  const [first, second] = names;
  if (second === undefined) return `Seen by ${first}`;
  if (names.length === 2) return `Seen by ${first} and ${second}`;
  return `Seen by ${first}, ${second} and ${names.length - 2} more`;
}
