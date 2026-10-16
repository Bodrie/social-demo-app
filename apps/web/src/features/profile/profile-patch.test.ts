import { makeUser } from '@/test/fixtures';
import { buildProfilePatch } from './profile-patch';

const me = makeUser({ bio: 'Hi', city: 'Sofia', website: null, avatarUrl: 'http://x/a.webp' });
const unchanged = {
  name: me.name,
  username: me.username,
  bio: 'Hi',
  city: 'Sofia',
  website: null,
};
const keep = { avatar: undefined, cover: undefined };

describe('buildProfilePatch', () => {
  it('returns null when nothing changed', () => {
    expect(buildProfilePatch(me, unchanged, keep)).toBeNull();
  });

  it('sends only the changed fields, including clearing optional text', () => {
    expect(buildProfilePatch(me, { ...unchanged, name: 'Alice A.', bio: null }, keep)).toEqual({
      name: 'Alice A.',
      bio: null,
    });
  });

  it('maps picture changes to keys', () => {
    expect(buildProfilePatch(me, unchanged, { avatar: 'avatar/x.webp', cover: null })).toEqual({
      avatarKey: 'avatar/x.webp',
      coverKey: null,
    });
  });
});
