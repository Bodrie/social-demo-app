#!/usr/bin/env bash
# Pull the images for the tag in .env and restart what changed. Safe to run on a timer:
# when nothing new was pulled, `up -d` is a no-op. The api container applies pending
# migrations on start.
set -euo pipefail
cd "$(dirname "$0")"
profiles=()
if grep -qE '^TUNNEL_TOKEN=.+' .env 2>/dev/null; then profiles=(--profile tunnel); fi
docker compose "${profiles[@]}" pull --quiet
docker compose "${profiles[@]}" up -d --remove-orphans
docker image prune -f >/dev/null
docker compose ps
