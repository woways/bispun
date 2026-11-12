# Bispun — RC Debug APK Build & QA (2026-11-11)

Fresh debug APK from the consolidated release candidate (now PR#17-inclusive).
Local build + emulator QA only. All HARD HOLDs intact.

## Source
- Branch: `rc/consolidated-release-20261110`, HEAD **`4aef725`** (local == `origin`).
- Includes: main `890ba58` (PR#17 Analytics drill-down) + PR#13 + fail-closed Android signing.
- Note: `origin/main` has since advanced to `f6b7dd5` (next consolidation cycle; not in this APK).

## Build
- `VITE_API_URL=http://10.0.2.2:4000 npm run build` → ✓ built (exit 0).
- PR#17 code present in web bundle (`dist/crm-assets/Analytics-DQh5sDGp.js`: "View these admissions",
  "received-revenue", "potential-revenue").
- `npx cap sync android` OK (plugins @capacitor/app@8.1.2, @capacitor/push-notifications@8.1.3).
- `.\gradlew.bat assembleDebug` (Windows host) → **BUILD SUCCESSFUL in 1m 27s**.

## APK metadata
| Field | Value |
|---|---|
| Path | `S:\Bispun-pr13-integration\android\app\build\outputs\apk\debug\app-debug.apk` |
| Size | 9,126,929 bytes (~8.7 MB) |
| Built | 2026-11-11 09:12:13 IST |
| SHA-256 | `e04ad388cdf081c487e0b84b5081afd6a291644a208516da35ae04553fcc7103` |
| package / version | `com.bispun.crm` / versionCode 1 / versionName 1.0 |
| min/target/compile SDK | 24 / 36 / 36 |
| Source SHA | `4aef725` |
| PR#17 inside APK | ✅ confirmed (`assets/public/crm-assets/Analytics-DQh5sDGp.js`) |

## Emulator QA (Pixel_6, non-destructive)
- Dev backend restarted on host `:4000` (workers disabled, SMTP cleared); `/api/health` → 200,
  DB = Dev `blue-mouse`. Emulator `emulator-5554` booted.
- Installed with `adb install -r` (**data preserved**) → Success.
- Launch: `com.bispun.crm/.MainActivity` resumed; **no FATAL/crash** (app pid 2351).
- Capacitor loaded SPA at `http://localhost`, App started/resumed.
- **Backend connectivity:** app → `GET /api/client/auth/me` → 401 (×2) on Dev via `10.0.2.2:4000`
  → correct unauthenticated → login screen rendered (screenshot captured).
- Non-fatal console warning (pre-existing): "Error injecting safe area CSS" — does not block app.
- **No authenticated interaction testing performed.** PR#17 Analytics drill-down is present in the
  build but **NOT exercised via login on-device** — full interaction QA still pending.

## Automated tests (on `4aef725`)
- `npx prisma validate` → valid · `npm test` → **86 pass, 0 fail**.

## HOLDs
Main merge, Vercel/Render deploy, all migrations, branch/worktree deletion, Play submission:
**HELD**. Production `pond`: **not touched**. No Production credentials used.
