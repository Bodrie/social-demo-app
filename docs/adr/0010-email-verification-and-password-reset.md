# 0010 – Transactional email, verified addresses, password reset

Date: 2026-10-16 · Status: Accepted · Plan: §4.10 (slice 9)

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
- Changing the email address, re-sending from Settings and admin-side verification are not built; backlog.
- Deliverability depends on the DNS records at Cloudflare being correct (runbook §2.6) and on the provider's reputation; the subdomain isolates the app from anything else sent from `bodrie.dev`.
