import { emailSchema, listUsersQuerySchema, updateProfileSchema, usernameSchema } from './users.js';

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

  it('rejects invalid websites', () => {
    const result = updateProfileSchema.safeParse({ website: 'not a url' });
    expect(result.success).toBe(false);
  });
});

describe('listUsersQuerySchema', () => {
  it('coerces and defaults query parameters', () => {
    expect(listUsersQuerySchema.parse({ limit: '10' })).toEqual({ limit: 10 });
    expect(listUsersQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(listUsersQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});
