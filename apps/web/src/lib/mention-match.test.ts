import { rankMention, sortMentionMatches } from './mention-match';

const users = [
  { username: 'bo_lemke86', name: 'Bo Lemke' },
  { username: 'bob', name: 'Bob Brown' },
  { username: 'abbott', name: 'Deborah Abbott' },
  { username: 'alice', name: 'Alice Anderson' },
];
const names = (query: string) => sortMentionMatches(users, query).map((user) => user.username);

describe('sortMentionMatches', () => {
  it('puts the exact username first, then prefixes, then name words, then the rest', () => {
    expect(names('bob')).toEqual(['bob']);
    expect(names('bo')).toEqual(['bo_lemke86', 'bob', 'abbott']);
    expect(names('Br')).toEqual(['bob']);
    expect(names('ali')).toEqual(['alice']);
  });

  it('keeps the server order for an empty query and drops non-matches', () => {
    expect(names('')).toEqual(['bo_lemke86', 'bob', 'abbott', 'alice']);
    expect(names('zzz')).toEqual([]);
    expect(rankMention({ username: 'alice', name: 'Alice' }, 'bob')).toBeNull();
  });
});
