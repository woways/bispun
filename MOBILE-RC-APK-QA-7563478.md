# Bispun Android — Debug APK Build & Pixel_6 QA (RC 7563478, 2026-11-11)

Fresh **debug** APK from the consolidated RC. Development configuration only. No signed AAB, no Play
submission, no Mobile-worktree changes.

## Build
- **Source SHA:** `7563478cbd24bfbd7f35deffe0a7f79acd4624fe` (branch `rc/consolidated-release-20261110`, clean worktree)
- **Config:** `VITE_API_URL=http://10.0.2.2:4000` (dev/emulator backend only) · `appId com.bispun.crm` · `androidScheme http`
- **Steps:** `vite build` (exit 0, 2768 modules) → `npx cap sync android` (exit 0; plugins @capacitor/app@8.1.2, @capacitor/push-notifications@8.1.3) → `gradlew assembleDebug` → **BUILD SUCCESSFUL** (gradle exit 0). cap-sync CRLF-only gradle noise reverted; tree clean.

## APK identity
- **Path:** `android/app/build/outputs/apk/debug/app-debug.apk` · **8.7 MB**
- **SHA-256:** `3E0A6822F7933B08DC7C5A2BF466A50BC66C9B1E286EAE79EC965AAF93891DA6`
- **Package:** `com.bispun.crm` · versionCode `1` · versionName `1.0` · minSdk `24` · targetSdk `36` · label `Bispun`

## PR#17 / PR#18 bundled (verified in source + built bundle)
- **PR#18 confidential/locked folder:** `src/modules/client/Admissions.jsx` references `locked` (open-guard `!attachment.locked`, folder `folder.locked ?`, filter `!folder.locked`); bundled chunk `Admissions-*.js` present in `dist`.
- **PR#17 Analytics drill-down:** `src/modules/client/Analytics.jsx` drill-down code ("drills into the records behind the metric (Analytics §10.1)"); bundled chunks `Analytics-*.js` present.
- Other modules in the bundle: LeadStore, ClientPortal, Revenue, Counselling, Walkins, Referrals, Settings, Admin — no feature dropped.

## Device smoke tests — EXECUTED (Pixel_6 / emulator-5554)
- **Dev backend health (host):** `GET /api/health` → `{"success":true,"database":"connected"}`.
- **Install:** `adb install -r` (kept QA data) → **Success**.
- **Launch:** process `com.bispun.crm` pid 2027; `topResumedActivity = com.bispun.crm/.MainActivity` (fullscreen, visible); Play-Protect VerificationCheck **Pass**; `cr_LibraryLoader: Successfully loaded native library` (Chromium WebView up). **No FATAL/ANR from com.bispun.crm.**
- **Graceful offline handling:** during the emulator's cold-boot network gap the app showed its **own** branded screen "Can't reach the server — We couldn't load your workspace… Try again" (not a crash). (A "System UI isn't responding" dialog appeared — that was the **emulator's SystemUI**, not Bispun.)
- **Network recovery:** emulator→host `ping 10.0.2.2` 0% loss; tapped **Try again** → app loaded the **login screen**: Bispun logo, "Welcome back! / Sign in to your Bispun workspace", Work Email + Password (show/hide), Remember me, Forgot password, **Sign in**, "Secure workspace access / Contact support". This confirms the app reached `10.0.2.2:4000` and rendered post-bootstrap UI.
- Evidence screenshots: `pixel6_retry.png` (login), `pixel6_app.png` (graceful error state).

## NOT executed — authenticated device regression (no credentials securely available; entering credentials is approval-gated)
Login submission and everything behind it remain UNTESTED on device:
- Lead Store create/import, sequential **LD** IDs display & search
- Admissions confidential (locked) folder open/lock behavior
- Analytics drill-down navigation
- Push notifications / FCM delivery, notification deep-links
- Walk-ins, Counselling, Finance/Revenue, Referrals, Chat, Calendar, Settings, Super Admin, Account Deletion flows
- Tenant-isolation / role checks via the UI
These need a real authenticated session on a securely provisioned QA account and should be run by the operator/QA, or re-run here if test credentials are provided.

## Holds respected
No signed AAB; keystore untouched; no Play submission; no Mobile manager-improvements worktree changes; dev backend only (release AAB must bake the prod HTTPS URL, never 10.0.2.2).
