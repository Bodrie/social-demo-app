# syntax=docker/dockerfile:1.7
# Build context: the repository root (`docker build -f apps/web/Dockerfile .`).
# Builds the static app, then serves it with Caddy, which also proxies /api and
# /socket.io to the api container so cookies stay first-party.

ARG NODE_IMAGE=node:24-slim
ARG PNPM_VERSION=11.1.0

FROM ${NODE_IMAGE} AS build
ARG PNPM_VERSION
# Empty = same origin (Caddy proxies the API). Set only when the API lives elsewhere.
ARG VITE_API_URL=
ARG VITE_OPERATOR_NAME=
ARG VITE_CONTACT_EMAIL=
ARG VITE_REPOSITORY_URL=
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true VITE_API_URL=${VITE_API_URL} \
    VITE_OPERATOR_NAME=${VITE_OPERATOR_NAME} VITE_CONTACT_EMAIL=${VITE_CONTACT_EMAIL} \
    VITE_REPOSITORY_URL=${VITE_REPOSITORY_URL}
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @the-mesh/web...
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @the-mesh/shared build \
 && pnpm --filter @the-mesh/web build

FROM caddy:2-alpine AS runtime
COPY apps/web/docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv/www
RUN mkdir -p /srv/uploads && caddy validate --config /etc/caddy/Caddyfile
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
