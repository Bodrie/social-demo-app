#!/bin/sh
# 1. As root: make the uploads volume writable by the app user (named volumes are
#    created root-owned), then drop privileges.
# 2. As node: start the API. Migrations are applied before it by the `migrate` service
#    (apps/migrate), which compose runs to completion first.
set -eu
cd /app/apps/api
UPLOADS="${UPLOADS_DIR:-/data/uploads}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$UPLOADS"
  chown node:node "$UPLOADS"
  exec setpriv --reuid=node --regid=node --init-groups "$0" "$@"
fi
if [ -n "${MIGRATE_ON_START:-}" ]; then
  # A deploy directory from before the migrate service still sets it (docs/RUNBOOK.md §1.4).
  echo "MIGRATE_ON_START is ignored: migrations run in the migrate service. Refresh deploy/ on the box." >&2
fi
exec node dist/main.js
