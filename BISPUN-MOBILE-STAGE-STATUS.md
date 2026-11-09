# Bispun CRM — Mobile (Capacitor Android) Stage Status

**Date:** 2026-11-09 · **Branch:** `feat/bispun-audit-fixes-mobile-completion` @ base `2aceef9`
**Companion to:** `BISPUN-IMPLEMENTATION-STATUS-2026-11-09.md` (Area G)

> **Architecture:** Bispun mobile is the **same responsive React SPA** wrapped by **Capacitor 8** for Android/iOS — there is no separate mobile code tree. "Mobile" = responsive UI (`lg:hidden` components) + native plugins (`@capacitor/app`, `@capacitor/push-notifications`). Backend authorization & tenant isolation are shared with web (unchanged).
>
> **Percentages are code-completeness estimates from static evidence.** Runtime behaviour is **BLOCKED** — no Android emulator/device is available in this environment, and the only instrumentation test is the default Capacitor stub. No device test has been run or faked.

| Stage | Code complete | Runtime verified | Release-ready |
|---|---|---|---|
| 0 — Architecture & Feature Audit | ~100% | n/a (analysis) | ✅ |
| 1 — Performance & Reliability | ~75% | ⛔ BLOCKED | ❌ unverified |
| 2 — Splash & Launch | ~80% | ⛔ BLOCKED | ❌ unverified |
| 3 — Mobile UI / UX | ~90% | ⛔ BLOCKED | ❌ unverified |
| 4 — Native Capacitor Integration | ~70% | ⛔ BLOCKED | ❌ **signing blocker** |

---

## Stage 0 — Architecture & Feature Audit  (~100%)
- ✅ Existing CRM features inventoried (see Area H: 17/17 modules). Desktop/Mobile separation understood (responsive + Capacitor; no forked code). Security boundaries preserved (same backend guards). Architecture documented here + in Area G.
- **Remaining:** none (assessment stage).

## Stage 1 — Performance & Reliability  (~75% code, runtime BLOCKED)
- ✅ Fast login + session restoration: `App.jsx:387-453` (`/auth/me` bootstrap, token in localStorage, bounded retry vs 401 — avoids false logout on cold Neon/Render start).
- ✅ Reliable logout: `logoutFlow.js` (concurrent push-unregister + server logout, token cleared exactly once, bounded navigation) — **8 unit tests PASS**.
- ✅ Fast module navigation: state-based (`setModule`), no route reloads; `moduleHistoryRef` stack.
- 🟡 **State preservation across module switches: UNVERIFIED** — modules are lazy chunks; whether they unmount/lose state on switch is not evidenced. No keep-alive cache layer or explicit refetch-dedup found; cache invalidation on logout relies on token clear.
- **Remaining:** verify state preservation + refetch behaviour on device; add a lightweight cache/keep-alive if refetches are excessive. **Blocker:** no device.

## Stage 2 — Splash & Launch  (~80% code, runtime BLOCKED)
- ✅ Native Android 12 SplashScreen via theme (`styles.xml:19-21`, `@drawable/splash`, androidx core-splashscreen) — brand assets present across density/orientation/night folders. (Not the `@capacitor/splash-screen` plugin — deliberately absent.)
- ✅ Returning authorized user → Dashboard, signed-out → Login (auth bootstrap decides).
- 🟡 **"Three-dot subtle loading animation"** during launch/auth bootstrap: a loading screen exists (`App.jsx` bootstrap states) — confirm it matches the intended three-dot treatment; not verified visually.
- ❓ No JS control of splash hide-timing (native theme only) → cannot programmatically avoid a blank frame between native splash and first paint; needs device check.
- **Remaining:** visually confirm launch sequence (no blank screen, correct animation). **Blocker:** no device. Any switch to the Capacitor splash plugin would be a **new dependency → approval-gated.**

