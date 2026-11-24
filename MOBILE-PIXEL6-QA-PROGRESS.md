# Bispun CRM — Pixel_6 emulator QA progress (2026-11-02)

**The current code is installed and verified on a fresh emulator, and the app runs.** Pre-auth QA passed;
authenticated QA is gated on a dev login (secure entry — see bottom). No production data touched; no
push/merge/deploy; no messages/calls/notifications sent.

## Phase 1 — Emulator setup ✅ (with one correction)
- A fresh `Pixel_6` AVD exists and is running as **`emulator-5556`**, booted, Google Play services present
  (`com.google.android.gms`), ~2.3 GB free RAM.
- **Correction:** it is **API 37**, not API 34 — the API-34 system image was never downloaded (only
  `android-37.0` is on disk). **That turned out not to matter:** the real blocker was the *stale*
  `emulator-5554` instance's degraded PackageManager, **not** the image. A **fresh** instance installs
  fine, so no API-34 download is needed.
- Old `Medium_Phone_API_37.0` (`emulator-5554`) left untouched/preserved.

## Phase 2 — Build inputs ✅ PASS
| Check | Result |
|---|---|
| Source | APK from `S:/Bispun-integ @ 70b8209` (integration/mui-yc); ancestor of QA branch `test/bispun-final-qa-android` (`c349759`) — same source |
| APK = current code | ✅ bundle `index-CUYxkEyj.js` = current `dist` |
| `VITE_API_URL` | ✅ `http://10.0.2.2:4000` baked (localhost:4000 only empty-env fallback) |
| Dev DB | ✅ `ep-blue-mouse-b4if0xzj` (blue-mouse), **not** pond |
| Workers | ✅ `DISABLE_BACKGROUND_WORKERS=true` |
| Firebase | ✅ `google-services.json` = `com.bispun.crm` / project `bispun-crm` |
| Secrets in APK | ✅ none — no DB URL / `postgres://` / `neon.tech` (the "pond" grep hits were `corresponding`/`responder`) |

## Phase 3 — Install on Pixel_6 ✅ PASS
- One `adb install -r -d` on fresh `emulator-5556` → **Success**, `lastUpdateTime 2026-11-02 20:09`.
- **Content-verified:** installed bundles exactly match the fresh APK (`index-CUYxkEyj.js`,
  `index-Shi6WLnH.js`, `index-BMg-ggkW.css`) — not timestamp-only.

## Phase 4 (pre-auth) — ✅ PASS
| Item | Result |
|---|---|
| Loads past splash | ✅ reaches login, no white/blank screen |
| Login screen render | ✅ logo, Welcome back!, Work Email + Password (eye toggle), Remember me, Sign in, Contact support — no horizontal overflow, safe areas respected |
| Crash on launch | ✅ none (`com.bispun.crm` no FATAL) |

**Two environment artifacts (not app bugs), documented so they aren't mistaken for defects:**
1. **"System UI isn't responding" ANR** right after first boot — the fresh emulator was CPU-thrashing
   (app at 76%→66% CPU, heavy page faults) during first load. Subsided after settling; the Bispun app's
   own webview kept running behind it.
2. A momentary **blank screen** during my input probe — logcat showed `killDueToPackageUpdate` / `pkg
   removed` at 20:09:54, i.e. **the package was re-installed at that instant** (a second Android Studio
   **Run**), which force-stopped and relaunched the app. Memory was healthy (not a low-memory kill). The
   app recovered to a clean login screen; installed build re-verified as current code.

## Phase 8 (preview) — release-readiness gaps
- ✅ `applicationId com.bispun.crm`, `versionCode 1`/`versionName 1.0`, min 24 / target 36.
- ✅ `POST_NOTIFICATIONS` present in the **merged** manifest (Capacitor push plugin injects it; also
  `WAKE_LOCK`, `BIND_JOB_SERVICE`) → Android-13+ notification-ready.
- 🔴 **No release keystore** — only debug signing (`signingConfigs` absent). Required before any
  Play/production build.
- 🔴 **No `.env.production`** — a release build would not point to `https://api.bispun.com` (falls back to
  the dev/localhost URL). Needs `VITE_API_URL=https://api.bispun.com` for release.

## BLOCKER — dev QA login (secure entry needed)
There are **no usable test credentials in the repo**: `prisma/seed.js` takes passwords from env
(`SEED_SUPER_ADMIN_PASSWORD`) and seeds real admin emails (`admin@consulbuzz.com`,
`admin@studentmentor.co.in`) — real accounts, not synthetic QA users, and I won't use a real admin
account.

**To continue (login, Dashboard, nav, Lead Store, Smart Nurture, Dial & Track, Chat, Calendar, modules,
FCM, Chat/OTP/Billing/Nurture) I need you to log in on the emulator yourself** — the secure method, since
I never see the password:
1. Click the **`emulator-5556` (Pixel_6)** window on your desktop.
2. Type your **dev QA** email + password into the fields, tap **Sign in**.
3. Please **don't click Run in Android Studio again** while I test (it reinstalls and restarts the app).
4. Tell me when the Dashboard loads — I'll resume the full automated QA sweep from there.
