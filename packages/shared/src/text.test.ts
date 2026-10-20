import { extractEntities, hashtagSchema, tokenize } from './text.js';

const types = (text: string) => tokenize(text).map((token) => `${token.type}:${token.raw}`);

describe('tokenize', () => {
  it('finds mentions, hashtags and links between plain runs', () => {
    expect(types('Hi @Alice, see #Weekend at https://example.com/a?b=1.')).toEqual([
      'text:Hi ',
      'mention:@Alice',
      'text:, see ',
      'hashtag:#Weekend',
      'text: at ',
      'url:https://example.com/a?b=1',
      'text:.',
    ]);
  });

  it('round-trips the text through raw', () => {
    const text = 'a @bob b #tag c http://x.y/z) d';
    expect(
      tokenize(text)
        .map((token) => token.raw)
        .join(''),
    ).toBe(text);
  });

  it('lower-cases the value but keeps the raw text', () => {
    const [mention, , hashtag] = tokenize('@Bob_1 #Весна');
    expect(mention).toEqual({ type: 'mention', raw: '@Bob_1', value: 'bob_1' });
    expect(hashtag).toEqual({ type: 'hashtag', raw: '#Весна', value: 'весна' });
  });

  it('needs a word boundary before @ and #', () => {
    expect(types('mail@example.com')).toEqual(['text:mail@example.com']);
    expect(types('C#')).toEqual(['text:C#']);
    expect(types('foo#bar @@alice ##tag')).toEqual(['text:foo#bar @@alice ##tag']);
    expect(types('(@alice) [#tag] "@bob"')).toEqual([
      'text:(',
      'mention:@alice',
      'text:) [',
      'hashtag:#tag',
      'text:] "',
      'mention:@bob',
      'text:"',
    ]);
  });

  it('applies the username rules to mentions', () => {
    expect(types('@ab is too short')).toEqual(['text:@ab is too short']);
    expect(types(`@${'a'.repeat(31)}`)).toEqual([`text:@${'a'.repeat(31)}`]);
    expect(types(`@${'a'.repeat(30)}`)).toEqual([`mention:@${'a'.repeat(30)}`]);
    expect(types('@élodie')).toEqual(['text:@élodie']);
    expect(types("@alice's post")).toEqual(['mention:@alice', "text:'s post"]);
  });

  it('applies the tag rules to hashtags', () => {
    expect(types('#1 #2026')).toEqual(['text:#1 #2026']);
    expect(types('#a1 #_x #2026goals')).toEqual([
      'hashtag:#a1',
      'text: ',
      'hashtag:#_x',
      'text: ',
      'hashtag:#2026goals',
    ]);
    expect(types(`#${'a'.repeat(51)}`)).toEqual([`text:#${'a'.repeat(51)}`]);
    expect(types('#tag. #tag, #tag!')).toEqual([
      'hashtag:#tag',
      'text:. ',
      'hashtag:#tag',
      'text:, ',
      'hashtag:#tag',
      'text:!',
    ]);
  });

  it('keeps trailing punctuation and unbalanced brackets out of links', () => {
    expect(types('see https://example.com.')).toEqual([
      'text:see ',
      'url:https://example.com',
      'text:.',
    ]);
    expect(types('(https://example.com/a)')).toEqual([
      'text:(',
      'url:https://example.com/a',
      'text:)',
    ]);
    expect(types('https://en.wikipedia.org/wiki/Foo_(bar)')).toEqual([
      'url:https://en.wikipedia.org/wiki/Foo_(bar)',
    ]);
    expect(types('https://example.com/#frag?x=@alice')).toEqual([
      'url:https://example.com/#frag?x=@alice',
    ]);
  });

  it('only links http and https', () => {
    expect(types('ftp://x.y www.example.com example.com')).toEqual([
      'text:ftp://x.y www.example.com example.com',
    ]);
  });

  it('returns an empty list for an empty text', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('extractEntities', () => {
  it('returns distinct lower-cased entities in order of appearance', () => {
    expect(extractEntities('#B @Alice #a @alice #b @bob')).toEqual({
      mentions: ['alice', 'bob'],
      hashtags: ['b', 'a'],
    });
  });

  it('is empty for plain text', () => {
    expect(extractEntities('nothing to see')).toEqual({ mentions: [], hashtags: [] });
  });
});

describe('hashtagSchema', () => {
  it('normalises a tag from a URL', () => {
    expect(hashtagSchema.parse(' #Weekend ')).toBe('weekend');
    expect(hashtagSchema.parse('Весна')).toBe('весна');
  });

  it('refuses what the parser would not produce', () => {
    expect(hashtagSchema.safeParse('').success).toBe(false);
    expect(hashtagSchema.safeParse('2026').success).toBe(false);
    expect(hashtagSchema.safeParse('a b').success).toBe(false);
    expect(hashtagSchema.safeParse('a'.repeat(51)).success).toBe(false);
  });
});
