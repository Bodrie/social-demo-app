# 0006 – Self-hosted box behind Cloudflare Tunnel, pull-based releases

Date: 2026-10-15 · Status: Accepted (release mechanics superseded by [0018](0018-migrations-image-and-updater.md): migrations in their own image, an updater that pulls only our images) · Plan: §2.9, §2.11, D11, D12

## Context
Production runs on one Ubuntu Server 24.04 machine behind a residential ISP connection without a static IP. The repository is public. No domain exists yet.

## Decision
- Docker Compose on the box: Caddy (plain HTTP inside), web (static), api, PostgreSQL, uploads volume, nightly backup job.
- Inbound traffic through a Cloudflare Tunnel (`cloudflared` container, outbound only). DDNS + port forwarding stays documented as the fallback.
- Releases are pull-based: a `vX.Y.Z` tag publishes images to GHCR; a timer on the box runs `docker compose pull && up -d`; the api entrypoint runs `prisma migrate deploy`. No SSH from GitHub, no self-hosted runner.
- Uploads live on a local volume behind a `StorageService` interface so object storage can replace it later.

## Consequences
- The domain only affects env values (`DOMAIN`, `PUBLIC_WEB_URL`, `PUBLIC_ASSETS_URL`, cookie domain).
- No high availability; off-box backups are mandatory.
