import { PresenceService } from './presence.service.js';

const alice = { id: 'a', username: 'alice', name: 'Alice', avatarUrl: null };
const bob = { id: 'b', username: 'bob', name: 'Bob', avatarUrl: null };

describe('PresenceService', () => {
  it('reports one entry per user across several sockets', () => {
    const presence = new PresenceService();

    expect(presence.add(alice, 's1')).toBe(true);
    expect(presence.add(alice, 's2')).toBe(false);
    expect(presence.add(bob, 's3')).toBe(true);
    expect(presence.list().map((u) => u.id)).toEqual(['a', 'b']);

    expect(presence.remove('a', 's1')).toBe(false);
    expect(presence.isOnline('a')).toBe(true);
    expect(presence.remove('a', 's2')).toBe(true);
    expect(presence.isOnline('a')).toBe(false);
    expect(presence.remove('a', 'unknown')).toBe(false);
  });
});
