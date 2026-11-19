# Bispun CRM Android — Play Store Readiness Checklist (2026-11-18)

**Branch:** `mobile/stage0-6-deeplinks-a11y` @ `adbdd6c` (LOCAL only; nothing pushed/merged). **appId:** `com.bispun.crm`.
**Legend:** ✅ ready · 🟡 needs operator/device · 🔒 approval-gated · ⛔ external blocker.

## Device acceptance (this session, authenticated on Pixel 6 emulator — "Student Mentor (Dev)")
All 13 modules navigated on the real emulator: **render OK, `overflowX = 0`, no blank, bottom nav + loading states working.**
| Module | Renders | Overflow | Note |
|---|---|---|---|
| Dashboard | ✅ | 0 | greeting, KPIs, charts, team card |
| Lead Store | ✅ | 0 | 2×2 KPI tiles, search/filter/export, Smart Nurture/Import |
| Admissions (All/Dom/Intl) | ✅ | 0 | 3-card row + tabs + filters; loading skeleton works |
| Revenue / Finance | ✅ | 0 | compact KPIs |
| My Referrals | ✅ | 0 | summary cards |
| Goals & Targets | ✅ | 0 | My/Team targets |
| UTM Leads | ✅ | 0 | generator + list (direct-load OK) |
| Analytics | ✅ | 0 | year-comparison charts |
| Settings | ✅ | 0 | tabbed |
| Help & Support | ✅ | 0 | tickets |
| Counselling | ✅ | 0 | +a11y dialog (this line's work) |
| Walk-ins | ✅ | 0 | +a11y dialog |
| Chats | ✅ | 0 | open-on-latest |
| Splash (cold start) | ✅ | — | Bispun logo + 3 animated dots → login |
| More sheet | ✅ | 0 | premium icon tiles |

## Play Console readiness
| Item | Status | Operator action |
|---|---|---|
| Production **HTTPS** `VITE_API_URL` | 🟡 | set the real backend origin in the release build env (NOT `10.0.2.2`; `api.js` throws in prod if unset; `network_security_config` blocks cleartext to real domains) |
| versionCode / versionName | 🟡 (now `1`/`1.0`) | bump per release |
| Signing keystore | ✅ config (fail-closed) / 🟡 secret | drop real `android/keystore.properties` for the existing `bispun-release.jks` (never in chat/VCS) |
| Signed AAB validation | 🟡 | `./gradlew bundleRelease` on host → validate package/signature with bundletool/Play |
| Firebase config (`google-services.json`) | ✅ present (`bispun-crm`) | confirm for release |
| **FCM actual delivery** | ⛔ | real/Play-enabled device + `FIREBASE_SERVICE_ACCOUNT`; emulator GMS can't check in |
| **D-07 reminders** | ⛔ | device + isolated non-prod worker (dev has workers off) |
| Account deletion URL | ✅ page + in-app intake | deploy site → use `https://<prod>/data-deletion`; **fulfillment job** still policy-gated 🔒 |
| Privacy policy URL | 🟡 | operator-hosted |
| Permissions / Data Safety | ✅ derived | declare: INTERNET, ACCESS_NETWORK_STATE, WAKE_LOCK, BIND_JOB_SERVICE, POST_NOTIFICATIONS; data = account + CRM data + FCM token over HTTPS; no ads/3p analytics; not sold |
| Internal testing + reviewer login | 🟡 | create a reviewer test account; pick track |
| Store listing (desc/graphic/screenshots) | 🟡 | operator content (screenshots can come from this emulator once logged in) |
| Migration `0011` (#11 persistence) | 🔒 | run on dev DB on your go-ahead (approval report delivered); then verify persistence |

## What prevents final Play Store release (summary)
1. **Signed AAB** — operator keystore passwords + versionCode bump + prod HTTPS `VITE_API_URL`.
2. **FCM + D-07 live delivery** — real device + `FIREBASE_SERVICE_ACCOUNT`.
3. **Account-deletion fulfillment** — policy decision + backend job (Play compliance).
4. **Prod deploy / main merge** — approval + required checks (PR #31 unmerged).
5. (Optional) migration `0011` for #11 persistence.

Everything else (code, UI, isolation, splash, accessibility, overflow, device render) is **done and verified**. No existing web/desktop/tablet feature changed.
