# 0005 – Vitest everywhere, Playwright for end-to-end

Date: 2026-10-15 · Status: Accepted (amends D13) · Plan: §2.8

## Context
The plan proposed Jest for the API because it was Nest's default. During phase 1 the Nest 12 CLI turned out to scaffold Vitest (with Vite 8's transform handling decorators and metadata), and create-vite scaffolds Vitest-compatible projects. One runner across the monorepo is simpler and avoids the TypeScript compiler API entirely, which keeps the later TS 7 bump trivial (ADR 0007).

## Decision
- Unit tests: Vitest in `apps/api`, `apps/web` (jsdom + React Testing Library + MSW) and `packages/shared`.
- API integration tests: Vitest + supertest against the booted Nest app and a real PostgreSQL (Testcontainers locally, service container in CI). Files end in `.int-spec.ts`.
- System tests: Playwright against the full stack with seeded data, Chromium in CI, axe checks on key pages.
- No separate API "e2e" suite beyond the integration tests.

## Consequences
- D13 (Jest + @swc/jest) is superseded by this ADR.
- Coverage thresholds start around 70 % on services and feature hooks and ratchet up.
