#!/usr/bin/env bash
# Nightly backup: a compressed SQL dump plus the uploads volume, kept for 14 days.
# Copy the resulting files off the box (rclone, a second disk, …); restore notes in docs/RUNBOOK.md.
set -euo pipefail
cd "$(dirname "$0")"
dest="${BACKUP_DIR:-$HOME/beso-backups}"
stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$dest"
# --clean --if-exists: the dump drops what it recreates, so it can never merge into existing rows.
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" --clean --if-exists "$POSTGRES_DB"' \
  | gzip > "$dest/db-$stamp.sql.gz"
# Streamed out of the running api container, which mounts the uploads volume: nothing is pulled
# at backup time (a `docker run alpine` here once failed mid-pull when it coincided with
# update.sh's `docker image prune`), and the file belongs to this user rather than to root.
docker compose exec -T api tar czf - -C /data/uploads . > "$dest/uploads-$stamp.tar.gz"
find "$dest" -name '*.gz' -mtime +14 -delete
ls -lh "$dest" | tail -n +2
