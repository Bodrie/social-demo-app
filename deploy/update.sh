#!/usr/bin/env bash
# Pull the images CI publishes for the tag in .env and apply what changed. Runs on a timer
# (beso-update.timer, every 5 minutes) and by hand after editing .env.
# - Only our images are pulled (migrate, api, web). postgres and cloudflared stay on what the box
#   has until they are updated on purpose (RUNBOOK §6): a Docker Hub hiccup or rate limit can no
#   longer hold back a release, and no new cloudflared or Postgres arrives unannounced.
# - The three come from one release and move together: when any pull fails (an outage, a package
#   still private), nothing is restarted and the unit fails, so `systemctl status` shows it.
# - `up -d` runs only when the configuration (.env, compose file) or an image changed since the
#   last successful run, or a service is not running: every `up -d` also runs the one-shot
#   migrate service, which is harmless but needless every 5 minutes.
# - Migrations run on their own before `up -d`: compose removes the old API container before it
#   waits for `migrate`, so a migration that fails inside `up -d` would leave no API running.
#   This way a failed migration stops here and the running release keeps serving.
set -euo pipefail
cd "$(dirname "$0")"
profiles=()
if grep -qE '^TUNNEL_TOKEN=.+' .env 2>/dev/null; then profiles=(--profile tunnel); fi
compose() { docker compose "${profiles[@]}" "$@"; }
ours=(migrate api web)
# Fingerprint of what the last successful `up -d` applied (a hash only: the config holds secrets).
state=.update-state

fingerprint() {
  {
    compose config
    compose config --images | sort -u | while read -r image; do
      docker image inspect --format '{{.Id}}' "$image" 2>/dev/null || echo "missing $image"
    done
  } | sha256sum | cut -d' ' -f1
}

if ! compose pull --quiet "${ours[@]}"; then
  echo "Pulling ${ours[*]} failed; nothing was restarted." >&2
  exit 1
fi

current="$(fingerprint)"
expected="$(compose config --services | grep -vx migrate | sort)"
running="$(compose ps --status running --services | sort)"
if [[ -f "$state" && "$(cat "$state")" == "$current" && "$expected" == "$running" ]]; then
  exit 0
fi

if ! compose run --rm migrate; then
  echo "Migrations failed; the running containers were left alone (RUNBOOK §6)." >&2
  exit 1
fi
compose up -d --remove-orphans
echo "$current" >"$state"
docker image prune -f >/dev/null
compose ps
