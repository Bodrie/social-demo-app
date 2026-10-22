# 0022 – Web push, tied to the sign-in it was made under

Date: 2026-10-22 · Status: Accepted · Plan: `IMPLEMENTATION_PLAN.md` E2 (step 1 of Track F)

## Context
Notifications (ADR 0015) and messages reached a member only while a tab was open: the socket
pushed them, and B3b's browser notification needed a hidden but open tab. The later steps of
Track F (game turns, event reminders, incoming calls) need to reach a closed app, and an app
on the home screen with notifications is most of what members mean by "a real app".

Web push sends to a URL at the browser vendor's push service (an *endpoint*), with keys the
browser made. Four things were not settled by the platform:
- **Whose device it is.** A browser holds one subscription per site, whoever is signed in. The
  sessions are refresh-token chains whose rows change at every rotation, so "this device's
  session" had no stable id. A device signed out (by its owner, from another device, by a
  password change) would otherwise go on receiving message previews.
- **Where the server posts.** The endpoint comes from the client. Taken as given, any member
  could make the API send requests to an address of their choosing.
- **Who shows what.** An open tab already alerts in its own way (the bell, chat bubbles, B3b's
  notification for a hidden tab); push must not double it.
- **Speed.** A push service answers in tens to hundreds of milliseconds and sometimes not at
  all. Domain events are awaited by the request that raised them (ADR 0015).

## Decision
- **Sign-ins get an id.** `refresh_tokens.sign_in_id` is new at sign-in and carried along the
  rotation; the access token carries it as `sid` (`AuthUser.signInId`). A subscription stores
  the sign-in it was made under. Whenever sessions end (sign-out, "sign out this device", a
  password change, sign out everywhere, the theft response, a suspension), `RefreshTokensService`
  emits `SessionsEndedEvent` and the subscriptions whose sign-in has no live refresh token are
  deleted at once. A daily job does the same for sign-ins that simply expired. Tokens from
  before the change carry no `sid`; the push route answers them 401, which the web client meets
  with one refresh and a retry.
- **Only known push services.** `pushSubscriptionSchema` (shared) accepts https endpoints at FCM
  (Chrome and the Chromium family), Mozilla's service, Apple's and Microsoft's (`*.notify.windows.com`),
  without ports or credentials. A member keeps at most ten devices, the ones seen longest ago go.
- **The tab first, the service worker otherwise.** The service worker (`/sw.js`, push only,
  no caching, no fetch handling) shows a push only when no window of the app is visible. A
  message's push uses the tag of B3b's tab notification (the conversation id), and where this
  browser has push on, `MessageAlerts` leaves the system notification to the service worker. A
  click focuses an open window and routes it in place (`postMessage`), or opens a new one.
- **Detached sending.** `PushListener` starts the delivery and returns; failures are logged. A
  404 or 410 from the push service deletes the subscription; anything else is logged and kept.
  Messages go with `urgency: high` and a topic per conversation (only the newest one waits for
  an offline device), notifications with `normal`; both live for a day at the push service.
- **What a push says.** Notifications: the actor as the title and the same words as the web,
  from `NOTIFICATION_PHRASES` in shared (the web's `NotificationText` now reads them too).
  Messages: the sender (and the group's name), the text or "Sent a picture", or only
  "New message" when the member switched previews off. The payload is encrypted for the browser
  (RFC 8291), so the push service cannot read it.
- **Choices.** Per device: on or off, i.e. a subscription or none. Per account
  (`users.settings`): `pushMessages`, `pushSocial`, `pushPreviews`, all on by default.
  `localStorage` notes which member switched push on in a browser, so another member signing in
  there drops the subscription instead of receiving pushes.
- **Keys.** VAPID from `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: all three or none,
  none means push is off (Settings says so; nothing is stored or sent). If the keys are ever
  replaced, a browser whose subscription was made with the old public key subscribes again the
  next time the app opens, without asking.
- **Installable.** `manifest.webmanifest` with the icons `pnpm brand` draws (a maskable one with
  the mark inside the safe circle, a monochrome badge), the browser's install offer kept for
  Settings and the account menu, and the "Add to Home Screen" note on iPhone and iPad, where push
  works only for the installed app.

## Consequences
- The API posts to third-party push services; the privacy notice names them.
- A device that has not opened BeSo for longer than a refresh token lives (7 days) stops getting
  pushes, like any signed-out device; opening the app and signing in brings them back.
- Push subscriptions are device addresses like sessions: not in the account export, erased with
  the account (cascade).
- The web suite cannot drive a real push service; the Playwright browser (Chromium's headless
  shell) has no notifications at all. The flows are covered by the web tests with a stubbed
  browser and by the integration tests with a fake sender.
