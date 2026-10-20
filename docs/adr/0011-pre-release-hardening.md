# 0011 – Pre-release hardening: ending sessions, verification links, mail limits, release gate

Date: 2026-10-16 · Status: Accepted · Amends: ADR 0003, ADR 0006, ADR 0010 · Source: `docs/PRE_RELEASE_REVIEW_2026-10-16.md` (H1, M1, M2, M3, M7)

## Context

The review before the first public release found that some decisions recorded earlier fail
in practice:

- Refresh tokens ended by a password change, a reset or "sign out everywhere" were marked
  `revoked_at`, exactly like rotated ones. Presenting one later looked like token theft and
  revoked every session, including the one that had just changed the password; anyone holding
  an old cookie could keep logging the owner out for the seven days the rows were kept.
- `POST /auth/verify-email` signed in whichever browser posted the token (ADR 0010). Someone
  who registers an address they do not own can then send its owner a genuine link that signs
  the owner into the stranger's account (account pre-hijacking), or sign a victim into their
  own account (login CSRF).
- The email address could be changed through `PATCH /users/me` without confirmation; the
  account stayed verified and password resets went to the new, unproven address.
- `forgot-password` mailed on every request (10/min per address and account) and each new
  link voided the previous one, so a stranger could flood an inbox, burn the provider's quota
  and keep voiding the link the owner was about to open.
- Every push to `main` published `latest`, which the box deploys within five minutes, whether
  or not CI had passed.

## Decision

- **`revoked_at` means "rotated" and nothing else.** Every other way a session ends (logout,
  password change, reset, sign out everywhere, the theft response itself) deletes the refresh
  token rows, so a token from an ended session is merely invalid. A password change deletes
  every row of the user except the caller's current one, rotated rows included.
- **A verification link signs in only a browser that already holds a session of that
  account** (the refresh cookie is checked; it then gets a new access token with `ev: true`,
  the refresh token stays). Any other browser gets `{ user: null }`: the address is confirmed,
  the page asks to sign in. Reset links still sign in (the person just chose the password).
- **The address cannot be changed until the confirm-the-new-address flow exists**
  (`ROADMAP.md` §2, "Email and sessions in Settings"). `email` is not part of the profile
  patch; the profile dialog shows it read-only.
- **Every password change or reset mails a notice** to the account's address with a link to
  `/forgot-password`, so a change the owner did not make does not go unnoticed.
- **Mail limits per account**, whoever asks and from wherever (`EMAIL_TOKEN_POLICY`):
  reset mails at most one per minute and five per hour; confirmation mails five per hour.
  Past the limit `forgot-password` still answers 204 and sends nothing; `resend` answers 429.
  **Reset links are no longer voided by a newer one**: each stays good until it expires or one
  of them is used, which voids the rest (a password change voids them too). Confirmation
  links keep the previous rule (the newest one replaces the older ones).
- **Images are published only after CI passed.** `docker.yml` is a reusable workflow that
  `ci.yml` calls after the checks, the integration tests and the end-to-end tests; pull
  requests still build the images without pushing. `latest` therefore means "the newest
  `main` that passed everything", which is what the box follows unless `TAG` pins a release.

## Consequences

- A leaked refresh cookie stops being useful the moment its session is ended, and can no
  longer be replayed to end the owner's other sessions.
- Opening the confirmation mail on another device confirms the address but needs a sign-in
  there; the original tab notices the confirmation by itself (it re-checks `/auth/me` when it
  is looked at again and every 15 s while waiting) and renews its access token.
- Changing the email address is unavailable until the confirmation flow is built.
- A flood against one account costs at most five reset mails per hour, and the owner's links
  keep working through it.
- A red CI run on `main` no longer reaches the box; a merge takes as long as CI to deploy.
