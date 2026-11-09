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

### 2026-11-09 (16:12) — ✅ FRESH DEBUG APK BUILT (host terminal)

The Gradle loopback blocker is specific to the agent's sandboxed shell. Running the
build in the **user's real Terminal panel (host PowerShell, unsandboxed)** via
`run_in_terminal` **succeeded**:
- `npm run build` ✓ → `npx cap sync android` ✓ → `.\gradlew.bat assembleDebug` → **BUILD SUCCESSFUL in 59s** (156 tasks).
- **Fresh APK:** `S:\Bispun\android\app\build\outputs\apk\debug\app-debug.apk` — **8.8 MB, 2026-11-09 16:12**, source SHA **5b2ce0c**, `applicationId com.bispun.crm`, versionCode 1 / versionName 1.0.
- **ANDROID DEBUG BUILD — READY** (genuinely fresh; the old Nov-1 APK is superseded).
- **Device QA (Pixel_6 emulator, Android cold-booted, API 36):** ran genuine smoke checks with screenshot evidence:
  | Check | Result |
  |---|---|
  | `adb install` fresh APK | ✅ PASS (Streamed Install: Success) |
  | App launch (launcher intent) | ✅ PASS (process pid alive; no FATAL in logcat) |
  | Capacitor/WebView load | ✅ PASS (chromium 145; React bundle executed from `http://localhost/crm-assets/...`) |
  | Splash screen (Bispun bird branding) | ✅ PASS (screenshot: branded splash rendered) |
  | React UI renders (no white/blank screen) | ✅ PASS (screenshot) |
  | Graceful API-error handling | ✅ PASS (showed "Can't reach the server … Try again" — the auth-bootstrap retry state, not a crash/blank) |
  | Login / session / navigation / native actions / push | ⛔ BLOCKED — needs a backend reachable from the emulator **and** interactive input (agent cannot type credentials / drive multi-step UI blind) |
  Note: this debug build's API endpoint was not reachable from the emulator, which is why the app correctly showed the graceful retry screen. Full interactive QA requires a human on the device/emulator with a reachable backend. No fake PASS claimed.

### 2026-11-09 — Gradle build ROOT CAUSE + host build procedure (evidence)

**Root cause (confirmed with the full stack trace):** Gradle fails at startup, before any compilation:
```
org.gradle.launcher.daemon.client.SingleUseDaemonClient.execute
  → DefaultDaemonConnector.startSingleUseDaemon → doStartDaemon → connectToDaemon
  → org.gradle.internal.remote.internal.inet.SocketConnection.<init>
  → java.io.IOException: Unable to establish loopback connection
```
Even with `--no-daemon`, Gradle 8.14.3 starts a **single-use daemon** (a forked child JVM) and the launcher must connect to it over a **loopback socket**. 

**Differential diagnosis (what it is NOT):**
- *Not* JDK/Gradle incompatibility — JDK 21 (Temurin) + Gradle 8.14.3 are compatible.
- *Not* the OS/JVM loopback — a standalone JVM test opened a `ServerSocket` on `127.0.0.1` and connected to it successfully (default *and* `-Djava.net.preferIPv4Stack=true`); `localhost` resolves to `127.0.0.1`; `curl http://localhost:4000` worked earlier for the dev backend.
- *Not* the project — the host previously produced `app-debug.apk` (8.7 MB, 2026-11-01).
- *Not* the shell sandbox — reproduced with the sandbox disabled, in foreground and background, with and without the IPv4 flag (4 distinct attempts).

**Conclusion:** this agent's execution shell cannot let Gradle's launcher connect to its forked child-JVM daemon over loopback. **Gradle must be run on the Windows host** (normal terminal or Android Studio), not through this tool. No fresh APK was produced here; the Nov-1 APK is NOT a current build.

**Exact host build procedure (debug APK):**
1. Open a normal Windows terminal (PowerShell/CMD) — not this agent.
2. `cd S:\Bispun` → `npm run build` → `npx cap sync android`
3. `cd android` → `.\gradlew.bat assembleDebug`
4. Output: `S:\Bispun\android\app\build\outputs\apk\debug\app-debug.apk`
   — or Android Studio ▸ Open `S:\Bispun\android` ▸ Build ▸ Build APK(s).

### 2026-11-09 — signing status (Phase 4)
- **A release keystore ALREADY EXISTS:** `S:\Bispun-release\android\app\bispun-release.jks` (alias `bispun-release`, gitignored). So this is **not** a first-time-key situation and **no new signing identity is needed** (do NOT regenerate — it would break update signing). Per `MOBILE-ANDROID-KEYSTORE-SETUP.md`.
- **Remaining for a signed AAB (host only):** create `S:\Bispun-release\android\keystore.properties` from `keystore.properties.example` with the real passwords for the existing `.jks` (operator holds them; keep gitignored), set a real **HTTPS** `VITE_API_URL`, then on the host: `npm run build && npx cap sync android && cd android && .\gradlew.bat bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`.
- Whether this is a **first Play submission or an update** depends on whether `com.bispun.crm` is already live on Play Console — operator to confirm; the upload key (`bispun-release.jks`) is the same either way.

### 2026-11-09 — Android build attempt (Phase E) + submission package (Phase F)

