# Bispun — Integration APK Build & Verification Report

**Date:** 2026-11-10
**Branch:** `integration/pr13-main-20261110`
**Source SHA:** `f832936cb855ac4ecaaf37714cd2432f82a018f7`
**Worktree:** `S:\Bispun-pr13-integration`
**Author:** santoshikothakota (via Claude Code)

This records the authorized **local** integration build, install, runtime
verification, and signed-AAB readiness. No merge, no deploy, no migrations.

---

## 1. Pre-build state

- GitHub synced: local `main` fast-forwarded to `origin/main` `29283ec` (10 commits,
  no local-only commits). `main` NOT merged into the integration branch.
- Integration worktree clean, HEAD = `f832936` (matches expected).
- Dev API URL for emulator: **`http://10.0.2.2:4000`** (`10.0.2.2` = emulator alias
  for the host's `localhost`; confirmed against `.env.example`).

## 2. Web build

- Command: `VITE_API_URL=http://10.0.2.2:4000 npm run build`
- Result: **✓ built in 33.22s**, `dist/index.html` present.
- Baked API URL verified in `dist/crm-assets/*.js`: `http://10.0.2.2:4000`
  (the `http://localhost:4000` literal is the inert fallback in `src/lib/api.js`,
  never reached because `VITE_API_URL` is set).

## 3. Capacitor sync

- Command: `npx cap sync android` → **✓ Sync finished in 0.413s**
- Plugins: `@capacitor/app@8.1.2`, `@capacitor/push-notifications@8.1.3`

## 4. Gradle build (Windows host)

- Command: `.\gradlew.bat assembleDebug --console=plain` (cwd `…\android`)
- Result: **BUILD SUCCESSFUL in 3m 19s — 155 actionable tasks, 155 executed.**
- Non-fatal notes only: `flatDir` warning (Capacitor), unchecked/deprecated API
  notes (plugin code), `libdatastore_shared_counter.so` not stripped (packaged as-is).

## 5. APK metadata

| Field | Value |
|---|---|
| Path | `S:\Bispun-pr13-integration\android\app\build\outputs\apk\debug\app-debug.apk` |
| Size | 8,995,021 bytes (~8.6 MB) |
| Built | 2026-11-10 21:15:35 IST |
| package | `com.bispun.crm` |
| versionCode / versionName | `1` / `1.0` |
| minSdk / targetSdk / compileSdk | 24 / 36 / 36 |
| label | Bispun |
| Source SHA | `f832936` |

## 6. Emulator install (Pixel_6)

- Device: `emulator-5554` (AVD `Pixel_6`), booted (`sys.boot_completed=1`).
- Prior QA build (`com.bispun.crm`) was present → installed with `adb install -r`
  (**replace, app data preserved**). Result: **Success.**
- Dev backend started on host `:4000` (`npm run server`), workers DISABLED
  (`DISABLE_BACKGROUND_WORKERS=true`), SMTP cleared for the session (no outbound).
  DB = Dev `ep-blue-mouse` (NOT pond). Health: `GET /api/health` → 200,
  `{"database":"connected"}`.

## 7. Runtime evidence (non-destructive)

- App launched; `com.bispun.crm/.MainActivity` is the top resumed activity.
- **No crash / FATAL / ANR** for the app process (pid 3174). The
  `net::ERR_NAME_NOT_RESOLVED` logcat lines are from the emulator's own Google
  services (pids 1300/1445), not the app.
- Capacitor loaded the SPA at `http://localhost`, assets served, app resumed.
- **Backend connectivity CONFIRMED:** the app called `GET /api/client/auth/me`
  → `401` (×2) on the Dev backend via `10.0.2.2:4000`, the correct unauthenticated
  response → app routed to the login screen.
- Login screen rendered correctly (BISPUN logo, "Welcome back!", Work Email,
  Password w/ show-hide, Remember me, Forgot password, Sign in). Screenshot captured.
- One **non-fatal** JS console error: `Error injecting safe area CSS: TypeError:
  Cannot read properties of null (reading 'style')` (safe-area inset injection runs
  before an element exists). Does not block the app. Pre-existing; carried in unchanged.
- No login was performed (out of non-destructive scope; no credentials entered).

## 8. Automated tests

- `npm test` in the integration worktree: **86 pass, 0 fail** (2.86s).

## 9. Difference vs the prior 19/19 manual QA

- The **19/19 PASS** was USER-REPORTED on the **previous (pre-integration)** build.
- On **this** integration APK (`f832936`) the following were INDEPENDENTLY verified:
  build, install, launch, splash→login render, backend connectivity (401 auth check),
  no crash, 86/86 automated tests.
- The 19 functional test cases were **NOT** repeated on this build, so they are
  **NOT** claimed as passed here. A fresh manual pass is recommended before release.

## 10. Signed AAB readiness (HOLD — not built)

> **UPDATE (signing config now integrated):** release signing is now wired into
> `android/app/build.gradle` (fail-closed, from `keystore.properties`) — see
> **MOBILE-ANDROID-SIGNING-REPORT.md** for the config details, verification, and the
> operator-only steps to build the signed AAB. Item 1 below is now RESOLVED.

Blocking items for a signed release bundle:

1. **~~Release signing is NOT configured~~ — RESOLVED.** `android/app/build.gradle` now
   defines `signingConfigs.release` (populated only when a gitignored
   `android/keystore.properties` exists), attaches it to `buildTypes.release` only when
   present, and **fails closed** on `assembleRelease`/`bundleRelease` without credentials
   (never unsigned / debug-signed). Debug builds unaffected. Verified via dry-runs + a full
   `assembleDebug`. Integrated from `release/android-signing-prep` commit `47396dd`.
2. **Existing keystore required.** No `*.jks` is present in the repo or parent dirs
   (correctly gitignored). Operator must supply the existing `bispun-release.jks`
   path + passwords at build time. **Do NOT create a new keystore. Do NOT commit or
   expose passwords.**
3. **versionCode/versionName = 1 / 1.0** — fine for a first Play upload; bump
   `versionCode` for every subsequent upload.
4. Confirm **Play App Signing** enrollment (Google re-signs; `bispun-release.jks`
   is the upload key).
5. Once (1)–(2) are ready, operator runs: `.\gradlew.bat bundleRelease`
   → `app/build/outputs/bundle/release/app-release.aab`.

## 11. HOLD compliance (all intact)

- PR #13 merge into `main`: **HELD** (`main` = `29283ec`, untouched).
- Production deployment: **HELD.**
- Calendar migration `0007`: **HELD** (not applied).
- Production `AccountDeletionRequest` migration `0008`: **HELD.**
- Other Production migrations: **HELD.**
- Branch/worktree deletion: **HELD.**
- Google Play submission: **HELD.**
- Production `pond` DB: **UNTOUCHED** (all work on Dev `blue-mouse`).
- No new signing keystore created. No DB migrations run (no `migrate deploy`,
  `db push`, or repair).
