# 0003 – Access JWT + rotating refresh token in httpOnly cookies

Date: 2026-10-15 · Status: Accepted · Plan: §2.5, D5, D6

## Context
The old API signed a JWT with no expiry, stored the user object in `localStorage`, left most write endpoints unauthenticated and returned password hashes.

## Decision
- Short-lived access JWT (~15 min) and a rotating refresh token (~7 days, hashed in DB, reuse detection), both `httpOnly; Secure; SameSite=Lax` cookies.
- `GET /auth/me` for session hydration; argon2id password hashing; `@nestjs/throttler` on auth routes.
- Same auth for the WebSocket handshake. No user data trusted from the client. The access token is also accepted as a `Bearer` header for API clients and Swagger.
- Refresh tokens are single-use: rotation claims the old row atomically; presenting an already-rotated token revokes every session of the user. `POST /auth/logout-all` does the same on demand.
- Login answers unknown emails and wrong passwords identically and always runs an argon2 verification, so timing does not reveal whether an account exists.
- Email verification and password reset are out of v2.0 (no mail provider yet).

## Consequences
- Web and API share an origin behind the proxy, so CORS is a dev-only concern.
- A `RefreshToken` table and a logout-everywhere path exist from day one.
