# 0001 – pnpm workspace + Turborepo monorepo

Date: 2026-10-15 · Status: Accepted · Plan: §2.1, §2.13, D21, D22

## Context
The old repo had two unrelated `package.json` trees (`api/`, `client/`) with no shared types and no CI.
The rewrite needs shared validation schemas between API and web, one install, one lockfile, one CI.

## Decision
- pnpm workspaces: `apps/api`, `apps/web`, `packages/shared`, `packages/config`. Versions pinned exactly, aligned through the pnpm `catalog`.
- Turborepo orchestrates `build`, `typecheck`, `lint`, `test`, `dev` in dependency order with content-hash caching (local and in GitHub Actions).
- Node 24 LTS pinned in `.nvmrc` and `engines`; pnpm pinned through `packageManager`.
- Bun was considered and rejected for v2.0 (fine as installer, unproven as Nest runtime, not needed).

## Consequences
- Strict, non-flat `node_modules`: every package declares what it imports.
- `packages/shared` must be built before consumers; `turbo dev` builds it once, then watches.
- One extra config file (`turbo.json`); CI skips unchanged packages.
