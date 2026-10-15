# syntax=docker/dockerfile:1.7
# Build context: the repository root (`docker build -f apps/api/Dockerfile .`).
# Debian slim rather than Alpine: argon2, sharp and the Prisma engines all ship
# glibc prebuilds, so nothing is compiled during the install.

ARG NODE_IMAGE=node:24-slim
ARG PNPM_VERSION=11.1.0

# ---------- base: pnpm + workspace manifests ----------
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

# ---------- build: full install, shared build, prisma generate, nest build ----------
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @the-mesh/api...
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/api apps/api
# prisma.config.ts insists on a database URL even for `generate`.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm --filter @the-mesh/shared build \
 && pnpm --filter @the-mesh/api db:generate \
 && pnpm --filter @the-mesh/api build

# ---------- prod-deps: production dependencies only (incl. prisma CLI for migrations) ----------
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @the-mesh/api...

# ---------- runtime ----------
FROM ${NODE_IMAGE} AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /data/uploads && chown -R node:node /data
ENV NODE_ENV=production PORT=3000 UPLOADS_DIR=/data/uploads
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps --chown=node:node /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /app/apps/api/package.json /app/apps/api/prisma.config.ts ./apps/api/
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node apps/api/docker/entrypoint.sh /usr/local/bin/entrypoint.sh
# The entrypoint starts as root only to chown the uploads volume, then runs as `node`.
EXPOSE 3000
VOLUME ["/data/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["entrypoint.sh"]
