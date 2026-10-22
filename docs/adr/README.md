# Architecture Decision Records

Short records of decisions that shape the rebuild. The full reasoning and the alternatives live in
[`../REBUILD_PLAN.md`](../REBUILD_PLAN.md); each ADR links to the relevant section.

| # | Decision | Status |
|---|---|---|
| [0001](0001-monorepo-pnpm-turborepo.md) | pnpm workspace + Turborepo monorepo | Accepted |
| [0002](0002-backend-nestjs-prisma-postgresql.md) | NestJS + Prisma + PostgreSQL backend | Accepted |
| [0003](0003-auth-jwt-refresh-cookies.md) | Access JWT + rotating refresh token in httpOnly cookies | Accepted (amended by 0011) |
| [0004](0004-frontend-vite-react-tailwind.md) | Vite + React 19 + Tailwind/shadcn frontend | Accepted |
| [0005](0005-testing-vitest-playwright.md) | Vitest everywhere, Playwright for end-to-end | Accepted |
| [0006](0006-hosting-cloudflare-tunnel-pull-deploy.md) | Self-hosted box behind Cloudflare Tunnel, pull-based releases | Accepted (amended by 0011; release mechanics superseded by 0018) |
| [0007](0007-typescript-6-then-7.md) | TypeScript 6 now, 7 when tooling allows | Accepted |
| [0008](0008-linting-oxlint-prettier.md) | oxlint (type-aware) + Prettier | Accepted |
| [0009](0009-conversations-and-read-marks.md) | Conversations as records, read state per member | Accepted |
| [0010](0010-email-verification-and-password-reset.md) | Transactional email, verified addresses, password reset | Accepted (amended by 0011; amended 2026-10-20: email change and sessions) |
| [0011](0011-pre-release-hardening.md) | Pre-release hardening: ending sessions, verification links, mail limits, release gate | Accepted |
| [0012](0012-account-lifecycle.md) | Account lifecycle: JSON export of everything, deletion that erases (with conversation tidy-up and counter fixes); Turnstile bot check on registration; retention (unconfirmed accounts, tokens, abandoned uploads) by daily jobs | Accepted (amended 2026-10-20) |
| [0013](0013-text-entities.md) | Text entities: one shared parser for mentions, hashtags and links; entities stored at save time | Accepted |
| [0014](0014-search-in-postgres.md) | Post pages (`/p/:id`) and full-text search in PostgreSQL (generated tsvector, `websearch_to_tsquery`) | Accepted |
| [0015](0015-notifications.md) | Notifications: rows written from domain events, one per (recipient, type, actor, subject), read marks, pushed over the chat socket | Accepted |
| [0016](0016-moderation.md) | Moderation: blocks that cut both ways (one `VisibilityService` for every list), mutes for oneself, reports by target id; admins from `ADMIN_EMAILS`, the role in the token, a reports queue with suspension and an audit trail | Accepted |
| [0017](0017-feed-items.md) | Feed items: plain reposts as pointers, quotes as posts, the feed a union with one row per post at its newest occurrence | Accepted |
| [0018](0018-migrations-image-and-updater.md) | Migrations in a one-shot `beso-migrate` image (the API image loses the Prisma CLI); `update.sh` pulls only our images, all or nothing, and applies only what changed, migrating on its own first | Accepted |
| [0019](0019-response-contracts.md) | Every JSON response parsed with its shared schema (`@ZodResponse` + the global serializer; a mismatch is a logged 500); OpenAPI 3.1 with response schemas | Accepted |

Template: Context → Decision → Consequences. Supersede rather than edit once a decision has shipped.
