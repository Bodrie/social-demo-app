# Runbook – running BeSo on one Ubuntu box

Target: Ubuntu Server 24.04 on an Intel Core i5-6500 (64-bit x86; the images are built for
`linux/amd64` only), Docker Engine, no static IP, inbound traffic through a Cloudflare Tunnel
(plan §2.11, decision D12). Everything lives in `/opt/beso`.
The public address is **https://social.bodrie.dev**, a subdomain of `bodrie.dev` (domain at
Cloudflare Registrar, DNS on Cloudflare). The apex and `www` stay free for other sites.

The box never builds anything and holds no source code. CI builds two images, the API and the
web app (the built frontend inside Caddy), and publishes them to GHCR; the box keeps only the
`deploy/` files (compose file, scripts, `.env`) and pulls those images, together with the stock
`postgres` and `cloudflared` images (§4).

## 1. One-time server setup

From your own account on the box (the one with sudo). `dpkg --print-architecture` prints
`amd64`, Debian's name for 64-bit x86 on Intel and AMD alike; `arm64` would mean an ARM board,
for which no images are built.

The box is shared: Frigate, Cockpit and an MQTT broker already run there. BeSo sits next to
them as its own compose project (`beso`: its own network, volumes and containers) and needs
nothing from them; the steps below only make sure it does not collide with them.

### 1.1 Docker

Docker is already installed for the other services. BeSo needs Docker Engine with the
Compose v2 plugin, and not the snap (the snap only reads files under `$HOME`, so it cannot use
`/opt/beso`):

```bash
sudo docker version --format '{{.Server.Version}}'   # the engine answers
docker compose version                                # "Docker Compose version v2.…"
snap list docker 2>/dev/null                          # prints nothing: not the snap
```

If `docker compose` is unknown, add the plugin: `sudo apt-get install docker-compose-plugin`
with Docker's repository, `docker-compose-v2` with Ubuntu's `docker.io` package. On a box
without Docker, install it from Docker's apt repository first (as on
docs.docker.com/engine/install/ubuntu):

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin unattended-upgrades
```

### 1.2 Service user and deploy directory

```bash
sudo useradd -r -m -s /bin/bash -G docker beso
sudo mkdir -p /opt/beso && sudo chown beso:beso /opt/beso
```

### 1.3 Firewall (optional)

BeSo needs no inbound port: cloudflared dials out, and the stack publishes nothing but
`127.0.0.1:8080`. If ufw is already active (`sudo ufw status verbose`), there is nothing to
add. Turning it on for the first time on this shared box blocks every service that listens on
the host itself without an `allow` rule: Cockpit (9090/tcp), a broker installed on the host
rather than in a container, containers with `network_mode: host`, and containers that reach
such a service through the host (their traffic comes from the Docker subnets,
172.16.0.0/12). Ports that Docker publishes bypass ufw either way. List the listeners first
(`sudo ss -tulpn`), allow each one, and make sure your own address (first field of
`echo $SSH_CLIENT`) is inside the SSH range, or `ufw enable` drops the session:

```bash
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow from 10.0.10.0/24 to any port 22 proto tcp     # SSH from the LAN
sudo ufw allow from 10.0.10.0/24 to any port 9090 proto tcp   # Cockpit; one rule per host-level service
sudo ufw enable
```

### 1.4 Deploy files and `.env`

Switch to the service user (`sudo -iu beso`; it has no password and no SSH key), fetch this
repository's `deploy/` directory from `main` (dotfiles included) and create `.env`:

```bash
cd /opt/beso
curl -fsSL https://github.com/Bodrie/beso/archive/refs/heads/main.tar.gz \
  | tar -xz -C /opt/beso --strip-components=2 beso-main/deploy
