import { z } from 'zod';
import { userSummarySchema } from './users.js';

/** The code of a member's personal invite link, `/join/<code>` (F1): base64url, unguessable. */
export const inviteCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{8,24}$/, 'Not an invite code');

/** `GET /invites/me` and `POST /invites/me/renew`: the member's own link. */
export const inviteSchema = z.object({ code: z.string(), url: z.url() });
export type Invite = z.infer<typeof inviteSchema>;

/** `GET /invites/:code`: who invites, for the join page (no session needed). */
export const inviteLookupSchema = z.object({ inviter: userSummarySchema });
export type InviteLookup = z.infer<typeof inviteLookupSchema>;
