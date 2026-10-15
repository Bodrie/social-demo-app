# 0002 – NestJS + Prisma + PostgreSQL

Date: 2026-10-15 · Status: Accepted · Plan: §2.2, §2.3, D1, D2

## Context
The Express API had raw MySQL strings, no migrations, no validation, no tests, and a schema that lived only in the queries (likes stored as a CSV string, activities denormalised). No production data is kept (D1).

## Decision
- NestJS 12 (ESM, Express adapter) with feature modules per resource.
- Prisma 7.10 on PostgreSQL 17 as the ORM (8.0 skipped while it is an RC); `prisma.config.ts` holds the datasource URL and seed command; the `prisma-client` generator writes TypeScript into `apps/api/src/generated` (gitignored); runtime goes through `@prisma/adapter-pg`. Migrations are committed under `apps/api/prisma/migrations`; `pnpm db:seed` loads deterministic faker data plus fixed e2e users.
- Constraints Prisma cannot express (the no-self-follow CHECK) are appended by hand to the migration SQL and mirrored in service code. CI applies the migrations to a fresh database, then fails on any diff between database and schema (`pnpm db:check`).
- UUID v7 primary keys; likes and follows as relation tables; activities generated server-side via domain events.
- Drizzle was the runner-up; TypeORM rejected for weak typing and migration tooling.

## Consequences
- Fresh database; no ETL from MySQL. Old uploads are not migrated.
- Every schema change is a migration reviewed in a PR and applied by `prisma migrate deploy` on deploy.
