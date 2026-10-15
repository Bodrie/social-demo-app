import {
  emailSchema,
  listUsersQuerySchema,
  updateProfileSchema,
  usernameSchema,
  websiteSchema,
} from './users.js';

describe('usernameSchema', () => {
  it('normalises to lowercase and trims', () => {
    expect(usernameSchema.parse('  Alice_01 ')).toBe('alice_01');
  });

  it('rejects spaces, symbols and short names', () => {
    for (const bad of ['al', 'alice smith', 'alice!', 'a'.repeat(31)]) {
      expect(usernameSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('emailSchema', () => {
  it('trims and lowercases before validating', () => {
    expect(emailSchema.parse('  Alice@Example.COM ')).toBe('alice@example.com');
  });

  it('rejects malformed addresses', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('accepts partial updates and explicit nulls', () => {
    expect(updateProfileSchema.parse({ bio: null, city: ' Sofia ' })).toEqual({
      bio: null,
      city: 'Sofia',
    });
  });

  it('rejects invalid websites and dangerous schemes', () => {
    expect(updateProfileSchema.safeParse({ website: 'not a url' }).success).toBe(false);
    expect(websiteSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(websiteSchema.safeParse('data:text/html,hi').success).toBe(false);
    expect(websiteSchema.parse(' https://example.com ')).toBe('https://example.com');
  });

  it('turns empty optional text into null', () => {
    expect(updateProfileSchema.parse({ bio: '', city: '  ', website: '' })).toEqual({
      bio: null,
      city: null,
      website: null,
    });
  });

  it('only accepts picture keys of the matching kind', () => {
    const avatar = 'avatar/01a13ed6-d3ec-71cb-b39f-fbc256a293b9.webp';
    expect(updateProfileSchema.safeParse({ avatarKey: avatar }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ coverKey: avatar }).success).toBe(false);
  });
});

describe('listUsersQuerySchema', () => {
  it('coerces and defaults query parameters', () => {
    expect(listUsersQuerySchema.parse({ limit: '10' })).toEqual({ limit: 10 });
    expect(listUsersQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(listUsersQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});
