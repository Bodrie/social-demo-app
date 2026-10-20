# Roadmap (after v2.2)

Written 2026-10-16, after the v2 rebuild, the v2.1 follow-ups, the review pass, the domain
setup (`social.bodrie.dev`) and the email slice. Ordered by when it should happen, not by
size. Finished items move to the phase table in `REBUILD_PLAN.md`; deliberate deferrals stay
in `BACKLOG.md`.

## 1. Before the first real visitor

| Item | Why | Notes |
|---|---|---|
| First deployment on the box, uptime check, off-box backups | nothing has run on the real box yet | runbook §1–3 (Docker log rotation is in the compose file since the pre-release review); rehearse the restore drill of runbook §5 once; Cloudflare health check or any monitor on `/api/v1/auth/me` (401 = healthy) |
| ~~**Legal pages** (privacy notice, terms)~~ ✅ 2026-10-16 | required once strangers can register; EU hosting | done as R1: `/privacy`, `/terms`, linked from the auth pages, the register form and the app |
| ~~Account deletion and data export~~ ✅ 2026-10-19 | GDPR rights; cascades already exist in the schema | done as A2 (ADR 0012): `DELETE /users/me` with the password, `GET /users/me/export`, Settings → Your account |
| ~~Spam protection on registration~~ ✅ 2026-10-19 | email verification alone does not stop bots | done as A3 (ADR 0012): Turnstile on the register form, verified by the API, runbook §2.7 |
| ~~Finish the review pass~~ ✅ 2026-10-19 | four tracks never produced a report | done as A4: `docs/REVIEW_2026-10-19.md` (accessibility, contract drift, ops/docs drift, test coverage) plus the cheap Low items |

## 2. Product features with the most impact

| Item | Why | Notes |
|---|---|---|
| ~~**Mentions and hashtags**~~ ✅ 2026-10-19 | `@alice` / `#topic` parsed at save time, linked in the UI; feeds notifications and search | done as B1 (ADR 0013): shared parser, entities per post/comment, `/tags/:tag`, trending, `@` autocomplete, links in text |
| ~~**Post pages and search**~~ ✅ 2026-10-19 | posts have no permalink, nothing can be shared or linked from a notification | done as B2 (ADR 0014): `/p/:id` with comments, copy link, `GET /search/posts` on a generated tsvector, `/search` with Posts and People tabs |
| ~~Notifications~~ ✅ 2026-10-20 | nobody is told about likes, comments, follows, mentions or messages received while away | done as B4 (ADR 0015): per-user rows from the domain events, bell + badges, `/notifications`, pushed over the chat socket; web push later (E2) |
| Moderation basics | necessary the moment the site is public | block and mute, report a post, an admin role with a small queue |
| ~~Email and sessions in Settings~~ ✅ 2026-10-20 | change the address (confirm the new one first), re-send verification, list of sessions with "sign out this device" | refresh tokens already record user agent and IP |
| Richer posts | several pictures per post, width/height stored at upload (fixes layout shift), link previews after | upload metadata exists in the `uploads` response already |

## 3. Polish and depth

| Item | Notes |
|---|---|
| ~~**Chat follow-ups**~~ ✅ 2026-10-19 | done as B3b (ADR 0009 amendment 2): message deletion, group admins (rename, remove, promote), system lines, paginated list, "new messages" pill, unread count in the tab title, sound and browser notifications |
| Performance | `zod/mini` browser build, image `srcset`, font preload, route prefetch on hover (bundle is at 241 of 245 kB) |
| Two-factor authentication (TOTP) | the email flows now exist to recover a lost device |
| PWA manifest, web push | rides on the notifications work |
| Observability | error tracking (Sentry free tier or self-hosted GlitchTip), a small status page |

## Agreed order (2026-10-16)

The owner picked, to be done directly on `dev` with one commit per item: **legal pages →
mentions and hashtags → post pages and search → chat follow-ups**. All four are done; the
full sequence from here is in `IMPLEMENTATION_PLAN.md`.
