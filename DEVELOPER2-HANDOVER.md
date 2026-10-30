# Bispun Android — Developer 2 Handover

**Branch:** `feat/mobile-notifications-handover`
**Role split:** Developer 1 = push / Firebase · **Developer 2 (this doc) = native actions + QA**
**Date:** 2026-10-30

---

## 1. Readiness — read this first

Three different things, do not conflate them:

| Area | State | Meaning |
|------|-------|---------|
| Code / build | **Development-complete** | Written, unit-tested, builds, `cap sync` clean. |
| Mobile QA | **QA-ready, not QA-passed** | Needs a device pass (see §6). Cards verified by tests + build only — **not yet seen on a physical device.** |
| Production | **Not production-ready** | Background/closed-app push, tap-navigation, logout token-unregister on device, and a full CRM mobile regression are still untested. |

Nothing here has been committed or pushed without explicit approval.

---

## 2. What changed (grouped exactly as the commits)

- **A — Auth + logout reliability** — `ClientPortal.jsx`, `lib/api.js`, `lib/logoutFlow.js` (+test)
  `clearAuthToken` export/import fixed (was the stuck "Signing out…"); server-logout and push-unregister now dispatch **concurrently** so a hung unregister can't block logout; token cleared exactly once.
- **B — Firebase push plugin loading** — `lib/mobilePush.js` (+`pluginLoad.test.js`)
  `loadPlugin()` resolves to a `{ plugin }` wrapper so the Capacitor proxy's unimplemented `.then()` is never hit by promise adoption. This was why no FCM token was obtained.
- **C — Support Tickets: error state + responsive** — `modules/client/Help.jsx`, `lib/listViewState.js` (+test)
  Single-source load error (`role="alert"` + Retry) ends the "error AND 0 records" contradiction; **mobile card list** (`role="list"`/`listitem`, 44px tap targets) ends the 8-column table clipping in the WebView. Desktop table unchanged.
- **D — chore** — `.gitignore` ignores the two dev-only maintenance scripts.

---

## 3. Verified this session

- Unit tests: **15/15 pass** (`node --test src/lib/*.test.js`).
- Production build: **✓** (`npm run build`).
- Capacitor sync: **✓** (`npx cap sync android`) — plugins `@capacitor/app`, `@capacitor/push-notifications` detected.
- Logout: server-side session revocation confirmed on device earlier.
- FCM: real token registration confirmed; one **foreground** push delivered via the Support-Ticket flow.

---

## 4. Network / API endpoint — config review

**All confirmed correct for a safe dev-vs-prod split:**

