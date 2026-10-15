# The Mesh - Social Network Demo App

## 🚧 Rebuild (v2) in progress

The app is being rewritten as a pnpm monorepo: `apps/api` (NestJS 12), `apps/web` (Vite 8 + React 19),
`packages/shared` (zod schemas shared by both). Plan: [`docs/REBUILD_PLAN.md`](docs/REBUILD_PLAN.md).
Decisions: [`docs/adr/`](docs/adr/). Everything below this section describes the **legacy** code in
`api/` and `client/`, which stays untouched until the cutover.

```bash
pnpm install
pnpm db:up      # PostgreSQL 17 on localhost:5433 (docker compose)
pnpm dev        # shared (watch) + api (nest --watch) + web (vite)
pnpm check      # lint, typecheck, test, build – the same as CI
pnpm test:int   # API integration tests (HTTP level)
```


This repository contains the server-side and client-side code for the project.

---

## 🚨 Legacy code status: Frozen

The legacy app described below (`api/`, `client/`) is **frozen**: no fixes or features. All active work happens in the v2 rebuild (see the section above).

---

## 🌍 Environments

- **Production:** [~~https://the-mesh.eu~~](https://the-mesh.eu) _(Currently inactive)_
- **Development:** ~~https://dev-the-mesh.vercel.app~~ _(removed 2026-10-15; the Vercel project and its GitHub integration were deleted)_

---

## 🖥 Server & Database

- Hosted on a **physical machine** running **Ubuntu Server v23.10**.
- **Nginx** serves the front-end, and **PM2** manages the **Node.js** server instance.
- **Database:** MySQL, but using the `mysql2` package instead of `mysql` in Node.js to avoid query-related issues.

---

## 🚀 Deployment

### Deploy Scripts

This repository contains two shell scripts for deploying the legacy code. Both are **obsolete** and will be removed at the v2 cutover:

1. **Development Deployment:**

   - Pushing to the `main` branch used to trigger an automatic deployment to **Vercel**. That integration no longer exists.

2. **Production Deployment:**
   - The script builds the app locally and then uploads it to the **production server** manually.

---

## 📌 To-Do _(Paused)_

- [ ] Migrate / Swithch from ExpressJS to NestJS on the server-side

- [ ] Migrate / Swithch from CRA to Vite

- [ ] Extract reusable components from the existing code on the client-side

- [ ] General refactoring, fixing and polishing of the code base

- [ ] Add CI/CD to the project

- [ ] Add Docker containerization

---
