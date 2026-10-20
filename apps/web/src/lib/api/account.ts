import {
  type AccountExport,
  type ChangeEmailInput,
  type ConfirmEmailChangeInput,
  type DeleteAccountInput,
  type SessionList,
  accountExportSchema,
  confirmEmailChangeResponseSchema,
  meResponseSchema,
  sessionListSchema,
} from '@beso/shared';
import { api } from './client';

// Account-level calls that only Settings (and the confirmation page) need; kept apart from
// `auth.ts`, which the shell loads up front.

/** Everything the account holds, for the member to keep (`accountExportSchema`). */
export const fetchAccountExport = (): Promise<AccountExport> =>
  api.get('/users/me/export', accountExportSchema);

/** Erases the account; the API clears the cookies, the caller ends the session. */
export const deleteAccount = (input: DeleteAccountInput): Promise<void> =>
  api.delete('/users/me', { body: input });

/** Settings → Email: asks for the change; the new address gets the link, the old one a notice. */
export const requestEmailChange = (input: ChangeEmailInput) =>
  api.post('/auth/email', input, { schema: meResponseSchema });

export const resendEmailChange = (): Promise<void> => api.post('/auth/email/resend');

export const cancelEmailChange = () => api.delete('/auth/email', { schema: meResponseSchema });

/** The mailed link: makes the pending address the account's. Signed in or not. */
export const confirmEmailChange = (input: ConfirmEmailChangeInput) =>
  api.post('/auth/email/confirm', input, {
    schema: confirmEmailChangeResponseSchema,
    retryOnUnauthorized: false,
  });

export const fetchSessions = (signal?: AbortSignal): Promise<SessionList> =>
  api.get('/auth/sessions', sessionListSchema, { signal });

/** Ends one other device's session; its access token runs out within fifteen minutes. */
export const endSession = (id: string): Promise<void> => api.delete(`/auth/sessions/${id}`);
