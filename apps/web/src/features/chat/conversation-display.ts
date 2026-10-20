import type {
  Conversation,
  ConversationMember,
  Message,
  MessageReaction,
  ReactionSummary,
  ReactionType,
  SystemLine,
  UserSummary,
} from '@beso/shared';
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

export function isAdmin(conversation: Conversation, userId: string): boolean {
  return conversation.members.some(
    (member) => member.user.id === userId && member.role === 'admin',
  );
}

/** "Alice", "Alice and Bob", "Alice, Bob and 2 others". */
function listNames(names: readonly string[]): string {
  const [first, second] = names;
  if (first === undefined) return 'someone';
  if (second === undefined) return first;
  if (names.length === 2) return `${first} and ${second}`;
  const rest = names.length - 2;
  return `${first}, ${second} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
}

/**
 * The sentence of a system line: "Alice added Bob", "Bob left", "You removed Carol",
 * "Alice renamed the group to “Trip”". People still in the conversation are called by their
 * current name; the others by the name stored with the line.
 */
export function systemLineText(line: SystemLine, conversation: Conversation, meId: string): string {
  const nameOf = (person: { id: string; name: string }, subject: boolean): string => {
    if (person.id === meId) return subject ? 'You' : 'you';
    return memberById(conversation, person.id)?.user.name ?? person.name;
  };
  const actor = nameOf(line.actor, true);
  const people = listNames(line.users.map((person) => nameOf(person, false)));
  switch (line.type) {
    case 'members_added':
      return `${actor} added ${people}`;
    case 'member_left':
      return `${actor} left the group`;
    case 'member_removed':
      return `${actor} removed ${people}`;
    case 'renamed':
      return `${actor} renamed the group to “${line.title ?? ''}”`;
    case 'group_created':
      return `${actor} created the group`;
    case 'admin_added':
      return `${actor} made ${people} an admin`;
    case 'admin_removed':
      return `${actor} removed ${people} as admin`;
    default:
      return '';
  }
}

/** What a message reads as in a list row or a notification; never empty. */
export function messagePreview(message: Message, conversation: Conversation, meId: string): string {
  if (message.deletedAt) return 'Message deleted';
  if (message.kind === 'system') {
    return message.system ? systemLineText(message.system, conversation, meId) : '';
  }
  return message.content || 'Picture';
}

/** Counts per type, the total and my own, from the plain list a message carries. */
export function reactionSummaryOf(
  reactions: readonly MessageReaction[],
  meId: string,
): ReactionSummary {
  const counts: Record<ReactionType, number> = { LIKE: 0, LOVE: 0, LAUGH: 0, WOW: 0, SAD: 0 };
  let mine: ReactionType | null = null;
  for (const reaction of reactions) {
    counts[reaction.type] += 1;
    if (reaction.userId === meId) mine = reaction.type;
  }
  return { counts, total: reactions.length, mine };
}
