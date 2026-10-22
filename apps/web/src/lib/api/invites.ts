import { type Invite, type InviteLookup, inviteLookupSchema, inviteSchema } from '@beso/shared';
import { api } from './client';

export const fetchMyInvite = (signal?: AbortSignal): Promise<Invite> =>
  api.get('/invites/me', inviteSchema, { signal });

export const renewInvite = (): Promise<Invite> =>
  api.post('/invites/me/renew', undefined, { schema: inviteSchema });

/** For the join page: anyone may ask, signed in or not. */
export const lookupInvite = (code: string, signal?: AbortSignal): Promise<InviteLookup> =>
  api.get(`/invites/${encodeURIComponent(code)}`, inviteLookupSchema, {
    signal,
    retryOnUnauthorized: false,
  });