1. **Endpoint source** — `src/lib/api.js` reads `import.meta.env.VITE_API_URL` (baked in at build time). No endpoint is hardcoded in components; `ClientPortal.jsx` uses the shared `API_URL`.
2. **Production cannot fall back to a dev host** — `api.js` **throws** `"VITE_API_URL is required in production"` on a PROD build if the value is empty. The `http://localhost:4000` default applies to **dev only**.
3. **No hardcoded `10.0.2.2` / `localhost` in the prod path** — those literals exist only in `.env.example` (a documented template) and the dev-only fallback. A release build uses whatever `VITE_API_URL` you set (e.g. `https://api.yourdomain.com`).
4. **Android network security** — `res/xml/network_security_config.xml` permits cleartext **only** to `10.0.2.2` and `localhost`; it is wired in via `AndroidManifest.xml` (`android:networkSecurityConfig`). Real API domains are not listed, so **all production traffic is HTTPS-only** and a cleartext prod URL would be blocked.
5. **App content scheme** — `capacitor.config.json` sets `server.androidScheme: "http"` (the app's internal `localhost` origin, not external traffic). This is why `localhost` is in the cleartext allow-list. *Hardening option (not now, not a blocker): consider `androidScheme: "https"` for release — test token storage first, as it changes the origin.*

---

## 5. Wi-Fi / connectivity compatibility — REQUIREMENT

> The Bispun Android app must work on normal Wi-Fi, office Wi-Fi, mobile hotspot, and supported mobile data.

### 5a. What was actually observed (stated accurately)

- The **local development backend** connected to `bispun-mobile-dev` successfully **over a mobile hotspot**.
- On a **previous Wi-Fi network**, DNS resolved and the TCP handshake to port 5432 succeeded, but the **PostgreSQL session timed out**.
- This is a **development backend → database** connectivity issue on the developer's laptop. It is **not** evidence of an Android Wi-Fi bug, and **not** a production issue (the production backend runs in a hosting environment with its own egress to the database).

### 5b. Most likely cause of the previous Wi-Fi failure

TCP SYN/ACK succeeded but the PostgreSQL session (which Neon requires over TLS, `sslmode=require`) stalled. That pattern — handshake OK, session timeout — points to the **Wi-Fi network filtering or stalling the TLS/Postgres wire traffic** on 5432: a captive/corporate/public network that permits the TCP connect but drops or resets the TLS negotiation (including possible SNI interference with Neon's pooler routing), or a broken-PMTUD/low-MTU path that stalls the larger TLS ClientHello while small handshake packets pass. The hotspot has no such filtering, so it works.

**Classification: development-only network restriction. NOT a release blocker.**

### 5c. The important architecture point

The **Android app never talks to PostgreSQL directly.** The phone talks only to the **API over HTTPS**; the API talks to the database. So a Wi-Fi network that blocks port 5432 affects the *developer's laptop reaching Neon*, not the *app reaching the API*. The app's Wi-Fi compatibility depends on reaching the **API host over 443**, which normal/office/public Wi-Fi allow.

Per the requirement: do **not** redesign authentication or switch database technology to work around a local Wi-Fi restriction.

### 5d. Safe Wi-Fi vs hotspot comparison test (dev, `.env.development` only)

Run from the project root. Uses only `.env.development`; touches no secrets, firewall, or production.

1. **On the working connection (hotspot):** start the dev backend with `.env.development`; confirm `GET /` → "Bispun API is running"; log in from the app; note it works.
2. **Switch the laptop to the suspect Wi-Fi** (app can stay on its own connection). Restart the dev backend with the **same** `.env.development`.
3. **Read-only reachability probes** (no changes):
   - DNS: resolve the Neon host.
   - TCP: test connect to the Neon host on 5432.
   - App-layer: a single `SELECT 1` through the app's own DB client, with a short timeout.
4. **Compare:** if DNS + TCP pass but `SELECT 1` times out, the Wi-Fi is filtering the Postgres/TLS session → **dev-network restriction**, use the hotspot. If DNS or TCP fail, it's name resolution / port blocking on that network.
5. Record the result in the checklist (§5e). **Do not** disable firewall/AV or change Neon region/credentials to "fix" it.

### 5e. Wi-Fi compatibility test checklist (device QA)

Test the **app reaching the API over HTTPS** — this is the real compatibility surface:

- [ ] Home / normal Wi-Fi — login, dashboard, notifications, logout.
- [ ] Office Wi-Fi — same four.
- [ ] Mobile hotspot — same four.
- [ ] Mobile data (4G/5G) — same four.
- [ ] Public / captive Wi-Fi (coffee-shop style) — login; note if a captive portal blocks the API.
- [ ] **Network switch while in use:** Wi-Fi → mobile data mid-session; badges/counts recover.
- [ ] **Temporary disconnection:** airplane mode ~15s, then back; app recovers without a hard restart.
- [ ] **Reconnection recovery:** after connectivity returns, login still valid, dashboard loads, notification/chat badges refresh, logout completes.
- [ ] Record, separately, any purely **developer-laptop-to-database** Wi-Fi restriction as a **dev note, not a release blocker.**

### 5f. How the app already handles reconnection (code review)

- **Resume refresh:** on `visibilitychange` (web) and native `appStateChange` → active, the app immediately reloads chat + notification counts (`ClientPortal.jsx` ~L1443–1481). Polling pauses while backgrounded/hidden.
- **Fallback polls:** chat 25s, notifications 45s — recover badges even if the socket drops; each `fetch` failure is caught and retried on the next tick.
- **Bounded requests:** `api.js` supports an `AbortController` timeout so a dead connection doesn't hang the UI.
- **Login/logout:** Bearer token cleared on 401; logout clears the local token within its timeout regardless of network.
- **Enhancement (optional, not a blocker):** add a `window` `online` listener to refresh instantly on network-return instead of waiting for the next poll/resume.

---

## 6. Pending for tomorrow (device)

1. Rebuild + install the APK and **eyeball the Support-Ticket mobile cards** on a real phone:
   ```
   cd S:\Bispun\android
   $env:JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-21.0.7.6-hotspot"
   .\gradlew.bat installDebug
   ```
2. **Background / closed-app push** + **tap-to-navigate** into the right module.
3. **Logout device-token unregister** verified against the server on a real device.
4. Run the **§5e Wi-Fi checklist**.
5. Full CRM mobile regression (leads, chat, dashboard, settings).

**P2 (server, not a blocker):** add periodic pruning of expired `ClientSession` / device tokens.

---

## 7. Build / run quick reference

- Web/mobile bundle: `npm run build` → `npx cap sync android`.
- Dev backend: start with `.env.development` only (isolated `bispun-mobile-dev`; background workers disabled).
- Emulator endpoint: `VITE_API_URL=http://10.0.2.2:4000`. Physical phone on same Wi-Fi: `http://<PC-LAN-IP>:4000`. Release: `https://<api-domain>`.
