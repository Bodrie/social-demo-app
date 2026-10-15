# 0008 – oxlint (type-aware) + Prettier

Date: 2026-10-15 · Status: Accepted (amends D23) · Plan: §2.2

## Context
The plan proposed ESLint + typescript-eslint. In phase 1 both official scaffolds (Nest 12 CLI, create-vite 8) generated oxlint configurations by default, and oxlint's type-aware engine (`oxlint-tsgolint`) covers 59 of 61 typescript-eslint type-aware rules while being independent of the TypeScript compiler API.

## Decision
- oxlint with `--type-aware` in every workspace, extending `packages/config/oxlint/base.json`; React, hooks and jsx-a11y rules enabled in `apps/web`.
- Prettier for formatting from a single root `.prettierrc`; `pnpm format:check` runs in CI.
- ESLint is not installed. If a plugin with no oxlint equivalent becomes necessary (TanStack Query, Playwright), it is added as an oxlint JS plugin or ESLint is added for that plugin only.

## Consequences
- D23 (ESLint + typescript-eslint) is superseded by this ADR.
- Lint runs in seconds; one fewer dependency on the TypeScript compiler API.
