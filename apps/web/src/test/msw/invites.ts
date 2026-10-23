import { HttpResponse, http } from 'msw/http';
import { API, apiError, unauthorized } from './auth';
import { mockDb } from './db';

const linkFor = (code: string) => ({ code, url: `http://localhost/join/${code}` });
let renewals = 0;

export const inviteHandlers = [
  http.get(`${API}/invites/me`, () => {
    const me = mockDb.user;
    if (!me) return unauthorized();
    const existing = [...mockDb.inviteCodes].find(([, owner]) => owner === me.id)?.[0];
    const code = existing ?? `invite-${me.username}`;
    mockDb.inviteCodes.set(code, me.id);
    return HttpResponse.json(linkFor(code));
  }),
  http.post(`${API}/invites/me/renew`, () => {
    const me = mockDb.user;
    if (!me) return unauthorized();
    for (const [code, owner] of mockDb.inviteCodes) {
      if (owner === me.id) mockDb.inviteCodes.delete(code);
    }
    renewals += 1;
    const code = `renewed-${me.username}-${renewals}`;
    mockDb.inviteCodes.set(code, me.id);
    return HttpResponse.json(linkFor(code));
  }),
  http.get(`${API}/invites/:code`, ({ params }) => {
    const owner = mockDb.users.find(
      (user) => user.id === mockDb.inviteCodes.get(String(params.code)),
    );
    if (!owner) return apiError(404, 'NOT_FOUND', 'This invite link does not work any more');
    return HttpResponse.json({
      inviter: {
        id: owner.id,
        username: owner.username,
        name: owner.name,
        avatarUrl: owner.avatarUrl,
        ring: owner.ring,
      },
    });
  }),
];