cp .env.example .env && chmod 600 .env
# Hex for the database password: it is placed inside DATABASE_URL, where the `/` that most
# base64 strings contain breaks the URL. It is fixed at the first start (the volume keeps it).
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 32)|" .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -base64 48)|" .env
nano .env   # SMTP_URL (Resend API key, §2.6), TUNNEL_TOKEN (§2.2) and TURNSTILE_SECRET (§2.7, the placeholder is refused); PUBLIC_URL is already right
```

Running the `curl … | tar` line again later refreshes the compose file and the scripts after
`deploy/` changed on `main`; it never touches `.env` (copy changed unit files to
`/etc/systemd/system` again, §3).

## 2. Domain and Cloudflare Tunnel (`social.bodrie.dev`)

Everything in this section can be done before the box exists: the tunnel, its hostname, the
zone settings and the Resend domain only need the Cloudflare and Resend dashboards. Keep the
two secrets they produce (`TUNNEL_TOKEN`, the Resend API key) for the server's `.env`; until
the connector runs, visitors to `social.bodrie.dev` see Cloudflare's "tunnel not running"
page (error 1033), which is expected.

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

### 2.2 Create the tunnel (dash.cloudflare.com → account → **Networking → Tunnels**; older UIs: Zero Trust / Cloudflare One → Networks → Tunnels)

1. **Create a tunnel** → type *Cloudflared* → name it (`social.bodrie.dev` or `beso`) →
   **Save**. The tunnel's **Overview** shows *Install cloudflared connector*: pick **Docker**
   and copy the long `eyJ…` value after `--token` from the shown command. That is
   `TUNNEL_TOKEN` for `/opt/beso/.env`; the box never installs cloudflared itself, the
   compose container runs it. (*Refresh token → Rotate token* on the right invalidates it.)
2. Still in the tunnel: **Routes** tab, or the **Add route** button in the *Routes* panel at
   the bottom of the Overview (older UIs: *Published application routes* / *Public hostname*)
   → route type **Published application route** (hostname):
   - Subdomain `social`, Domain `bodrie.dev` (the *Full hostname* preview must read
     `social.bodrie.dev`), Path empty.
   - Service URL `http://web:80` (one field with the scheme in it; older UIs split it into
     Type HTTP + URL `web:80`). `web` is the compose service name; cloudflared is on the same
     Docker network, so this resolves inside the box only. Leave *Additional application
     settings* alone.
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
| dash.cloudflare.com → `bodrie.dev` → SSL/TLS → Overview → *Configure* | Encryption mode | **Full (strict)** | the tunnel is the origin so this is not exercised today, but it keeps a future direct origin safe |
| SSL/TLS → Edge Certificates | Always Use HTTPS | on | plain `http://social.bodrie.dev` → `https://` |
| SSL/TLS → Edge Certificates | Minimum TLS version | 1.2 | drop legacy clients |
| SSL/TLS → Edge Certificates | HSTS | leave **off** | `.dev` is on the browsers' HSTS preload list already (subdomains included); the API sends the header itself |
| Network | WebSockets | on (default) | socket.io |
| Speed → Optimization → Content Optimization | Rocket Loader | **off** | it rewrites script tags and breaks the SPA |
| Security → Settings → Bot traffic (older UI: Security → Bots) | Bot Fight Mode | off to start | it can challenge `fetch` and the socket.io polling fallback; turn it on later and watch the logs |
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
2. Easiest: press **Auto configure** on the domain page; Resend's Cloudflare integration
   creates the records in the `bodrie.dev` zone itself (this is what was done for
   `social.bodrie.dev`, verified within three minutes). By hand instead: Cloudflare dashboard
   → `bodrie.dev` → DNS → add them exactly as shown, all **DNS only** (grey cloud; mail
   records are never proxied). As of 2026-10 Resend asks for:
   - `TXT  resend._domainkey.social`  →  `p=MIGf…` – the DKIM public key
   - `CNAME send.social`  →  `send.forge.rmta.net` and `CNAME rsend.social` →
     `rsend-<region>.forge.rmta.net` – return path and bounce handling (older setups used an
     MX plus an SPF TXT on `send.social` instead; follow whatever Resend lists)
   - `TXT  _dmarc.social`  →  `v=DMARC1; p=none;` – listed as optional and **not** created by
     Auto configure (Resend shows the name as `_dmarc`, relative to the domain); add it by
     hand, and move to `p=quarantine` once mail has flowed for a while
   Back in Resend press **Verify**; it usually turns green within minutes. The tunnel's own
   `social` record stays *Proxied*; it is unrelated to mail.
