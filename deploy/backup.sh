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
docker run --rm -v beso_uploads:/data:ro -v "$dest":/backup alpine \
  tar czf "/backup/uploads-$stamp.tar.gz" -C /data .
find "$dest" -name '*.gz' -mtime +14 -delete
ls -lh "$dest" | tail -n +2
