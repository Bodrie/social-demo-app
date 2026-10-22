# syntax=docker/dockerfile:1.7
# Build context: the repository root (`docker build -f apps/migrate/Dockerfile .`).
# One-shot image: applies the API's Prisma migrations (apps/api/prisma) and exits. Compose runs
# it before every start of the API (`service_completed_successfully`), so the API image needs no
# Prisma CLI. Any other Prisma command goes through the same image:
# `docker compose run --rm migrate migrate status`.

ARG NODE_IMAGE=node:24-slim
ARG PNPM_VERSION=11.1.0

# ---------- deps: the Prisma CLI and dotenv (what prisma.config.ts imports), nothing else ----------
FROM ${NODE_IMAGE} AS deps
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .pnpmfile.cjs ./
COPY apps/migrate/package.json apps/migrate/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @beso/migrate

# ---------- runtime ----------
FROM ${NODE_IMAGE} AS runtime
# The schema engine is a native binary that links OpenSSL.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# No update check or telemetry from the CLI.
ENV NODE_ENV=production CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1
WORKDIR /app/apps/migrate
# Owned by `node`: the CLI refuses to start unless it can write to the engines' directory.
COPY --from=deps --chown=node:node /app/node_modules /app/node_modules
COPY --from=deps --chown=node:node /app/apps/migrate/node_modules ./node_modules
COPY apps/api/prisma.config.ts ./
COPY apps/api/prisma/schema.prisma ./prisma/
COPY apps/api/prisma/migrations ./prisma/migrations
USER node
ENTRYPOINT ["./node_modules/.bin/prisma"]
CMD ["migrate", "deploy"]
