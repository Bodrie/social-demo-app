import { type AccountExport, type DeleteAccountInput, accountExportSchema } from '@the-mesh/shared';
import { api } from './client';

/** Everything the account holds, for the member to keep (`accountExportSchema`). */
export const fetchAccountExport = (): Promise<AccountExport> =>
  api.get('/users/me/export', accountExportSchema);

/** Erases the account; the API clears the cookies, the caller ends the session. */
export const deleteAccount = (input: DeleteAccountInput): Promise<void> =>
  api.delete('/users/me', { body: input });
