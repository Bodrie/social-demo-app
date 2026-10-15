import { loginSchema, registerSchema } from './auth.js';

describe('registerSchema', () => {
  it('normalises email and username', () => {
    const data = registerSchema.parse({
      email: ' Bob@Example.com ',
      username: 'Bob_1',
      name: ' Bob ',
      password: 'Password123!',
    });

    expect(data).toEqual({
      email: 'bob@example.com',
      username: 'bob_1',
      name: 'Bob',
      password: 'Password123!',
    });
  });

  it('reports every invalid field', () => {
    const result = registerSchema.safeParse({
      email: 'x',
      username: 'a',
      name: '',
      password: 'short',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(new Set(result.error.issues.map((issue) => issue.path[0]))).toEqual(
        new Set(['email', 'username', 'name', 'password']),
      );
    }
  });
});

describe('loginSchema', () => {
  it('requires a password but does not enforce the password policy', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });
});
