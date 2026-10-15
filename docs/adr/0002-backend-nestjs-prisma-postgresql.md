# 0002 – NestJS + Prisma + PostgreSQL

Date: 2026-10-15 · Status: Accepted · Plan: §2.2, §2.3, D1, D2

## Context
The Express API had raw MySQL strings, no migrations, no validation, no tests, and a schema that lived only in the queries (likes stored as a CSV string, activities denormalised). No production data is kept (D1).

## Decision
- NestJS 12 (ESM, Express adapter) with feature modules per resource.
- Prisma on PostgreSQL 17 as the ORM; migrations committed under `apps/api/prisma/migrations`; `prisma db seed` with faker data and fixed e2e users.
- UUID v7 primary keys; likes and follows as relation tables; activities generated server-side via domain events.
- Drizzle was the runner-up; TypeORM rejected for weak typing and migration tooling.

## Consequences
- Fresh database; no ETL from MySQL. Old uploads are not migrated.
- Every schema change is a migration reviewed in a PR and applied by `prisma migrate deploy` on deploy.
