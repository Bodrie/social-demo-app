# 0007 – TypeScript 6 now, 7 when tooling allows

Date: 2026-10-15 · Status: Accepted · Plan: §2.12, D19

## Context
TypeScript 7.0 (native Go compiler) is stable since 2026-07-08 but ships no programmatic compiler API until 7.1. nest-cli's tsc builder, typescript-eslint and ts-jest depend on that API; running 7 today requires aliasing `typescript` to `@typescript/typescript6`.

## Decision
- Pin `typescript@6.0.x` in every workspace.
- Write configuration that is already valid for 7: no `baseUrl`, no `node10` resolution, no `target: es5`, `module: nodenext` (api) / `esnext` + `bundler` (web).
- Keep every toolchain piece off the compiler API: Vite/oxc and Vitest for emit and tests, oxlint for linting, zod-based OpenAPI instead of the Nest Swagger CLI plugin.

## Consequences
- The upgrade to 7 is a version bump plus `pnpm typecheck`, gated only on nest-cli supporting the 7.1 API.
