# Roadmap (after v2.2)

Written 2026-10-16, after the v2 rebuild, the v2.1 follow-ups, the review pass, the domain
setup (`social.bodrie.dev`) and the email slice. Ordered by when it should happen, not by
size. Finished items move to the phase table in `REBUILD_PLAN.md`; deliberate deferrals stay
in `BACKLOG.md`.

## 1. Before the first real visitor

| Item | Why | Notes |
|---|---|---|
| First deployment on the box, uptime check, off-box backups | nothing has run on the real box yet | runbook §1–3 (Docker log rotation is in the compose file since the pre-release review); rehearse the restore drill of runbook §5 once; Cloudflare health check or any monitor on `/api/v1/auth/me` (401 = healthy) |
| **Legal pages** (privacy notice, terms) | required once strangers can register; EU hosting | `/privacy`, `/terms`, linked from the auth pages, the register form and the app |
| Account deletion and data export | GDPR rights; cascades already exist in the schema | `DELETE /users/me` with password confirmation; `GET /users/me/export` as JSON |
| Spam protection on registration | email verification alone does not stop bots | Cloudflare Turnstile (free, the zone is on Cloudflare already) |
| Finish the review pass | four tracks never produced a report | accessibility sweep, shared-contract drift, ops/docs drift, test coverage; one or two agents at a time |

## 2. Product features with the most impact

| Item | Why | Notes |
|---|---|---|
| **Mentions and hashtags** | `@alice` / `#topic` parsed at save time, linked in the UI; feeds notifications and search | shared parser used by API and web; entities stored per post/comment |
| **Post pages and search** | posts have no permalink, nothing can be shared or linked from a notification | `/p/:id` with comments; Postgres full-text (`tsvector`) over posts and people |
| Notifications | nobody is told about likes, comments, follows, mentions or messages received while away | per-user notification rows, unread badge, delivered over the existing socket; web push later |
| Moderation basics | necessary the moment the site is public | block and mute, report a post, an admin role with a small queue |
| Email and sessions in Settings | change the address (confirm the new one first), re-send verification, list of sessions with "sign out this device" | refresh tokens already record user agent and IP |
| Richer posts | several pictures per post, width/height stored at upload (fixes layout shift), link previews after | upload metadata exists in the `uploads` response already |

## 3. Polish and depth

| Item | Notes |
|---|---|
| **Chat follow-ups** | delete a message, group admin and renaming, "new messages" pill when scrolled up, unread count in the tab title, notification sound |
| Performance | `zod/mini` browser build, image `srcset`, font preload, route prefetch on hover (bundle is at 235 of 240 kB) |
| Two-factor authentication (TOTP) | the email flows now exist to recover a lost device |
| PWA manifest, web push | rides on the notifications work |
| Observability | error tracking (Sentry free tier or self-hosted GlitchTip), a small status page |

## Agreed order (2026-10-16)

The owner picked, to be done directly on `dev` with one commit per item: **legal pages →
mentions and hashtags → post pages and search → chat follow-ups**.
