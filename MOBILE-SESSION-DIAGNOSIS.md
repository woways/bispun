# Bispun Android — Login Session Persistence Diagnosis (read-only)

Date: 2026-11-01 · Branch: `feat/mobile-ui-optimization` · App `com.bispun.crm` ·
Backend dev :4000 · DB `bispun-mobile-dev`. **No code was changed.**

## TL;DR
The app logs out whenever the startup call `GET /api/client/auth/me` (or any
`apiRequest`) returns **401**: `src/lib/api.js` then deletes the stored token and
`src/App.jsx` treats any `/auth/me` error as "not authenticated" → `/login`. That
is correct for a *genuine* 401, but it is **fragile** — a single stray/transient
401 destroys an otherwise-valid 8-hour session. **I found no code defect that
makes a valid session 401 early, and the one logout I can fully attribute was
caused by my own test tooling (a CDP page reload).** A persistent, newly-
introduced auth bug is **NOT confirmed**, because the capture below recorded **no
login** (the session wasn't reproduced in the window).

## Evidence (read-only)
- **Token storage is correct and persistent.** Stored in `localStorage` as
  `cb_auth_token` (`api.js:20,32`). Other `cb_*` keys persist across reloads, so
  localStorage works. The token is **currently absent** → it was cleared.
- **Token is cleared only on logout or 401** (`api.js:133-137`). You didn't log
  out → a **401 cleared it**.
- **Lifetimes are consistent.** JWT `expiresIn: "8h"` (`clientAuth.js:809`) and DB
  session `expiresAt = now + 8h` (`clientAuth.js:682`). So **not** premature expiry.
- **Bearer auth is wired correctly.** Middleware accepts cookie *or* Bearer
  (`middleware/clientAuth.js:33-37`); login **returns** the token in the body
  (`clientAuth.js:822-828`).
- **No auto-revoke.** Concurrent logins are allowed; a new sign-in only *counts*
  other sessions to send an alert (`clientAuth.js:747-765`). Session cleanup
  **never deletes active sessions** (`clientAuth.js:953-978`, 90-day history only).
- **JWT secret is stable.** From env (`lib/env.js:18`, `JWT_SECRET` set in
  `.env`/`.env.development`), so the dev server's `node --watch` restarts (on file
  edits) do **not** invalidate existing tokens, and DB sessions survive restarts.
- **Correct backend.** The APK's built JS targets `http://10.0.2.2:4000` (from
  `.env`); the `localhost:4000` string in the bundle is only the dead fallback.
- **Startup logs out on ANY `/auth/me` error** (`App.jsx:346-362`) — including a
  transient 401 — and api.js has already wiped the token by then.

## Live capture result
A 150 s read-only network capture (method/path/status only — no tokens, bodies or
query strings) recorded **only the `/login` page and zero `/api/` calls** — i.e.
**no login happened** during the window. So the specific failing request was not
observed, and the drop-to-login was **not reproduced under capture**.

## Answers to the requested items
1. **Did QA login succeed before returning to `/login`?** Unconfirmed from
   evidence — no login was captured. (At this session's first launch, auto-restore
   to the Dashboard *did* work, so a valid session existed then.)
2. **Logcat / backend auth logs.** Logcat shows no app network/auth lines (the
   WebView doesn't log them). The dev backend isn't running in a readable terminal
   tab here, so its 401 logs weren't accessible.
3. **401/403 endpoints.** Not captured live. Mechanism: a 401 from `/auth/me` (or
   any `apiRequest`) triggers the logout.
4. **Token store/restore in the WebView.** Store = `localStorage` (correct,
   persistent). Restore = `GET /auth/me` on startup with the Bearer token.
5. **Login/logout/startup/persistence logic.** Reviewed; internally consistent.
6. **CDP reloads / WebView restarts / lifecycle.** The **first** logout this
   session was caused by **my CDP `Page.reload`** (a test artifact). Later returns
   to `/login` followed app relaunch (`am start`) and the WebView being backgrounded
   while you switched apps; both reload the WebView, which re-validates via
   `/auth/me`. `node --watch` restarts do **not** invalidate sessions.
7. **Is an API failure clearing a valid session?** **Yes — this is the real
   fragility.** `api.js` clears the token on *any* 401, and `App.jsx` logs out on
   *any* `/auth/me` error, so one transient/stray 401 ends a valid session.
8. **Correct dev backend?** **Yes** — `http://10.0.2.2:4000`.
9. **B1/B2/B3/B3.1 + UI redesign preserved?** Yes — nothing was edited.
10. **Bug vs artifact.** The confirmed logout was a **test artifact** (my CDP
    reload). The rest are consistent with **expiry of a pre-existing token** (it
    came from a login in a prior session, possibly hours earlier) and/or a
    **transient cold-start `/auth/me` 401** — **not** a defect introduced by the
    mobile-UI branch, which **touches no auth file**. A genuine persistent auth
    bug is **unconfirmed**.

## Root cause (best supported)
No new auth bug is proven. The symptom is the **combination** of (a) my CDP reload
(artifact) and (b) the app's **fragile logout-on-any-401 / logout-on-any-/auth/me-
error** behaviour acting on an expired or transiently-rejected session. The mobile
UI changes are not implicated.

## Reproducible?
**Not reproduced** under controlled capture (no login occurred). To confirm the
exact trigger we need **one live login while capturing** — if it then drops to
`/login`, the capture will name the failing endpoint; if it stays, the earlier
drops were artifacts.

## Smallest safe fix (proposed — NOT applied; needs your approval)
Only worth doing if a real post-login 401 is confirmed:
- **`src/lib/api.js`** — clear the token only on a 401 from an **auth** endpoint
  (`/auth/login`, `/auth/me`, `/auth/logout`), not from arbitrary endpoints, so one
  stray non-auth 401 can't nuke a valid session.
- **`src/App.jsx`** — on a **network error or 5xx** (not a clean 401) from
  `/auth/me`, keep the token and retry / treat as "offline" instead of logging out.

These reduce *spurious* logouts without hiding a genuinely expired/invalid session
(logging out is correct then). **Files involved:** `src/lib/api.js`, `src/App.jsx`,
`server/middleware/clientAuth.js`, `server/routes/clientAuth.js`.

## Does this block manual QA / merge?
- **Mobile QA:** Partially — you can QA by logging in and working promptly, but the
  app may log you out on restart/backgrounding. The **A/B UI fixes are independent
  of auth** and testable in a single session.
- **Merging `feat/mobile-ui-optimization`:** This session behaviour is **pre-
  existing** (from the mobile-auth/notifications work) and **not caused by the UI
  branch**, so it does not block that branch on its own merits — but you should
  confirm/harden it before relying on extended mobile QA or production.

**STOP — no code changed, nothing committed/pushed/merged. Awaiting your approval
before any edit.** To nail the exact endpoint, say the word and I'll re-run the
capture while you log in.
