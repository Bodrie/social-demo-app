# Architecture Decision Records

Short records of decisions that shape the rebuild. The full reasoning and the alternatives live in
[`../REBUILD_PLAN.md`](../REBUILD_PLAN.md); each ADR links to the relevant section.

| # | Decision | Status |
|---|---|---|
| [0001](0001-monorepo-pnpm-turborepo.md) | pnpm workspace + Turborepo monorepo | Accepted |
| [0002](0002-backend-nestjs-prisma-postgresql.md) | NestJS + Prisma + PostgreSQL backend | Accepted |
| [0003](0003-auth-jwt-refresh-cookies.md) | Access JWT + rotating refresh token in httpOnly cookies | Accepted |
| [0004](0004-frontend-vite-react-tailwind.md) | Vite + React 19 + Tailwind/shadcn frontend | Accepted |
| [0005](0005-testing-vitest-playwright.md) | Vitest everywhere, Playwright for end-to-end | Accepted |
| [0006](0006-hosting-cloudflare-tunnel-pull-deploy.md) | Self-hosted box behind Cloudflare Tunnel, pull-based releases | Accepted |
| [0007](0007-typescript-6-then-7.md) | TypeScript 6 now, 7 when tooling allows | Accepted |
| [0008](0008-linting-oxlint-prettier.md) | oxlint (type-aware) + Prettier | Accepted |

Template: Context → Decision → Consequences. Supersede rather than edit once a decision has shipped.