3. **API Keys → Create** with *Sending access*, restricted to the domain. Copy it once.
4. On the box, in `/opt/beso/.env`:
   ```
   SMTP_URL=smtps://resend:re_xxxxxxxxxxxxxxxx@smtp.resend.com:465
   EMAIL_FROM="BeSo <noreply@social.bodrie.dev>"
   ```
   then `docker compose up -d api`. Compose sets `EMAIL_TRANSPORT=smtp` and
   `WEB_URL=$PUBLIC_URL` (where the links point). The API refuses to start in production
   without these.
5. Check: register a member with an address you can read; the confirmation mail should
   arrive within seconds, from `noreply@social.bodrie.dev`, and pass DKIM/SPF/DMARC ("show
   original" in Gmail). Resend → Emails shows every delivery and bounce.

`noreply` has no inbox; replies bounce. Nothing on `social.bodrie.dev` receives mail until
Cloudflare **Email Routing** (free) is set up for the subdomain: dashboard → `bodrie.dev` →
Email → Email Routing → enable it for the subdomain `social.bodrie.dev` (it adds MX and SPF
records on `social`, next to Resend's `send.social` / `rsend.social`, which it leaves alone) →
custom address `admin@social.bodrie.dev` → the mailbox you read. Do that before publishing
`admin@social.bodrie.dev` as `VITE_CONTACT_EMAIL` on the legal pages.
Provider switch: any SMTP submission URL works (Postmark, Brevo, SES); only `.env` changes.

### 2.7 Bot check on registration (Cloudflare Turnstile)

Email confirmation alone does not stop scripted sign-ups, so the register form carries a
Turnstile widget (free, no puzzle for most people) and the API refuses a registration whose
token Cloudflare does not confirm. The widget is made once per site; its two halves go to
two different places (ADR 0012).

1. dash.cloudflare.com → account home → **Turnstile** → **Add widget**: name `BeSo`,
   hostname `social.bodrie.dev` (add `localhost` only on a widget you use for local trials),
   mode **Managed**, pre-clearance off. Copy the **site key** and the **secret key**.
2. The **site key** is public and is baked into the web bundle at build time: in the GitHub
   repository → Settings → Secrets and variables → Actions → **Variables**, add
   `VITE_TURNSTILE_SITE_KEY` (and, while there, `VITE_OPERATOR_NAME`, `VITE_CONTACT_EMAIL`,
   `VITE_REPOSITORY_URL` for the legal pages). The next CI run on `main` builds a web image
   that shows the widget. Nothing changes on the box for this half.
3. The **secret key** goes into `/opt/beso/.env` as `TURNSTILE_SECRET=…`, then
   `docker compose up -d api`. The API refuses to start in production without it; to run the
   site deliberately without a bot check (a closed trial), set `CAPTCHA=off` instead.
4. Check: open `/register` in a private window; the widget appears under the password field
   and the button stays disabled until it has passed. Register with a throwaway address. In
   the dashboard, Turnstile → the widget → **Analytics** shows the solve.

Mismatched halves (a site key from one widget, the secret of another) fail every registration
with "Please complete the bot check"; a Cloudflare outage answers 503 `CAPTCHA_UNAVAILABLE`
and nobody can register until it is back, by design.

## 3. First start

As `beso`:

```bash
cd /opt/beso
ss -ltn | grep ':8080 '           # prints nothing; if another service holds 8080, set WEB_PORT=8081 in .env and use that port below
docker compose --profile tunnel pull
docker compose --profile tunnel up -d
docker compose logs -f api        # "Applying database migrations…", then "API listening on port 3000 (production)"; Ctrl-C
docker compose ps                 # within a minute: postgres, api and web "(healthy)", cloudflared "Up"
curl -s http://127.0.0.1:8080/api/v1/auth/me   # {"statusCode":401,...} means Caddy → API works
docker compose logs cloudflared | grep -i 'registered tunnel connection'   # four lines: the tunnel is up
```

The site is now live; run the checks of §2.5 from another machine. At home, use
https://social.bodrie.dev as well: the stack has no LAN port (cloudflared reaches Caddy over the
Docker network, which is why the tunnel route is `http://web:80` and never the box's LAN
address). The api container applies pending Prisma migrations on every start
(`MIGRATE_ON_START`). There is no seed in production; the first member registers through the
app. An address listed in `ADMIN_EMAILS` is promoted at API start and at **sign-in** only:
registration plus the confirmation link signs the browser in without a sign-in, so the first
admin signs out and in once before **Admin** appears in the account menu.

Enable the timers (updates every 5 minutes, backups nightly) from your own account, since
`beso` has no sudo:

```bash
sudo cp /opt/beso/systemd/*.service /opt/beso/systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now beso-update.timer beso-backup.timer
systemctl list-timers 'beso-*'
sudo systemctl start beso-backup.service && sudo ls -lh /home/beso/beso-backups   # one backup now: the unit works
```

Enabling `beso-update.timer` runs `update.sh` at once (`OnUnitActiveSec` counts from the last
run, and there was none), so let `systemctl status beso-update.service` say "Deactivated
successfully" before starting the backup by hand: both scripts drive Docker, and `update.sh`
ends with `docker image prune -f`. The backup pulls no image of its own (the uploads archive
is streamed out of the api container), so the nightly runs cannot collide with the updater.

## 4. Releases (pull-based)

1. Merge to `main`: once every CI job (checks, integration, e2e) has passed, CI runs
   `.github/workflows/docker.yml`, which publishes `ghcr.io/<owner>/beso-api` and
   `beso-web` tagged `latest` and `sha-<short>`. A git tag `vX.Y.Z` (same CI run) also
   publishes `X.Y.Z` and `X.Y`: the image tags drop the `v`, so git tag `v2.0.0` is image
   `2.0.0`. A red run publishes nothing, so the box keeps what it has.
2. The box runs `update.sh` every 5 minutes: `docker compose pull && up -d`. Nothing happens
   when the tag's digest did not change.
3. To pin a release: `TAG=2.0.0` in `.env` (no `v`), then `./update.sh`. Rollback = set the
   previous tag and run it again (migrations are forward-only; see §6 before rolling back
   across one).
4. GHCR packages are private by default on first push: make them public (package settings)
   or create a read token on the box (`docker login ghcr.io`). `beso-api` and `beso-web` are
   new packages since the rename (2026-10-20) and GHCR creates packages private: after the
   first push to `main`, make both public in the package settings (as the old `the-mesh-*`
   ones were) so the box pulls without a login.

## 5. Backups and restore

`backup.sh` writes `db-<stamp>.sql.gz` (`pg_dump --clean --if-exists`) and
`uploads-<stamp>.tar.gz` to `$BACKUP_DIR` (default `~/beso-backups`) and keeps 14 days. Copy
that directory off the box (rclone to object storage, a second disk, …).

A restore replaces the database as a whole. Never pipe a dump into the live database as it
is: without dropping first, every `CREATE` fails, `psql` carries on, and each `COPY` into a
table that still has rows aborts on the first duplicate key while the empty ones fill up, so
the result is a mix of current and backup data that looks restored. The drill below starts
from an empty database and stops at the first error (`ON_ERROR_STOP`, one transaction), which
also works for dumps made before `--clean` was added:

```bash
cd /opt/beso && docker compose stop api
# An empty database (the API is stopped; --force ends any other connection, PostgreSQL 13+).
docker compose exec -T postgres sh -c \
  'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
gunzip -c ~/beso-backups/db-<stamp>.sql.gz | docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction -q'
docker run --rm -v beso_uploads:/data -v ~/beso-backups:/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/uploads-<stamp>.tar.gz -C /data'
docker compose start api   # applies any migration newer than the backup
```

If `psql` stops with an error, nothing of the dump was applied: fix the cause and run the
restore again from `dropdb`. Rehearse the drill once on the box (or on a copy of the
volumes) before it is needed.

## 6. Day-to-day

| Task | Command |
|---|---|
| Status | `docker compose ps` |
| Logs | `docker compose logs -f api` / `web` / `cloudflared` |
| Health (from the box) | `curl -s http://127.0.0.1:8080/api/v1/auth/me` (401 = healthy chain); `docker inspect --format '{{.State.Health.Status}}' beso-api-1` |
| Health (public) | `curl -s https://social.bodrie.dev/api/v1/auth/me` (401); tunnel status in the Cloudflare One dashboard or `docker compose logs cloudflared` ("Registered tunnel connection") |
| Tunnel reconnects | normal after an IP change; if it stays "Down", `docker compose --profile tunnel restart cloudflared` and check the token in `.env` |
| Migrations manually | `docker compose exec api sh -c 'cd apps/api && ./node_modules/.bin/prisma migrate deploy'` |
| Database shell | `docker compose exec postgres psql -U beso -d beso` |
| Disk | `df -h /var/lib/docker /home/beso` and `docker system df`: if Frigate records to the same disk it can fill it, and a full disk takes Postgres down. `update.sh` runs `docker image prune -f`, which is host-wide but removes only untagged images that no container uses |
| Mail not arriving | `docker compose logs --since 1h api \| grep -iE 'mail\|smtp'`: `EAUTH` = wrong API key in `SMTP_URL`; a connection timeout = the network blocks port 465, use `smtp.resend.com:2465` (also implicit TLS). A registration whose mail failed still created the account: sign in and press *Send the email again*. Resend → Emails for bounces; DNS records still DNS-only and verified |
| Rotate `JWT_SECRET` | change it in `.env`, `docker compose up -d api` (every member must sign in again) |
| Cache headers (after a web change) | `curl -sI http://127.0.0.1:8080/ \| grep -i cache-control` → `no-cache`; `curl -sI http://127.0.0.1:8080/assets/does-not-exist.js \| grep -iE 'HTTP\|content-type\|cache'` → `404`, `no-store`, never `text/html` |
| Log size | each container keeps at most 5 × 20 MB (`logging` in `docker-compose.yml`); `docker compose logs --since 1h api` |
| Admins | `ADMIN_EMAILS=you@example.com,other@example.com` in `.env`, then `docker compose up -d api`: the listed accounts become admins at the next start (or at their next sign-in), every other admin becomes a member. Admins get **Admin** in their account menu: the reports queue at `/admin`, where they settle reports, delete reported posts or comments and suspend members (`docker compose logs api \| grep -E 'Member (un)?suspended\|Report filed'` for the trail; `admin_actions` in the database keeps every action) |
| Daily housekeeping | runs inside the API at 04:00 UTC (`JobsService`: expired email and refresh tokens, accounts unconfirmed for 30 days after one warning mail at day 23, uploads nobody attached within 24 h). `docker compose logs --since 24h api \| grep -E 'Job (finished\|failed)'` shows one line per job with its count. Several API containers: `JOBS_ENABLED=false` in `.env` for all but one, or every job runs once per container |

Migrations are applied before the new API starts; if a migration fails the container
exits and `docker compose ps` shows it restarting: fix forward (new migration) rather than
rolling the image back, because the schema may already be ahead of the old code. Prisma
records the failed migration as started and refuses every later `migrate deploy` with
`P3009` until it is told what became of it, so first mark it:
`docker compose exec api sh -c 'cd apps/api && ./node_modules/.bin/prisma migrate resolve --rolled-back <migration_name>'`
(after undoing by hand whatever part of it did apply; `--applied` instead if all of it did),
then ship the fixing migration and run `./update.sh`.

## 7. What is not in place yet

- Off-box backup copies (pick rclone + a bucket; add it to `backup.sh`).
- Monitoring/alerts beyond Docker health checks (uptime check on the public URL is cheap).
- Traffic between `cloudflared` and Caddy is plain HTTP on the private Docker network of the box (the tunnel itself is encrypted). An origin certificate only becomes relevant if the tunnel is ever replaced by a directly reachable origin.
