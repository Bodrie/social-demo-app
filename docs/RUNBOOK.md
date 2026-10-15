# Runbook – running The Mesh on one Ubuntu box

Target: Ubuntu Server 24.04, Docker Engine, no static IP, inbound traffic through a
Cloudflare Tunnel (plan §2.11, decision D12). Everything lives in `/opt/the-mesh`.

## 1. One-time server setup

```bash
# Docker Engine from Docker's repository (not the snap).
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin unattended-upgrades

# A service user that can talk to Docker, and the deploy directory.
sudo useradd -r -m -s /bin/bash -G docker mesh
sudo mkdir -p /opt/the-mesh && sudo chown mesh:mesh /opt/the-mesh

# No inbound ports are needed with the tunnel; keep SSH reachable from the LAN only.
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow from 192.168.0.0/16 to any port 22 proto tcp   # adjust to your LAN
sudo ufw enable
```

Copy the contents of this repository's `deploy/` directory to `/opt/the-mesh`
(`scp -r deploy/* mesh@box:/opt/the-mesh/`), then as the `mesh` user:

```bash
cd /opt/the-mesh
cp .env.example .env && chmod 600 .env
# Fill in: PUBLIC_URL, POSTGRES_PASSWORD, JWT_SECRET (openssl rand -base64 48), TUNNEL_TOKEN.
```

## 2. Cloudflare Tunnel

1. The domain's DNS must be on Cloudflare (free plan is enough).
2. Zero Trust dashboard → Networks → Tunnels → **Create a tunnel** (Cloudflared) → copy the
   token into `TUNNEL_TOKEN` in `.env`.
3. In the tunnel's **Public hostname** tab add the hostname (e.g. `the-mesh.example.com`)
   with service **HTTP** and URL `web:80` (the compose service name; cloudflared runs in the
   same network).
4. Set `PUBLIC_URL=https://the-mesh.example.com` in `.env`. Cloudflare terminates TLS; Caddy
   serves plain HTTP inside the box. Leave Cloudflare's HSTS off: the API already sends HSTS.

Without a tunnel (LAN only, or a VPS with a public IP) skip this section; the stack is
reachable on `http://<box>:8080` only from the box itself unless you change `ports`.

## 3. First start

```bash
cd /opt/the-mesh
docker compose --profile tunnel pull
docker compose --profile tunnel up -d
docker compose logs -f api        # "Applying database migrations…" then the Nest banner
curl -s http://127.0.0.1:8080/api/v1/auth/me   # {"statusCode":401,...} means Caddy → API works
```

The api container applies pending Prisma migrations on every start (`MIGRATE_ON_START`).
There is no seed in production; the first member registers through the app.

Enable the timers (updates every 5 minutes, backups nightly):

```bash
sudo cp /opt/the-mesh/systemd/*.service /opt/the-mesh/systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mesh-update.timer mesh-backup.timer
systemctl list-timers mesh-*
```

## 4. Releases (pull-based)

1. Merge to `main`: `.github/workflows/docker.yml` publishes `ghcr.io/<owner>/the-mesh-api`
   and `the-mesh-web` tagged `latest` and `sha-<short>`. A tag `vX.Y.Z` adds `vX.Y.Z` and `vX.Y`.
2. The box runs `update.sh` every 5 minutes: `docker compose pull && up -d`. Nothing happens
   when the tag's digest did not change.
3. To pin a release: `TAG=v2.0.0` in `.env`, then `./update.sh`. Rollback = set the previous
   tag and run it again (migrations are forward-only; see §6 before rolling back across one).
4. GHCR packages are private by default on first push: make them public (package settings)
   or create a read token on the box (`docker login ghcr.io`).

## 5. Backups and restore

`backup.sh` writes `db-<stamp>.sql.gz` (pg_dump) and `uploads-<stamp>.tar.gz` to
`$BACKUP_DIR` (default `~/mesh-backups`) and keeps 14 days. Copy that directory off the box
(rclone to object storage, a second disk, …). Restore drill:

```bash
cd /opt/the-mesh && docker compose stop api
gunzip -c ~/mesh-backups/db-<stamp>.sql.gz | docker compose exec -T postgres psql -U mesh -d mesh
docker run --rm -v the-mesh_uploads:/data -v ~/mesh-backups:/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/uploads-<stamp>.tar.gz -C /data'
docker compose start api
```

## 6. Day-to-day

| Task | Command |
|---|---|
| Status | `docker compose ps` |
| Logs | `docker compose logs -f api` / `web` / `cloudflared` |
| Health (from the box) | `curl -s http://127.0.0.1:8080/api/v1/auth/me` (401 = healthy chain); `docker inspect --format '{{.State.Health.Status}}' the-mesh-api-1` |
| Migrations manually | `docker compose exec api sh -c 'cd apps/api && ./node_modules/.bin/prisma migrate deploy'` |
| Database shell | `docker compose exec postgres psql -U mesh -d mesh` |
| Disk | `docker system df`; `docker image prune -f` runs in update.sh |
| Rotate `JWT_SECRET` | change it in `.env`, `docker compose up -d api` (every member must sign in again) |

Migrations are applied before the new API starts; if a migration fails the container
exits and `docker compose ps` shows it restarting: fix forward (new migration) rather than
rolling the image back, because the schema may already be ahead of the old code.

## 7. What is not in place yet

- Off-box backup copies (pick rclone + a bucket; add it to `backup.sh`).
- Monitoring/alerts beyond Docker health checks (uptime check on the public URL is cheap).
- An origin certificate between Cloudflare and Caddy (traffic inside the box is HTTP).
