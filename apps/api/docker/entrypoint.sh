#!/bin/sh
# 1. As root: make the uploads volume writable by the app user (named volumes are
#    created root-owned), then drop privileges.
# 2. As node: apply pending migrations (unless MIGRATE_ON_START=false) and start the API.
set -eu
cd /app/apps/api
UPLOADS="${UPLOADS_DIR:-/data/uploads}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$UPLOADS"
  chown node:node "$UPLOADS"
  exec setpriv --reuid=node --regid=node --init-groups "$0" "$@"
fi
if [ "${MIGRATE_ON_START:-true}" != "false" ]; then
  echo "Applying database migrations…"
  ./node_modules/.bin/prisma migrate deploy
fi
exec node dist/main.js
