# Android (Track B) — continuation handoff for the Windows Android Studio workspace

**Date:** 2026-11-18 · **Author:** automated session (no Android SDK/emulator here)

This session could **not** run the Pixel 6 emulator loop — this environment has **no `adb`, no `emulator`, and no Android SDK** on PATH. No Android visual or functional PASS is claimed. Below is exactly where Track B stands at source level and the precise steps to finish it on the machine that has Android Studio + SDK.

## 1. Where the Android work lives (do not lose this)
| Item | Value |
|---|---|
| Worktree | `S:/Bispun-mainmerge` |
| Branch | `mobile/stage0-6-deeplinks-a11y` |
| Head commit | `e218e2c` (fix(mobile): Goals card polish …) |
| Local commits ahead of origin | **22, unpushed** — keep them local (brief: no intermediate Android remote pushes) |
| Working tree | clean (only untracked `.idea/` + a doc) — all Android work is committed |
| **Preserve commits** | `4cbb71a` and `e218e2c` — both verified present in this branch's history |

Do **not** push this branch, create new Android branches, or merge it to `main` until its acceptance tests + release-safety gates pass. Do not overwrite it from the referral/Track-A checkout (`S:/Bispun`), which does **not** contain any Android work.

## 2. Verified at source level (no device needed)
- **Web isolation is guaranteed by construction.** `tailwind.config` registers `addVariant('native', '.native &')`; `<html class="native">` is added **only** in `src/main.jsx` when running inside Capacitor. Therefore every `native:`-prefixed utility (85 uses across 12 files) is **inert in any browser** — desktop, mobile-web and tablet web cannot receive the app-only layout. Any Android-only styling that stays behind the `native:` prefix cannot regress the website.
- **Capacitor config:** `appId=com.bispun.crm`, `appName=Bispun`, `webDir=dist`, `androidScheme=http`.
- **Release signing is wired fail-closed:** `android/app/build.gradle` reads `storeFile` from `keystoreProperties` and applies `signingConfigs.release` to the release build. (`versionCode 1` / `versionName "1.0"` — bump before an actual store release.)

## 3. What still REQUIRES the Android Studio machine (blocked here)
Run these in the `S:/Bispun-mainmerge` worktree on the SDK machine:

```bash
# 1. Build the web bundle Capacitor ships
npm install
npm run build

# 2. Sync web assets + plugins into the native project
npx cap sync android

# 3. Build + install the debug APK on the running Pixel 6 emulator/device
cd android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Then perform the device-only verification the brief requires (none of which can be faked here):
- **Per-module overflow sweep** (capture screenshots BEFORE/AFTER) across: Dashboard, Lead Store, Admissions, Domestic/International, Revenue/Finance, My Targets, Team Targets, UTM, Analytics, Referrals, Chats, Counselling, Walk-ins, More, Settings, Help & Support. Check horizontal/vertical clipping, KPI card sizing, touch targets, dropdown overlays, keyboard overlap, safe-area insets, scroll restoration.
- **Navigation timings** (measure, don't guess): bottom-tab switch, More open/close, cross-module nav, Android Back, modal dismiss, long-list scroll.
- **Web-isolation spot check:** load the same build in a desktop browser and confirm the web layout is unchanged (it must be — see §2).

## 4. Known remaining blockers to resolve on-device
- **FCM / push:** verify `mobilePush.js` registration + a real FCM delivery on the emulator (needs `google-services.json` + Firebase project).
- **Issue #11** and **backend integration** (notification deep-links): these depend on PR #43's server changes reaching an environment the app points at — coordinate with Track A (PR #43 is code-ready but merge/deploy is gated on the Pond DB reconciliation).
- **Stage 0–6 + B1 recheck:** re-run after `cap sync` on the fresh APK.

## 5. Do-not-touch
- My Store stays hidden — do not modify/reimplement/push My Store.
- Preserve all permissions, roles, tenant isolation and calculations.
- Keep all Android styling behind the `native:` prefix so the website is never affected.
