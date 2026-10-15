# 0003 – Access JWT + rotating refresh token in httpOnly cookies

Date: 2026-10-15 · Status: Accepted · Plan: §2.5, D5, D6

## Context
The old API signed a JWT with no expiry, stored the user object in `localStorage`, left most write endpoints unauthenticated and returned password hashes.

## Decision
- Short-lived access JWT (~15 min) and a rotating refresh token (~7 days, hashed in DB, reuse detection), both `httpOnly; Secure; SameSite=Lax` cookies.
- `GET /auth/me` for session hydration; argon2id password hashing; `@nestjs/throttler` on auth routes.
- Same auth for the WebSocket handshake. No user data trusted from the client.
- Email verification and password reset are out of v2.0 (no mail provider yet).

## Consequences
- Web and API share an origin behind the proxy, so CORS is a dev-only concern.
- A `RefreshToken` table and a logout-everywhere path exist from day one.
