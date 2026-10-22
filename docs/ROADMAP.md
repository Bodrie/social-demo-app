# Roadmap (after v2.2; growth and play added 2026-10-22)

Written 2026-10-16, after the v2 rebuild, the v2.1 follow-ups, the review pass, the domain
setup (`social.bodrie.dev`) and the email slice. Ordered by when it should happen, not by
size. Finished items move to the phase table in `REBUILD_PLAN.md`; deliberate deferrals stay
in `BACKLOG.md`.

## 1. Before the first real visitor

| Item | Why | Notes |
|---|---|---|
| ~~First deployment on the box~~ ✅ 2026-10 (owner) | nothing had run on the real box | the box, the tunnel, Turnstile and Resend run; the uptime check, failure alerts and off-box backups were parked in `BACKLOG.md` ("Monitoring and alerting", "Operations") on 2026-10-22. Originally: runbook §1–3, the restore drill of runbook §5 once, a monitor on `/api/v1/auth/me` (401 = healthy) |
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
| ~~Moderation basics~~ ✅ 2026-10-20 | necessary the moment the site is public | done as B5a/B5b (ADR 0016): block and mute, reports, an admin role with a queue and suspension |
| ~~Email and sessions in Settings~~ ✅ 2026-10-20 | change the address (confirm the new one first), re-send verification, list of sessions with "sign out this device" | refresh tokens already record user agent and IP |
| ~~Richer posts~~ ✅ 2026-10-21 | several pictures per post, width/height stored at upload (fixes layout shift), link previews after | done as D2: up to four pictures per post in a grid, sizes on every picture, a lightbox for post, chat and profile pictures; link previews stay in `BACKLOG.md` |

## 3. Polish and depth

| Item | Notes |
|---|---|
| ~~**Chat follow-ups**~~ ✅ 2026-10-19 | done as B3b (ADR 0009 amendment 2): message deletion, group admins (rename, remove, promote), system lines, paginated list, "new messages" pill, unread count in the tab title, sound and browser notifications |
| Performance | `zod/mini` browser build, image `srcset`, font preload, route prefetch on hover (E1; the first paint is at 256 of 258 kB since D2) |
| Two-factor authentication (TOTP) | the email flows now exist to recover a lost device; D3, between any two steps of §4 |
| ~~PWA manifest, web push~~ → §4 step 1 | rides on the notifications work; now E2, the first step of growth and play |
| Observability | error tracking (Sentry free tier or self-hosted GlitchTip), a small status page; parked on 2026-10-22 with uptime checks, alerts and dashboards: `BACKLOG.md`, "Monitoring and alerting" |

## 4. Growth and play (agreed 2026-10-22)

After v2.7, what makes a small network worth coming back to: being reachable on the phone, a
newcomer's first minutes, things to do together, and talking. Constraints that shaped the list: one
home box behind a tunnel (no UDP, no inbound ports), a home upload line, a CPU shared with Frigate,
and few members online at once. The slices are Track F of `IMPLEMENTATION_PLAN.md` (§7).

| Step | Item | Why | Notes |
|---|---|---|---|
| 1 | ~~Installable app and web push (E2)~~ ✅ 2026-10-22 | the phone is where members are; calls, game turns and reminders must reach a closed tab | manifest, icons, a push-only service worker, preferences per kind; iPhone push needs the installed app |
| 2 | ~~Invites and an explore feed (F1)~~ ✅ 2026-10-22 | a newcomer's empty feed is the biggest risk of a new network | personal invite links (the invitee follows the inviter), `/explore` with Latest and Popular |
| 2 | Achievements (F2; F2a ✅ 2026-10-22, F2b next) | turns sign-ups into members (the first badges are an onboarding checklist) and rewards welcoming, replying and being worth reading | 120 badges (tiers counted) in seven groups, 22 of them hidden, plus the ones later slices add; no streaks; shown on the profile with a switch |
| 2 | Polls (F3) | the cheapest way to start a conversation | 2–4 options, one vote, a closing time; brings the frequent job runner the later steps need |
| 2 | Weekly digest (F4) | brings back members who drifted away | Monday morning in their time zone, only when there is something to say, one-click unsubscribe |
| 3 | Games that others can watch (F5, F6) | something to do together that fits the realtime platform | a shared engine, Connect Four, then chess with clocks; correspondence play first since few are online at once |
| 4 | Events (F7) | a local community meets | RSVP, reminders, a calendar file, an optional group chat for the people going |
| 4 | Stories (F8) | the light "what are my friends up to" | pictures and text for 24 hours, a ring row, replies in chat; no video |
| 5 | One-to-one calls (F9) | the last thing members leave the app for | WebRTC with a managed relay for the networks that need one; group calls need a media server and wait |
| 6 | Store app (F10) | presence in the stores, native push | a Capacitor shell of the same app, Android first |

Not now: a Bulgarian interface, group calls and live audio rooms, video, a React Native rewrite, and
monitoring (all in `BACKLOG.md`).

## Agreed order (2026-10-22)

**C7 → E2 → F1, F2, F3, F4 → F5, F6 → F7, F8 → F9 → F10**, with D3 between any two steps; one
commit per slice on `dev`, as before. The defaults each slice starts from are in §10 of
`IMPLEMENTATION_PLAN.md` (third round).

## Agreed order (2026-10-16)

The owner picked, to be done directly on `dev` with one commit per item: **legal pages →
mentions and hashtags → post pages and search → chat follow-ups**. All four are done; the
full sequence from here is in `IMPLEMENTATION_PLAN.md`.
