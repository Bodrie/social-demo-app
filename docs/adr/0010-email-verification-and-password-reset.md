# 0010 – Transactional email, verified addresses, password reset

Date: 2026-10-16 · Status: Accepted, amended 2026-10-20 (email change and sessions, plan D1) · Plan: §4.10 (slice 9)

## Context

Until v2.1 an account was usable the moment it was registered and a forgotten password was final. Both need email, and the box that runs the app has a dynamic residential IP: it cannot deliver mail itself (port 25 blocked, no reputation, no reverse DNS). The public address is `social.bodrie.dev` (ADR 0006 hosting; runbook §2).

## Decision

- **Mail leaves through a provider over authenticated SMTP submission**, via nodemailer and one `SMTP_URL`. Resend is the provider in production (`smtps://resend:<api key>@smtp.resend.com:465`, domain `social.bodrie.dev` verified with DKIM, return-path and DMARC records in Cloudflare DNS), but nothing in the code knows that: switching providers is an env change. `EMAIL_FROM` is `The Mesh <noreply@social.bodrie.dev>`.
- **Outside production the transport is an outbox**: every message is a JSON file in `EMAIL_OUTBOX_DIR`. That is the developer's inbox and what the integration and Playwright tests read to follow links. Production refuses the outbox transport and requires `SMTP_URL`, `EMAIL_FROM` and `WEB_URL` explicitly, like the other unsafe defaults.
- **Links carry opaque single-use tokens** (`email_tokens`: 256 random bits, only the SHA-256 stored, kind `verify_email` 24 h or `password_reset` 1 h, `used_at`). Issuing a new token voids the older ones of the same kind; spending one is an atomic claim; a password change voids outstanding reset links. Every failure is the same 400 so nothing about accounts leaks.
- **The app is closed until the address is confirmed.** The access token carries `ev` (email verified); the `AuthGuard` answers 403 to `ev: false` on every route except those marked `@AllowUnverified()` (`GET /auth/me`, `POST /auth/verify-email/resend`, `POST /auth/logout-all`; `logout` is public anyway) and the socket handshake refuses such tokens. The web holds an unverified session on `/verify-email` (the waiting room with a resend button and a sign-out) and keeps it off every other page. Tokens signed before this change carry no `ev` and are treated as verified: the migration marked every existing account verified (`email_verified_at = created_at`).
- **Following the mailed link signs that browser in.** `POST /auth/verify-email` and `POST /auth/reset-password` behave like login (cookies + `{ user }`): the token proves control of the inbox, so a second sign-in step would add friction without adding safety. A reset also counts the address as verified and ends every other session (`revokeAll`, which cuts open sockets).
- **Forgot-password never says whether the address exists**: always 204, the mail is sent without being awaited so timing does not tell either, and the credential throttlers (per account, per address) apply.
- The seed marks the demo accounts verified; the Playwright register flow follows the real link from the outbox.

## Consequences

- Registration now takes an inbox; local development needs none (open the JSON file in `apps/api/outbox`).
- Changing the email address and a list of sessions came with the amendment below; an admin view of unverified accounts is not built (backlog).
- Deliverability depends on the DNS records at Cloudflare being correct (runbook §2.6) and on the provider's reputation; the subdomain isolates the app from anything else sent from `bodrie.dev`.

## Amendment 2026-10-20: email change and sessions (plan D1)

### Context

Since the pre-release review (M1) the address was read-only: a mistyped address locked a new member in the waiting room with no way out but a new account, and a member who lost a mailbox could not move. The refresh-token rows have recorded user agent and IP since v2, but nobody could see them, and "sign out everywhere" was the only way to end a session elsewhere.

### Decision

- **The new address is confirmed before it replaces the old one.** `POST /auth/email { newEmail, password }` (open to unverified sessions, 5 a minute) checks the password and that the address is free, stores it in `users.pending_email` and mails a `change_email` link (24 h; only the newest one works; five an hour and no pause, since the member just proved the password and a mistyped address is corrected at once) to the **new** address, plus a notice to the old one. `POST /auth/email/resend` (3 an hour) mails the link again; `DELETE /auth/email` drops the pending address and voids its links. `POST /auth/email/confirm { token }` (public, 10 a minute) is the swap: the address is checked again (taken meanwhile → 409 and the pending change is dropped), `email_verified_at` is set because the link proved the new inbox, and the old address gets an "address changed" notice. The link answers `{ email }` and signs nobody in; the member's open sessions stay. Every "me" response carries `pendingEmail`.
- **Settings → Email** (`features/settings/email-card.tsx`) owns the change: the form, then the pending state with "Send the email again" and "Cancel the change". The waiting room (`/verify-email`) offers the same form ("Wrong address? Change it"), which is how a mistyped address is fixed before the account ever opens; a confirmed change opens the account from there. The profile dialog keeps the address read-only and points to Settings; `/confirm-email?token=` is where the link lands (success, or "this link did not work" with the way back).
- **Sessions are the live refresh tokens.** `GET /auth/sessions` lists the rows of the member that are neither revoked nor expired, newest activity first, each as `{ id, browser, os, ip, createdAt, lastUsedAt, current }`: browser and system are read from the stored user agent by `auth/user-agent.ts` (the common names, `null` when unsure; `Headless Chrome` is named as such), the IP is masked (`203.0.113.x`, an IPv6 cut after four groups: enough to tell two places apart, not to find one), `current` is the row the caller's refresh cookie points at. A rotation (`issueWith`) carries the chain's `createdAt` along and stamps `last_used_at` (new column), so a session keeps its start and shows when it was last active even though the row's id changes with every rotation. `DELETE /auth/sessions/:id` deletes that row (404 for a row that is not the member's); the device's access token runs out within fifteen minutes, as for a password change, and nothing disconnects its socket.
- **Settings → Sessions** (`features/settings/sessions-list.tsx`) replaces the lone "Sign out everywhere" button with the list ("Chrome on Windows · 203.0.113.x · signed in … · last active …", "This device" on the caller's row, "Sign out <device>" on the others) and keeps the button below it.

### Consequences

- A member can repair a mistyped address and move to a new mailbox without help; the notice to the old address is the only alarm when a signed-in session is misused (the password is required, but a notice cannot be undone from the mail: a revert link is backlog).
- Precise IPs are still stored with the refresh tokens as before (and leave with them); only masked ones are shown.
- The expired-token reaper (ADR 0012 amendment) covers the new kind; `pending_email` is not unique, so two members may ask for the same address and the second confirmation loses.
- Settings tests must seed `mockDb.sessions`; Playwright's Desktop Chrome device sees itself as "Chrome on Windows".
