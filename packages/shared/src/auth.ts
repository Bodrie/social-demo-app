import { z } from 'zod';
import { emailSchema, meResponseSchema, nameSchema, usernameSchema } from './users.js';

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128, 'At most 128 characters');

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  name: nameSchema,
  password: passwordSchema,
});
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterData = z.output<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginInput = z.input<typeof loginSchema>;
export type LoginData = z.output<typeof loginSchema>;

/** Returned by register, login, refresh and GET /auth/me. Tokens travel in httpOnly cookies. */
export const authResponseSchema = meResponseSchema;
export type AuthResponse = z.infer<typeof authResponseSchema>;
