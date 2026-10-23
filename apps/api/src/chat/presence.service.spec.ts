import { PresenceService } from './presence.service.js';

const alice = { id: 'a', username: 'alice', name: 'Alice', avatarUrl: null, ring: null };
const bob = { id: 'b', username: 'bob', name: 'Bob', avatarUrl: null, ring: null };

describe('PresenceService', () => {
  it('reports one entry per user across several sockets', () => {
    const presence = new PresenceService();

    expect(presence.add(alice, 's1')).toBe(true);
    expect(presence.add(alice, 's2')).toBe(false);
    expect(presence.add(bob, 's3')).toBe(true);
    expect(presence.list().map((u) => u.id)).toEqual(['a', 'b']);

    expect(presence.socketCount('a')).toBe(2);
    expect(presence.remove('a', 's1')).toBe(false);
    expect(presence.socketCount('a')).toBe(1);
    expect(presence.remove('a', 's2')).toBe(true);
    expect(presence.socketCount('a')).toBe(0);
    expect(presence.remove('a', 'unknown')).toBe(false);
  });

  it('refreshes the cached profile of an online user only', () => {
    const presence = new PresenceService();
    presence.add(alice, 's1');
    expect(presence.refresh({ ...alice, name: 'Alicia' })).toBe(true);
    expect(presence.list()[0]?.name).toBe('Alicia');
    expect(presence.refresh(bob)).toBe(false);
  });
});
