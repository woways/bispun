# Bispun Android — Controlled Authentication Verification (read-only)

Date: 2026-11-01 · App `com.bispun.crm` · Dev backend :4000 · DB Neon `neondb`
(endpoint `ep-weathered-credit-axobwesm`, NODE_ENV=development). **No code, data,
emulator app-data, Git, or production changes.** Logging captured only method,
path, HTTP status and timing — never credentials, tokens, cookies, headers, or
bodies.

## Verdict: NOT REPRODUCED — authentication & session persistence work correctly

Under a clean, logged capture — fresh login, session restore, background/
foreground, and a full cold relaunch — there were **zero 401/403 errors** and the
session **persisted every time**. The occasional "returns to login" seen earlier
was **not reproducible** under controlled conditions.

## Evidence

### 0. Logger self-test (known request) — PASS
A harmless page-originated `GET /api/client/auth/me` while logged out was recorded:
`{method:"GET", status:401, path:"/api/client/auth/me", ms:603}` — confirming the
logger captures real WebView traffic before any sign-in.

### 1. Login + session restore — PASS
```
OPTIONS /api/client/auth/login      204   530ms
POST    /api/client/auth/login      200  11856ms   <- login succeeded
GET     /api/client/auth/me         200   3740ms   <- restore OK
GET     /api/client/auth/me         200   2994ms
GET     /api/client/calendar/users          200
GET     /api/client/chat/unread-count       200
GET     /api/client/notifications/unread-count 200
GET     /api/client/years                   200
POST    /api/client/device-tokens/register  200
GET     /api/client/analytics/dashboard     200
GET     /api/client/calendar                200
```
No 401/403 on any protected endpoint. State after login: `path=/app`, token present.

### 2. Background → foreground (no data clear) — PASS
After HOME then re-foreground: protected polls (`chat/unread-count`,
`notifications/unread-count`) returned **200**; state `path=/app`, token present.
Session persisted.

### 3. Controlled relaunch — `am force-stop` + relaunch (no data clear) — PASS
After a full process kill + cold start, the app restored the session from the
stored token: **all** protected endpoints returned **200**
(`calendar/users`, `chat/unread-count`, `notifications/unread-count`,
`device-tokens/register` POST, `analytics/dashboard`, `calendar`, `years`), **no
401/403**. Final state: `path=/app`, token present. **Cold-relaunch persistence
works.**

### 4. Does a genuine 401 correctly force logout? — YES (by design, not triggered here)
`src/lib/api.js:135` clears the token on a real 401, and `src/App.jsx:362` routes
to `/login` — correct for a genuinely expired/revoked session. No spurious 401
occurred during this test, so it was not exercised, but the logic is correct.

## Backend health / DB (item 1)
- `:4000` root → 200; `/api/client/auth/me` (unauth) → 401 (expected). Healthy.
- Dev config: `NODE_ENV=development`, Neon DB `neondb` on dev endpoint
  `ep-weathered-credit-axobwesm`; no production markers. (The literal label
  "bispun-mobile-dev" is the Neon project name, not in the URL — please confirm
  that endpoint is your dev branch if you need the name matched.)
- **Observation:** responses are very slow — login **11.8 s**, dashboard calls
  **5–10 s** (Neon cold-start / latency).

## Most likely explanation for the earlier "returns to login"
No auth bug reproduced. Best-supported, evidence-based causes:
1. **Confirmed test artifact:** my earlier CDP `Page.reload` cleared the in-memory
   state (documented previously).
2. **Stale pre-existing token:** the token present at this session's start came
   from a login in a prior session; once its **8 h** session lapsed, `/auth/me`
   correctly returned 401 → correct logout. (Not a defect.)
3. **Backend latency:** `/auth/me` taking many seconds (or a Neon cold-start
   blip) can **time out / network-error**, and `App.jsx` currently logs out on
   **any** `/auth/me` error — including transient ones — which *looks* like a
   session bug but is backend lag. This is the only real fragility and it did not
   trigger during this (now warm) test.

## Optional hardening (NOT applied — your approval required; preserves security)
Only worth doing to prevent latency-induced logouts; it keeps correct logout on
genuine expired/revoked sessions:
- **`src/App.jsx`** — on a **network error / timeout / 5xx** from `/auth/me`, keep
  the stored token and show a retry/offline state (and retry) instead of logging
  out. Log out only on a real **401/403**.
- **`src/lib/api.js`** (optional) — clear the token only on a **401 from an auth
  endpoint**, so a stray non-auth 401 can't end a valid session.
Files: `src/App.jsx`, `src/lib/api.js` (ref: `server/middleware/clientAuth.js`,
`server/routes/clientAuth.js`).

## Does this block manual QA / merge?
**No.** Session persistence is verified working (including cold relaunch). The
mobile-UI branch touches **no auth file**, so this does not block merging
`feat/mobile-ui-optimization`. Recommend the optional hardening + a faster/warmer
dev backend before extended mobile QA, but it is not a blocker.

**STOP — read-only diagnosis complete. No code changed. Awaiting your approval
before any edit.**
