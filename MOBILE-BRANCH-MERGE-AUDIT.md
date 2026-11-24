# Bispun CRM — All-branches & local-changes merge audit (read-only)

Date: 2026-11-02 · `origin/main` = **`c349759`** (PR #3 merge). **Read-only audit. No code/branch/DB
change. No `.env` or credentials exposed.**

## Branch audit
| Branch | Latest commit | Included in main? | Missing commits | Missing functionality | Recommended action |
|---|---|---|---|---|---|
| `main` | `c349759` | — (target) | — | — | — |
| `integration/mui-yc` | `70b8209` | ✅ YES | 0 | none | Keep or archive (your call; not deleting) |
| `feat/mobile-ui-optimization` | `c6b55cc` | ✅ YES | 0 | none | Keep/archive |
| `feat/your-changes` | `d0628dc` | ✅ YES | 0 | none | Keep/archive |
| `feat/mobile-notifications` | `38dadb2` | ✅ YES | 0 | none | Keep/archive |
| `feat/mobile-notifications-handover` | `666cc31` | ✅ YES | 0 | none | Keep/archive |
| `feat/bispun-mobile-capacitor` | `4f4ba21` | ✅ YES | 0 | none | Keep/archive |
| `feat/mobile-native-actions` | `d29381b` | ⚠️ all but 1 commit | **1** — `d29381b` (`.gitignore` only, "Ignore Firebase service-account key") | **none** — redundant; main already ignores the key | No action needed (optional cherry-pick for tidiness) |

**Only one commit anywhere is not in main**, and it is a **single `.gitignore` line** whose effect is
**already present in main** (`main/.gitignore` ignores `google-services.json`, `*service-account*.json`,
`*serviceAccount*.json`, `*.keystore`, `*.jks`, `.env*`). No functionality rides on it.

## Feature verification against `origin/main` (content, not just hashes)
All present in the merged `main` tree:
| Feature | Evidence in `origin/main` |
|---|---|
| Lead Store rewrite + simplified Lead IDs | `LeadStore.jsx` (`displayLeadId`), 2-col KPI grid |
| Alternative Phone | `prisma/schema.prisma` + `LeadStore.jsx` |
| Smart Nurture | `NurtureCenter.jsx` + "Smart Nurture" button + `server/lib/nurtureEngine.js` + `/api/client/nurture` |
| Dial & Track | `CallCenterModal.jsx` + per-lead trigger + `/api/client/telephony` |
| Mobile phone-actions fix (latest) | `lg:sticky lg:left-[116px]` ×2 + `triggerRef.current?.focus()` |
| Mobile UI (nav/back/safe-area/keyboard) | `useOverlayDismiss.js`, `AndroidManifest adjustResize`, `BackButtonHandler.jsx` |
| Chat redesign | `ChatPanel.jsx` (`visualViewport`) |
| Calendar redesign | `CalendarModal.jsx` (`safe-area`) |
| Firebase / FCM push | `mobilePush.js`, `DeviceToken` model, `clientDeviceTokens.js`, `pushService.js`, `pushDispatch.js`, `0001_add_device_token.sql` |
| Native actions (WhatsApp/SMS/Call) | `nativeActions.js` (`openWhatsApp`/`openSMS`) |
| Billing / Plans | `clientBilling.js`, `adminPlans.js` |
| OTP onboarding | `publicOnboard.js` |

**No intended feature is missing from main.**

## Uncommitted / staged / untracked application code
- **`S:\Bispun-integ`** (`integration/mui-yc`): **clean** — no tracked or untracked changes.
- **`S:\Bispun`** (`feat/mobile-ui-optimization`): **no application-code changes**. The only untracked
  items are **~30 `MOBILE-*.md` session report docs** (documentation I produced this session — not app
  code, not intended for the repo) and **`android/local.properties.bak`** (a machine-specific local
  Android SDK path backup, correctly uncommitted). No staged changes.
- **No application code is unpushed anywhere.**

## Summary
- **ALL INTENDED CHANGES MERGED: YES.** Every developer/feature branch's functionality is in `main`
  (`c349759`); the single uncontained commit is a redundant `.gitignore` line with no functional effect.
- **Any local work not pushed to GitHub:** none that is application code — only session report `.md`
  docs and one local `.bak` (neither belongs in the repo).
- **Pending developer changes:** none identified; all developer branches are contained in `main`.
- **Intentional unmerged vs actually missing:** the only unmerged item (`d29381b` gitignore line) is
  **neither needed nor missing functionality** — redundant. Nothing is actually missing.

## Exact remaining tasks before closing the integration work
1. **(Optional) Branch cleanup** — all feature/integration branches are fully merged; you may archive or
   delete them at your discretion (I will not delete branches). Keeping them is harmless.
2. **(Optional) `d29381b`** — redundant gitignore commit on `feat/mobile-native-actions`; cherry-pick for
   tidiness or ignore. No functional impact.
3. **Android APK release (separate track)** — build from `main` with `VITE_API_URL=https://api.bispun.com`
   + `google-services.json` (`com.bispun.crm`) + release signing; device-QA incl. FCM.
4. **Production authenticated spot-check** — a team login to verify Lead Store create/edit (new
   `alternatePhone`), Revenue, Analytics, Dashboard, Chat, Calendar on production (the deployed code is
   the dev-QA'd `70b8209`).
5. **Still-untested functional flows** — Chat 2-user send, OTP onboarding, billing/payment, FCM push
   delivery, real Nurture/Dial sends.
6. **(Housekeeping) The ~30 `MOBILE-*.md` reports** in `S:\Bispun` are untracked docs — keep locally,
   move to a `docs/` folder, or discard as you prefer (not code).

**STOP — read-only audit complete. Web/backend release is merged, deployed and healthy; all intended
code is in `main`; nothing is missing.**
