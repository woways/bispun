# Bispun CRM Android — Stage 0–6 + B1 Completion Status (2026-11-18)

**Branch:** `mobile/stage0-6-deeplinks-a11y` (= PR #31 base `main`) · **HEAD:** `efdfb36` (LOCAL only — origin at `542fd40`; nothing pushed/merged).
**Sources reconciled:** `BISPUN-MOBILE-STAGE-STATUS.md` (2026-11-09) + `BISPUN_MOBILE_STAGE0-6_HANDOVER.md` (2026-11-13) + this session's work.
**Legend:** ✅ done & verified · 🟢 code done, dev-debug verified · 🟡 code done, device QA pending (needs login) · ⛔ external blocker · 🔒 approval/operator-gated.

## Executive summary
- **All approved Stage 0–6 + B1 features are CODE-COMPLETE**, including the previously-missing **splash screen** (built + verified on the emulator this session).
- **Nothing approved is still "not implemented" and independently executable.** What remains is: external device blockers (FCM/D-07), operator/approval gates (release signing keystore, migration 0011 execution, prod deploy), authenticated per-module **device QA** (needs your emulator login), and optional premium polish (in progress — More sheet done).
- Build green; regression **118/119** (sole fail = env-gated `adminReferralsAuth`, no DATABASE_URL — not a code bug).

## Stage matrix
| Stage | Requirement | Code | Dev/device result | Status | Remaining | Key commits |
|---|---|---|---|---|---|---|
| **0** Baseline / integration | Latest main integrated, deep-links, no dup backend, secrets clean | ✅ | automated (git + tests) | ✅ | none | (integration line) |
| **1** Shell/nav + perf/reliability | Lazy-load, session restore, bounded-retry login, logout flow, state-nav, no h-overflow | ✅ | 🟢 owner 19-PASS (11-09 dev debug) + this session re-verified nav + overflow 0 | ✅ code / 🟡 physical-perf | real-phone perf numbers (emulator timings invalid) | 2768221, logoutFlow, fcfe920 |
| **2** Splash & launch | **Bispun logo + 3 animated dots**, no blank, → login/dashboard | ✅ | ✅ verified on emulator cold start | ✅ **DONE this session** | none | **efdfb36** |
| **3** Mobile UI/UX | Bottom nav, More sheet, responsive, Android-only isolation | ✅ | ✅ widths 320/768/1440 + emulator; More-sheet tiles | ✅ code / 🟡 full per-module device QA | authenticated per-module screenshots (login) | dcaf0b5, a9ac3ee, 07ee329, 18148d7 |
| **B1** Dashboard | Charts a11y (SR tables), greet-by-name, lazy recharts, KPI layout | ✅ | ✅ (overflow fix contained SR tables) | ✅ | none | 1b0a74c, 6713e5d, fcfe920 |
| **4** Native / FCM | Back button, push lifecycle, deep-links, POST_NOTIFICATIONS, native actions | ✅ | back/deep-link code-verified | 🟢 code / ⛔ FCM delivery | **FCM token AUTHENTICATION_FAILED → real/Play-enabled device**; dialer sanitize (minor) | af5c254, 392722f |
| **D-07** Reminder + sound | Worker + channel + sound + tap (in code) | ✅ | unit (contract) | ⛔ | device FCM + isolated worker + `FIREBASE_SERVICE_ACCOUNT` | (server/lib/calendarReminders) |
| **5** Security / accessibility | Role-visibility clean; module modals a11y; reduced-motion; SR tables | ✅ | ✅ accessibility-lead PASS (multiple) | ✅ code / 🟡 on-device SR | F3/F4 deferred (user-level) | 542fd40 (Counselling/Walkins), 4dba481 |
| **6** Regression / release | Build + cap sync green; APK built+installed; release prep | ✅ | ✅ 118/119; fresh APK installed this session | ✅ code / 🔒 release | versionCode bump + prod HTTPS VITE_API_URL + **signed AAB (keystore — operator)** | — |

## Feature add-ons (beyond the base stages)
| Item | Status | Note |
|---|---|---|
| Deep-link navigation (calendar/ticket/lead) | ✅ code + a11y PASS | contract reconciled with Track A |
| #17 Users/Org load-error **Retry** | ✅ verified this session | role=alert banner + retry → recover (full cycle) |
| #11 notification **sound/volume** persistence | 🔒 code done, **migration 0011 gated** | additive/reversible SQL ready; needs your go-ahead to run on dev DB |
| Android-only `native:` isolation (web unchanged) | ✅ | 31 native CSS rules; website byte-for-byte unchanged |
| Premium UI polish (per-module) | 🟡 in progress | More sheet icon tiles done (18148d7); rest needs login |

## NOT implemented / blocked (honest)
1. ⛔ **FCM push delivery + D-07 live** — emulator GMS not checked in; needs a real/Play-enabled device + `FIREBASE_SERVICE_ACCOUNT`. (Config proven correct; do NOT regenerate creds.)
2. 🔒 **Signed release AAB** — keystore `bispun-release.jks` + `keystore.properties` passwords are operator-held; build is fail-closed. versionCode/Name bump + prod HTTPS `VITE_API_URL` needed.
3. 🔒 **Migration 0011** (#11 persistence) — approval-gated; approval report delivered; run against dev DB only on your go-ahead.
4. 🟡 **Authenticated per-module device QA + premium polish** — needs your emulator login (session expired overnight; emulator is on the login screen now).
5. 🟡 **Physical-device performance numbers** — emulator software-GPU timings are not valid.
6. 🟢 **Minor cleanup (optional):** `openDialer` is unused; phone links use raw `tel:${phone}` (works; sanitizing is a robustness nicety, not a missing feature).
7. 🔒 **Play account-deletion FULFILLMENT** — request intake implemented; actual deletion/anonymization job is policy-gated (product decision).

## Counts
- Approved stage groups (0–6 + B1 + D-07): **9** → **code-complete: 9** · **dev/automated-verified: 8** (D-07 blocked on device) · **not-implemented & executable: 0**.
- Release blockers remaining are **external/operator/approval only** (FCM device, signing keystore, migration execution, deploy auth) — not missing code.
- No existing web/desktop/tablet feature removed; isolation keeps the website unchanged.
