import { z } from 'zod';
import {
  emailSchema,
  meResponseSchema,
  nameSchema,
  userPrivateSchema,
  usernameSchema,
} from './users.js';

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128, 'At most 128 characters');

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  name: nameSchema,
  password: passwordSchema,
  /** The bot-check token (Cloudflare Turnstile); required only where the API has a secret. */
  captchaToken: z.string().max(2048).optional(),
});
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterData = z.output<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginInput = z.input<typeof loginSchema>;
export type LoginData = z.output<typeof loginSchema>;

/** Change the own password; every other session is signed out, the current one stays. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(128),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'Choose a password you have not used just now',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type ChangePasswordData = z.output<typeof changePasswordSchema>;

/** Opaque single-use tokens from the links we mail (verify address, reset password). */
const emailTokenSchema = z.string().trim().min(1, 'The link is incomplete').max(200);

export const verifyEmailSchema = z.object({ token: emailTokenSchema });
export type VerifyEmailInput = z.input<typeof verifyEmailSchema>;

/**
 * The address is confirmed either way. `user` is set only when this browser already held a
 * session of that account, which then continues verified; null means "now sign in". The link
 * alone never signs a browser in: whoever registered the address could have planted it.
 */
export const verifyEmailResponseSchema = z.object({ user: userPrivateSchema.nullable() });
export type VerifyEmailResponse = z.infer<typeof verifyEmailResponseSchema>;

/** Always answered the same way, whether or not the address belongs to an account. */
export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: emailTokenSchema,
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
export type ResetPasswordData = z.output<typeof resetPasswordSchema>;

/** The reset form asks twice; only `token` and `newPassword` travel to the API. */
export const resetPasswordFormSchema = resetPasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'The passwords do not match',
    path: ['confirmPassword'],
  });
export type ResetPasswordFormInput = z.input<typeof resetPasswordFormSchema>;

/** Returned by register, login, refresh and GET /auth/me. Tokens travel in httpOnly cookies. */
export const authResponseSchema = meResponseSchema;
export type AuthResponse = z.infer<typeof authResponseSchema>;

// --- email change and sessions (ADR 0010 amendment, D1) ------------------------

/** Settings → Email: the new address waits for the link mailed to it; the password proves the owner asked. */
export const changeEmailSchema = z.object({
  newEmail: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});
export type ChangeEmailInput = z.input<typeof changeEmailSchema>;
export type ChangeEmailData = z.output<typeof changeEmailSchema>;

export const confirmEmailChangeSchema = z.object({ token: emailTokenSchema });
export type ConfirmEmailChangeInput = z.input<typeof confirmEmailChangeSchema>;

/** The address the account answers to from now on. */
export const confirmEmailChangeResponseSchema = z.object({ email: z.string() });
export type ConfirmEmailChangeResponse = z.infer<typeof confirmEmailChangeResponseSchema>;

/** One signed-in device, as the sessions list shows it; `current` is the caller's own. */
export const sessionSchema = z.object({
  id: z.uuid(),
  browser: z.string().nullable(),
  os: z.string().nullable(),
  /** Masked: the last part is hidden. */
  ip: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime(),
  current: z.boolean(),
});
export type Session = z.infer<typeof sessionSchema>;

export const sessionListSchema = z.object({
  items: z.array(sessionSchema),
  nextCursor: z.string().nullable(),
});
export type SessionList = z.infer<typeof sessionListSchema>;