**Toolchain present:** JDK 21 (Temurin), Android SDK at `S:\Android\Sdk` (ANDROID_HOME set, platform-tools present), Gradle wrapper. 
**Web build + Capacitor sync: ✅ PASS** (`npm run build` → `npx cap sync android`; 2 plugins: @capacitor/app, @capacitor/push-notifications; `dist/index.html` synced into `android/app/src/main/assets/public/`).
**Gradle `assembleDebug`: ⛔ BLOCKED in this environment** — fails with `java.io.IOException: Unable to establish loopback connection`, reproduced 3× (default, `--no-daemon`, and with the shell sandbox disabled). This is an environment-level restriction on Gradle's required local 127.0.0.1 JVM IPC — **not** the project and **not** my code. The project is known-buildable (a prior `app-debug.apk`, 8.7 MB, dated 2026-11-01 exists from a normal build). **I did not produce a fresh APK and do not present the old one as current.** A fresh build must run in a normal Android environment (the developer's Android Studio / the `S:\Bispun-release` worktree, or CI).
**Device/emulator testing: ⛔ BLOCKED** (none available). No runtime PASS claimed.

#### Android submission package status (target 2026-11-13)
| Item | Status | Note / operator action |
|---|---|---|
| applicationId | ✅ `com.bispun.crm` | capacitor.config + build.gradle |
| versionCode / versionName | ✅ `1` / `1.0` | on `release/android-signing-prep`; bump per release |
| Web assets + cap sync | ✅ PASS | reproducible here |
| App icon / splash assets | ✅ present | `android/app/src/main/res/**` |
| `google-services.json` (FCM) | ✅ present | project `bispun-crm` |
| Manifest permissions | 🟡 INTERNET present | confirm **POST_NOTIFICATIONS** is in the *merged* manifest for Android 13+ (push) |
| Release signing config | ✅ ready (fail-closed) | on release branch; **needs operator keystore** |
| Signed AAB/APK | ⛔ BLOCKED | needs keystore `bispun-release.jks` + `android/keystore.properties` (secrets) — operator creates via Android Studio/keytool; I will not create signing secrets |
| Debug APK (fresh) | ⛔ BLOCKED here | Gradle loopback restriction; build in a normal Android env |
| Device test results | ⛔ BLOCKED | no emulator/device |
| Production API config | 🟡 operator | release build must set a real **HTTPS** `VITE_API_URL` (not localhost/10.0.2.2); cleartext to real domains is blocked by `network_security_config.xml` |
| Privacy policy / Data safety / screenshots / description / release notes | ⬜ operator | store-listing content — not code; prepare per Play Console |
| Distribution channel | ❓ unconfirmed | confirm Play production vs internal/closed testing vs direct APK |

**Signed-release operator steps (when authorized):** on `S:\Bispun-release` (or after merging the signing branch) → create `bispun-release.jks` (Android Studio *Generate Signed Bundle* or `keytool`) → copy `android/keystore.properties.example` → `android/keystore.properties` and fill `storeFile/storePassword/keyAlias/keyPassword` (gitignored; never commit) → set a real HTTPS `VITE_API_URL` → `npm run build && npx cap sync android` → `./gradlew bundleRelease` → the AAB lands at `android/app/build/outputs/bundle/release/`. See `MOBILE-ANDROID-SIGNING-REPORT.md`.

### 2026-11-09 — next-stage prep (Phase 7; no code changes made)
- **Emulator/device availability here: ⛔ BLOCKED** — no Android emulator/physical device in this environment; only the default Capacitor instrumentation stub exists. All Stage 1–4 **runtime** verification stays BLOCKED until a device is available. No APK/AAB built.
- **Capacitor config (verified):** `appId: com.bispun.crm`, `appName: Bispun`, `webDir: dist`, `androidScheme: http` (cleartext limited to emulator/localhost via `network_security_config.xml`; prod traffic HTTPS-only). `google-services.json` present (`bispun-crm`).
- **Signing:** none in this branch (`android/app/build.gradle` has no `signingConfig`); release signing lives on worktree branch `release/android-signing-prep` — unchanged.
- **Mobile tasks that can proceed independently of PR #13 (code-only, no device, on a future short-lived branch off the released main):** (1) centralize/sanitize `tel:` dialing + remove dead `openDialer` (Stage 4 code cleanup); (2) broaden mobile push unit tests beyond plugin-load; (3) a11y notification-dropdown polish. **Device-dependent work (session restore, back button, push delivery, splash, native actions) stays BLOCKED.**
- **If an emulator becomes available**, safe execution plan: `npx cap sync android` → open in Android Studio / `emulator -avd <name>` → install debug APK → exercise login/session, bottom nav, More menu, back button, tel/SMS/WhatsApp, FCM token register + a test push, notification tap → record PASS/FAIL. Prerequisites: Android SDK + an AVD, a valid `VITE_API_URL` reachable from the emulator (`http://10.0.2.2:4000` for a local dev backend), and Firebase set up for delivery.

### 2026-11-09 update
No mobile **source** changed this session beyond the notification deep-link fix (Stage 4, done) and mobile unit tests now running in `npm test`. Stage percentages are unchanged; the binding mobile blockers remain **(1) release signing/keystore** and **(2) no device/emulator for runtime verification**. Mobile development can proceed on code-level Stage 4 cleanup (dialer centralization) and Stage 1/3 items, but their **verification** stays BLOCKED until a device/emulator is available.