## Stage 3 — Mobile UI / UX  (~90% code, runtime/visual BLOCKED)
- ✅ Bottom navigation (`mobileUi.jsx:312-359`), permission-filtered tabs + More menu (`ClientPortal.jsx` More sheet), safe-area insets, `aria-current`.
- ✅ Mobile presentation layer (BottomSheet, record cards, filter sheets) gated `lg:hidden`; ≥44–48px tap targets; `<dl>` field semantics.
- ✅ KPI/stat grids responsive (`Dashboard.jsx` grid breakpoints).
- 🟡 Readability / animation smoothness: author cites a manual "Stage 1 a11y review"; no automated a11y test (no axe/jest-axe). Visual QA pending.
- **Remaining:** visual pass on real viewport sizes; optional automated a11y checks. **Blocker:** no device (static/responsive can be partly checked in a browser preview).

## Stage 4 — Native Capacitor Integration  (~70% code, BLOCKED + signing blocker)
- ✅ Android hardware back: `BackButtonHandler.jsx` + `backStack`/`moduleBack` — **14 unit tests PASS**; native `App.backButton` wiring + `exitApp` path untested on device.
- ✅ Firebase push code complete (`mobilePush.js`): lazy plugin load (proxy `.then` workaround — **test PASS**), channel, token register/unregister, **tap navigation now resolves lead deep-links** (this session's fix). `google-services.json` present (`bispun-crm`).
- 🟡 Native actions: WhatsApp/SMS wired (`nativeActions.js`), but `openDialer` is **dead code**; dialing uses raw `<a href="tel:">` without sanitization.
- ⛔ **Push delivery / permission / tap routing: BLOCKED** (needs device + Firebase test account).
- 🔴 **Release signing: BLOCKED (release blocker)** — `android/app/build.gradle` release block has **no `signingConfig`**; no keystore in repo. A debug APK builds in principle; a signed Play AAB cannot.
- **Remaining:** add signing config + keystore (kept out of VCS — **approval-gated**); centralize/sanitize dialing; on-device verification of back/push/actions/lifecycle.

---

## Critical mobile blockers (in priority order)
1. 🔴 **Release signing/keystore missing** — blocks any Play-ready build. (Approval-gated: keystore + secrets.)
2. ⛔ **No device/emulator here** — all native runtime behaviour unverified (push delivery, back button, splash, native actions, cold-start restore). Requires manual on-device QA.
3. ⚙️ **Firebase delivery creds** (`FIREBASE_SERVICE_ACCOUNT`/`GOOGLE_APPLICATION_CREDENTIALS`) undocumented/unvalidated → push is a silent no-op until set.
4. 🟡 **Mobile unit tests not in CI** — `package.json` `test` runs only 4 of 9 files; the 4 mobile/UI suites pass manually but won't catch regressions in `npm test`.

## Resume point for mobile development
Earliest incomplete **mandatory** stage with actionable, un-gated code work: **Stage 4 native cleanup** (centralize/sanitize dialing; wire mobile tests into CI) and **Stage 1/3 verification** (needs a device). The signing config and any splash-plugin addition are **approval-gated**. Recommend: finish the web P0/P1 items + migration first (per overall priority), then a dedicated on-device QA pass to convert the BLOCKED runtime items to PASS/FAIL.

---

## Release readiness snapshot (updated 2026-11-09, after migration applied)
- **WEB:** NOT READY — Users & Roles unblocked (migration applied); remaining: config provisioning (Google/Firebase creds) + lead-visibility hardening completion.
- **BACKEND:** NOT READY — boots & DB-connected in Dev; needs Google/Firebase creds for those features in Prod.
- **DATABASE (Dev):** ✅ **READY** — `0002` applied to blue-mouse, Prisma Client regenerated, data layer verified. (Prod migration still requires separate authorization.)
- **ANDROID:** NOT READY — no release signing/keystore; all native runtime unverified (no emulator). Notification tap deep-links to the exact lead (code done); mobile tests now in CI.
- **PRODUCTION:** NOT READY — separate prod migration + config authorization required; nothing merged to `main`.

### 2026-11-09 update
No mobile **source** changed this session beyond the notification deep-link fix (Stage 4, done) and mobile unit tests now running in `npm test`. Stage percentages are unchanged; the binding mobile blockers remain **(1) release signing/keystore** and **(2) no device/emulator for runtime verification**. Mobile development can proceed on code-level Stage 4 cleanup (dialer centralization) and Stage 1/3 items, but their **verification** stays BLOCKED until a device/emulator is available.
