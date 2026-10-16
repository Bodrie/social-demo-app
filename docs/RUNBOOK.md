# Runbook – running The Mesh on one Ubuntu box

Target: Ubuntu Server 24.04, Docker Engine, no static IP, inbound traffic through a
Cloudflare Tunnel (plan §2.11, decision D12). Everything lives in `/opt/the-mesh`.
The public address is **https://social.bodrie.dev**, a subdomain of `bodrie.dev` (domain at
Cloudflare Registrar, DNS on Cloudflare). The apex and `www` stay free for other sites.

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
# Fill in: PUBLIC_URL=https://social.bodrie.dev, POSTGRES_PASSWORD, JWT_SECRET (openssl rand -base64 48),
# TUNNEL_TOKEN (section 2).
```

## 2. Domain and Cloudflare Tunnel (`social.bodrie.dev`)

The box has a dynamic IP and no open inbound ports. That is fine: `cloudflared` runs
inside the compose stack and dials **out** to Cloudflare; Cloudflare's edge terminates TLS
for `social.bodrie.dev` and forwards requests through that connection. An IP change, a router
reboot or a new ISP lease only causes the connector to reconnect. No port forwarding, no
dynamic-DNS client, no certificate on the box.

### 2.1 DNS (Cloudflare dashboard → `bodrie.dev` → DNS → Records)

1. The `social` record is created by the tunnel in step 2.2; if an `A`, `AAAA` or `CNAME`
   record named `social` already exists, delete it first, otherwise the tunnel refuses to
   add its route ("an A, AAAA, or CNAME record with that host already exists").
2. The apex `bodrie.dev` and the `CNAME www` you created are not part of this app. Leave
   them for whatever goes on the root later (a personal page can ride the same tunnel as a
   second public hostname pointing at another container). The app answers on exactly one
   host: cookies, `WEB_ORIGINS` and the uploads URL are all `social.bodrie.dev`, so do not
   add aliases such as `www.social` or the apex as extra tunnel hostnames.
3. Nothing else is needed for the app. (Mail records, if you ever use the domain for email,
   are independent.)

### 2.2 Create the tunnel (Zero Trust / Cloudflare One dashboard → Networks → Tunnels)

1. **Create a tunnel** → type *Cloudflared* → name it `the-mesh` → **Save**. On the next
   screen copy the token from the `cloudflared … --token eyJ…` command into `TUNNEL_TOKEN`
   in `/opt/the-mesh/.env` (the box never needs cloudflared installed; the container runs it).
2. **Public hostname** tab → **Add a public hostname**:
   - Subdomain: `social`, Domain: `bodrie.dev`, Path: *(empty)*
   - Service: Type **HTTP**, URL `web:80` (the compose service name; cloudflared is on the
     same Docker network, so this resolves inside the box only).
   - Save. Cloudflare adds the proxied `CNAME social → <tunnel-id>.cfargotunnel.com`.
3. Start the stack with the tunnel profile (section 3). The connector shows up as
   **Healthy** in the Tunnels list within a few seconds.

### 2.3 `.env`

```
PUBLIC_URL=https://social.bodrie.dev
```

`docker-compose.yml` derives everything else from it: `WEB_ORIGINS=https://social.bodrie.dev`
(CORS allow-list and the API's `Origin` check: a browser on any other host gets 403s on
writes, by design) and `PUBLIC_ASSETS_URL=https://social.bodrie.dev/api/v1/uploads`. Cookies are
`Secure`, `TRUST_PROXY=1` trusts the one hop (Caddy rewrites `X-Forwarded-For` from
`CF-Connecting-IP`, so rate limits see the visitor's address, not Cloudflare's).

### 2.4 Cloudflare settings for the zone

| Where | Setting | Value | Why |
|---|---|---|---|
| SSL/TLS → Overview | Encryption mode | **Full (strict)** | the tunnel is the origin so this is not exercised today, but it keeps a future direct origin safe |
| SSL/TLS → Edge Certificates | Always Use HTTPS | on | plain `http://social.bodrie.dev` → `https://` |
| SSL/TLS → Edge Certificates | Minimum TLS version | 1.2 | drop legacy clients |
| SSL/TLS → Edge Certificates | HSTS | leave **off** | `.dev` is on the browsers' HSTS preload list already (subdomains included); the API sends the header itself |
| Network | WebSockets | on (default) | socket.io |
| Speed → Optimization | Rocket Loader | **off** | it rewrites script tags and breaks the SPA |
| Security → Bots | Bot Fight Mode | off to start | it can challenge `fetch` and the socket.io polling fallback; turn it on later and watch the logs |
| Caching | defaults | – | `/api/*` responses carry no cacheable extension and are not cached; `/api/v1/uploads/*.webp` is cached at the edge and is immutable by key, which is what we want |

