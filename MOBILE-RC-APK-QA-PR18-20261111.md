# Bispun — RC Debug APK QA (PR#18-inclusive, 2026-11-11)

Fresh debug APK from the consolidated RC `rc/consolidated-release-20261110` @ **`98147ce`**
(= `origin/main` f6b7dd5 + 44). Local build + Pixel_6 QA only. All HOLDs intact.

## Build
- `VITE_API_URL=http://10.0.2.2:4000 npm run build` → ✓ built (exit 0).
- PR#17 (Analytics drill-down) and PR#18 (Admissions confidential folder) present in web bundle.
- `npx cap sync android` OK; `.\gradlew.bat assembleDebug` (host) → **BUILD SUCCESSFUL in 23s**.

## APK
| Field | Value |
|---|---|
| Path | `S:\Bispun-pr13-integration\android\app\build\outputs\apk\debug\app-debug.apk` |
| Size | 9,126,928 bytes |
| Built | 2026-11-11 11:53:59 IST |
| SHA-256 | `3e0a6822f7933b08dc7c5a2bf466a50bc66c9b1e286eae79ec965aaf93891da6` |
| package / version | `com.bispun.crm` / 1 / 1.0 |
| min/target/compile | 24 / 36 / 36 |
| Source SHA | `98147ce` |
| PR#17 inside APK | ✅ `Analytics-*.js` ("View these admissions", "received-revenue") |
| PR#18 inside APK | ✅ `Admissions-siN5LXPT.js` ("Confidential") |
| Secrets in JS assets | none found |

## Emulator QA (Pixel_6, non-destructive)
- Dev backend serving `:4000` (health 200, DB `blue-mouse` connected; workers disabled). Note: a
  duplicate `npm run server` watcher logged EADDRINUSE (harmless — the earlier instance owns :4000).
- `adb install -r` (**data preserved**) → Success.
- Launch: `MainActivity` resumed; **no FATAL/crash** (app pid 4705); Capacitor loaded SPA.
- Backend connectivity: host `/api/health` 200, `/api/client/auth/me` 401 (app's unauth path →
  login). No app-level `net::ERR` (only Google-services noise from a system pid).
- Login screen rendered (screenshot captured). Pre-existing non-fatal "safe area CSS" console warning.
- **Not performed:** authenticated login / interaction. **Remaining:** full authenticated device
  regression of the new **Analytics drill-down** and **Admissions confidential folder**, plus core
  flows (Lead Store, Finance, Chats, Notifications, Calendar, native actions, Back, logout).

## Automated + security checks (on `98147ce`)
- `prisma validate` valid · `npm test` **86 pass / 0 fail**, incl. security-scoping suites:
  lead visibility (own assigned id + case-insensitive name; unassigned hidden), dataset/telephony
  scoping, calendar edit authorization, account-deletion validation/policy, admission company scoping.

## HOLDs
Main merge, Vercel/Render deploy, all migrations, branch/worktree deletion, Play submission: HELD.
Production `pond`: not touched. No Production credentials used. No feature removed.