These are zone-wide settings: they also apply to whatever you put on the apex later.
Nothing on the box needs to know about TLS or the public IP.

### 2.5 Verify from anywhere

```bash
curl -sI https://social.bodrie.dev | head -5              # 200, a cf-ray header, text/html
curl -s  https://social.bodrie.dev/api/v1/auth/me         # {"statusCode":401,...}: edge → tunnel → Caddy → API
curl -sI http://social.bodrie.dev | grep -i location      # 301 → https://social.bodrie.dev/
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Origin: https://evil.example' -X POST https://social.bodrie.dev/api/v1/auth/login   # 403 (origin check)
```

Then register the first member in the browser and open two sessions (or two browsers):
the "Online now" card proves the WebSocket path through Cloudflare works.

Without a tunnel (LAN only, or a VPS with a public IP) skip this section; the stack is
reachable on `http://<box>:8080` only from the box itself unless you change `ports`.

### 2.6 Outbound email (Resend, `noreply@social.bodrie.dev`)

The app mails a confirmation link at registration (the account is closed until it is used)
and password reset links. The box never sends mail itself: the API submits it to Resend
over SMTP, and Resend sends it as `social.bodrie.dev` once that subdomain is verified.

1. <https://resend.com> → sign up → **Domains → Add domain** → `social.bodrie.dev`, region
   of your choice (EU keeps the data close). Resend shows a handful of DNS records.
2. Cloudflare dashboard → `bodrie.dev` → DNS → add them exactly as shown, all **DNS only**
   (grey cloud; mail records are never proxied). Typically:
   - `TXT  resend._domainkey.social`  – DKIM public key
   - `MX   send.social`  →  `feedback-smtp.<region>.amazonses.com` (priority 10) and
     `TXT  send.social`  →  `v=spf1 include:amazonses.com ~all` – the return path for bounces
   - `TXT  _dmarc.social`  →  `v=DMARC1; p=none;` to start (`p=quarantine` once mail flows)
   Back in Resend press **Verify**; it usually turns green within minutes.
3. **API Keys → Create** with *Sending access*, restricted to the domain. Copy it once.
4. On the box, in `/opt/the-mesh/.env`:
   ```
   SMTP_URL=smtps://resend:re_xxxxxxxxxxxxxxxx@smtp.resend.com:465
   EMAIL_FROM="The Mesh <noreply@social.bodrie.dev>"
   ```
   then `docker compose up -d api`. Compose sets `EMAIL_TRANSPORT=smtp` and
   `WEB_URL=$PUBLIC_URL` (where the links point). The API refuses to start in production
   without these.
5. Check: register a member with an address you can read; the confirmation mail should
   arrive within seconds, from `noreply@social.bodrie.dev`, and pass DKIM/SPF/DMARC ("show
   original" in Gmail). Resend → Emails shows every delivery and bounce.

`noreply` has no inbox; replies bounce. If you ever want to receive mail on the subdomain,
Cloudflare **Email Routing** (free) can forward it, with its own MX records on `social`.
Provider switch: any SMTP submission URL works (Postmark, Brevo, SES); only `.env` changes.

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
| Health (public) | `curl -s https://social.bodrie.dev/api/v1/auth/me` (401); tunnel status in the Cloudflare One dashboard or `docker compose logs cloudflared` ("Registered tunnel connection") |
| Tunnel reconnects | normal after an IP change; if it stays "Down", `docker compose --profile tunnel restart cloudflared` and check the token in `.env` |
| Migrations manually | `docker compose exec api sh -c 'cd apps/api && ./node_modules/.bin/prisma migrate deploy'` |
| Database shell | `docker compose exec postgres psql -U mesh -d mesh` |
| Disk | `docker system df`; `docker image prune -f` runs in update.sh |
| Mail not arriving | `docker compose logs api | grep -i mail`; Resend → Emails for bounces; DNS records still DNS-only and verified |
| Rotate `JWT_SECRET` | change it in `.env`, `docker compose up -d api` (every member must sign in again) |

Migrations are applied before the new API starts; if a migration fails the container
exits and `docker compose ps` shows it restarting: fix forward (new migration) rather than
rolling the image back, because the schema may already be ahead of the old code.

## 7. What is not in place yet

- Off-box backup copies (pick rclone + a bucket; add it to `backup.sh`).
- Monitoring/alerts beyond Docker health checks (uptime check on the public URL is cheap).
- Traffic between `cloudflared` and Caddy is plain HTTP on the private Docker network of the box (the tunnel itself is encrypted). An origin certificate only becomes relevant if the tunnel is ever replaced by a directly reachable origin.
