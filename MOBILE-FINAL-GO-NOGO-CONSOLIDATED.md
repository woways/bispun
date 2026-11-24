# Bispun CRM — Final Consolidated Integration / QA / Release Report

Date: 2026-11-02 · **All work read-only or isolated to `integration/mui-yc`. Nothing merged,
pushed, deployed; no production DB/record/Render/Vercel change; no external messages/calls/OTP/
payments.** Re-run fresh on the current commit — no stale results reused.

## 1. Integration branch & commit
**`integration/mui-yc` @ `70b8209`** (worktree `S:\Bispun-integ`), on `9730561` (feature restore)
on the two feature-branch merges. Working tree **clean**; no tracked `.env`; no committed secrets.

## 2. Latest remote branch status (fetched this run)
| Branch | Head | vs checkpoint | Contained in `70b8209`? |
|---|---|---|---|
| `main` | `496fa88` | unchanged | — (target) |
| `feat/mobile-ui-optimization` | `c6b55cc` | unchanged | ✅ yes |
| `feat/your-changes` | `d0628dc` | unchanged | ✅ yes |
| `feat/mobile-notifications` | `38dadb2` | — | ✅ yes |
| `feat/mobile-notifications-handover` | `666cc31` | — | ✅ yes |
| `feat/mobile-native-actions` | `d29381b` | — | ⚠️ tip not contained — **only uncontained commit changes `.gitignore`** ("Ignore Firebase service-account key") |

**No feature branch advanced** past its checkpoint. **No functional commit is missing** from the
integration. The single uncontained commit is a `.gitignore` rule that integration's `.gitignore`
**already covers** (`google-services.json`, `*service-account*.json`, etc.) — effectively a no-op.

## 3. Included developer changes (all present & verified in the branch)
Lead Store rewrite · simplified Lead IDs + Lead ID column · Alternative Phone (schema + 28 UI
refs) · Smart Nurture (`NurtureCenter`) · Dial & Track (`CallCenterModal`) · WhatsApp/SMS
(`nativeActions`) · mobile 2-col KPI grids · Dashboard/Chat/Calendar redesign · Android back
(`BackButtonHandler` + `useOverlayDismiss`) · Firebase/FCM push (`mobilePush.js`, `DeviceToken`,
`/api/client/device-tokens`, push dispatch) · Developer-2 auth + native actions · OTP onboarding
(`publicOnboard.js`) · Billing/Plans routes · plus the new **mobile phone-actions fix** (`70b8209`).

## 4. Confirmed missing features
**None.** No intended functionality is absent; nothing was silently removed.

## 5. Automated test results (fresh on `70b8209`)
| Check | Result |
|---|---|
| `npx prisma validate` | ✅ valid |
| `node --test` | ✅ **40 passed, 0 failed** |
| `npx vite build` | ✅ clean (~40s; only pre-existing >500 kB chunk warning) |
| Unresolved git conflict markers | ✅ **0** (`=======` hits are comment separators) |
| Backend syntax (`node --check` all `server/**/*.js`) | ✅ all parse |
| Auth middleware wired | ✅ `/api/client/auth` + client-auth middleware present |
| Tenant isolation | ✅ `companyId` scoping in 38/51 route files |
| Capacitor/Android deps + platform | ✅ present |
| Accessibility review (changed components) | ✅ **GO, no blocker** (2 Major fast-follows) |

## 6. Mobile QA (live, `70b8209`, bispun-mobile-dev)
| Scenario | Result |
|---|---|
| Dashboard + **2-col KPI grid** | ✅ PASS (fresh) |
| Lead Store list, Lead ID, Alternative Phone | ✅ PASS (fresh) |
| **Phone & Alt-Phone actions reachable + tappable** | ✅ PASS (fresh — the fix; menu opens, not Edit Lead) |
| Phone menu: Copy / Dial / Dial & track / WhatsApp / SMS | ✅ PASS (all present & distinct) |
| Dial & Track modal open/close + focus return | ✅ PASS (Escape closes; focus → phone trigger) |
| Smart Nurture modal | ✅ PASS (verified build; opens, a11y, no send) |
| Bottom nav / More menu / Android back / safe-area / vertical scroll | ✅ PASS |
| Chat full-screen + keyboard handling | ✅ PASS (unchanged since verified build; `ChatPanel` not modified by `70b8209`) |
| Calendar mobile agenda + keyboard editor | ✅ PASS (unchanged since verified build) |
| Notifications / session persistence | ✅ PASS (auth/session verified; FCM delivery NOT tested — see §8) |

## 7. Desktop QA (live, `70b8209`)
| Scenario | Result |
|---|---|
| Dashboard + KPIs + charts | ✅ PASS (fresh — Total Leads 1, Leads-by-Source) |
| Lead Store (rewrite, Lead ID, Alt Phone, Smart Nurture, Dial & Track, sticky columns) | ✅ PASS (fresh; 4 sticky columns unchanged at 1440px) |
| Revenue · Help · Analytics · My Store · Counselling · UTM Leads · Walk-ins | ✅ PASS (verified this session; files unchanged by `70b8209`) |
| Admissions (Overall/Domestic) · Chat two-pane · Calendar week grid | ✅ PASS (verified; unchanged) |
| Sidebar nav / responsive / auth + permissions | ✅ PASS |
| Settings · Referrals | ⚪ NOT re-tested this cycle (no changes; low risk) |

> Method note: `70b8209` changed **only `LeadStore.jsx`** vs the `9730561` build already QA'd this
> session, so modules whose files are untouched retain their verdict; Lead Store + Dashboard were
> re-captured fresh on `70b8209`.

## 8. Chat / OTP / Billing / Firebase / Nurture / Dial & Track
| Area | Status |
|---|---|
| Chat UI (full-screen, composer, unread counts API 200) | ✅ UI PASS · **message send/receive between 2 users: NOT TESTED** (needs 2 QA users) |
| OTP onboarding | ⚪ **NOT TESTED** (would create OTPs — needs approval; dev-only) |
| Billing / Plans | ✅ routes present · **plan-change/payment flows NOT TESTED** (no real payment; needs approval) |
| Firebase / FCM push | ✅ wired (DeviceToken, mobilePush, dispatch) · **delivery NOT TESTED** (needs google-services.json + device) |
| Smart Nurture | ✅ modal + APIs 200 · **sequence execution / real sends NOT TESTED** (workers disabled; needs approval) |
| Dial & Track | ✅ modal + telephony APIs 200 · **real call/outcome save NOT TESTED** (no call placed) |
| Lead create w/ alternatePhone + tenant isolation | ✅ PASS (QA lead created 201; tenant-scoped) |

**No write-dependent or external-send test is marked PASS.** These remain functional-QA gaps.

## 9. Production schema migration readiness
Production identity reconfirmed (read-only): **`ep-weathered-credit-axobwesm` / neondb**. Comparison:
- `DeviceToken` table — **ABSENT → migration required**.
- `Lead.alternatePhone`, `assignedToUserId`, `followUpAt`, `LeadRemark`, `WalkIn.alternatePhone` — **already present** → no change.
- **Exactly one additive object: the `DeviceToken` table.** Matches the Prisma model and
  `prisma/pending-migrations/0001_add_device_token.sql`. Non-destructive (new empty table).
- **SQL** (prepared, NOT applied), **pre-check** `SELECT to_regclass('public."DeviceToken"')` (expect
  null before), **post-check** (expect table + 4 indexes + 2 FKs), **rollback** `DROP TABLE
  "DeviceToken";`. Apply **before/with** the backend deploy; never `prisma db push` on prod.

## 10. Render / Vercel deployment readiness
- **Vercel (web):** `vite build` + SPA rewrites; deploys on merge to main. 🟢 Ready (confirm `VITE_API_URL` = prod API).
- **Render (API):** config is **dashboard-managed (not in repo)**. Prisma 7 has **no auto-generate**
  (no postinstall anywhere), so the build **must** run `prisma generate` or Lead writes 500 (the
  reproduced failure). **UNVERIFIED BLOCKER — confirm in the Render dashboard** that the Build
  Command includes `prisma generate` (recommended: `npm ci && npx prisma generate`; Start:
  `node server/index.js`). Do not assume it is correct because prod currently works.

## 11. Android build / signing / FCM readiness
- Package `com.bispun.crm`; `adjustResize`, safe-area, Android back all present/verified.
- **API URL:** baked from `VITE_API_URL` at build; `.env` holds emulator `10.0.2.2` (must NOT ship).
  **Production API domain is not in the repo** — use the verified Vercel `VITE_API_URL` value; do not invent one.
- **`google-services.json`:** present in the **main checkout**, `package_name com.bispun.crm` /
  `project_id bispun-crm` — **matches**. Must be placed in the build worktree (gitignored).
- **Release signing:** no `signingConfig` in `buildTypes.release` → default **debug** signing; a
  Play/production AAB needs a release keystore. `versionCode 1 / versionName 1.0` (fine for first release).
- **APK must be rebuilt from `70b8209`** with prod API URL + google-services.json, then device-QA'd
  (the earlier-tested APK was a prior build). 🔴 Not release-ready yet.

## 12. Background worker safety
- **The nurture worker/scheduler (`nurtureEngine.js`) is UNCHANGED vs main** — this release does not
  alter worker scheduling/processing; production behavior is identical to today.
- Gated by `DISABLE_BACKGROUND_WORKERS` (`server/index.js:284`): dev = disabled (verified true);
  prod leaves it unset → worker runs **as it already does**.
- Tenant-isolated (`companyId` throughout) and idempotent (status transitions SENT/COMPLETED/
  REPLIED/FAILED prevent re-send); push dispatch is `try/catch`-isolated (failures don't break CRM).
- **Recommendation:** keep `DISABLE_BACKGROUND_WORKERS=true` for all dev/QA. For prod, behavior is
  unchanged — but because the Smart Nurture **UI** is now live, confirm you intend users to be able
  to enrol leads into real send sequences on release.

## 13. Remaining blockers
**CRITICAL (must clear before deploy):**
1. Apply the additive **`DeviceToken`** migration to production (your approval).
2. **Confirm Render build runs `prisma generate`** (unverified — dashboard). Fix build-only if missing.
3. **Android:** bake prod `VITE_API_URL` + place `google-services.json` + signing decision + **rebuild from `70b8209` and device-QA** (incl. FCM).

**NON-BLOCKING (schedule / accept as known):**
- A11y Major fast-follows: modal Tab-focus-trap in `useOverlayDismiss`; dialog semantics on the 3
  legacy LeadStore modals (IndividualLead/UploadDataset/EditDataset). Not release-blocking.
- Untested functional flows (§8): Chat 2-user send, OTP, billing/payment, real Nurture/Dial sends, FCM delivery.
- Confirm prod worker/nurture "live sending" intent (§12).
- Full prod smoke only possible post-deploy.

## 14. Exact approvals still required
- ✅ Approve applying the `DeviceToken` production migration.
- ✅ Approve the **merge to `main`** (auto-deploys Render API + Vercel web) / deployment.
- ✅ Approve any **real external action** before it runs: nurture sends, real call, WhatsApp/SMS, OTP, payment.
- (If wanted) approve dev-only functional QA that writes records / creates dev OTPs.

## 15. Proposed release sequence + rollback
**Sequence:** (1) confirm Render build runs `prisma generate`; (2) back up / note Neon PITR, apply
`DeviceToken` migration to prod; (3) choose merge method (prefer a single **PR** `integration/mui-yc
→ main`, squash or merge-commit, with branch protection) — one consolidated merge, not individual
feature merges; (4) merge → watch Render logs (`prisma generate` ran, server up) + Vercel build;
(5) prod smoke (health, login, Lead Store create/edit, Dial & Track, Smart Nurture open, Chat,
Calendar); (6) build + QA the Android APK separately; release via your channel.

**Rollback:** revert the merge commit on `main` → auto-redeploys previous web+API. `DeviceToken` is
backward-compatible (old code ignores it) — keep it, or `DROP TABLE "DeviceToken";` to fully revert.
**Reverting Git does NOT undo DB changes** — handle the table explicitly. Android: redistribute the
previous APK. DB recovery: Neon PITR to the pre-migration timestamp if ever needed.

## 16. Overall GO / NO-GO
🟡 **CONDITIONAL GO.** The **code** is ready, contained, green, and schema-additive. Deploy is
gated on the three CRITICAL items (migration, Render `prisma generate` confirmation, Android build).

---

## Direct answers
**A. Is the integrated code ready?** ✅ **Yes** — contained, builds, 40/40 tests, prisma valid,
no conflicts, a11y GO, all features present.

**B. Is the production backend/database ready?** 🟡 **Almost** — needs the `DeviceToken` migration
applied **and** Render confirmed to run `prisma generate`. Both small/non-destructive.

**C. Is the Web CRM ready to deploy?** ✅ **Yes** (on merge) — build green, additive, backward-compatible.

**D. Is the Android release ready?** 🔴 **No** — rebuild from `70b8209` with prod API URL +
`google-services.json` + signing decision, then device-QA (incl. FCM). Separate track.

**E. Is it safe to merge into main now?** ⏸️ **Not yet** — safe to merge **after** (1) the
`DeviceToken` migration is applied and (2) Render `prisma generate` is confirmed, since merging
auto-deploys. The code itself is merge-ready.

**F. Exact actions remaining before your final approval:**
1. Confirm Render Build Command includes `prisma generate` (and start = `node server/index.js`).
2. Approve + apply the `DeviceToken` additive migration to production (with PITR noted).
3. Android: set prod `VITE_API_URL`, add `google-services.json`, decide signing, rebuild from
   `70b8209`, device-QA (incl. FCM).
4. Decide prod `DISABLE_BACKGROUND_WORKERS` / Smart-Nurture live-send intent.
5. (Optional) authorize dev-only functional QA for the §8 gaps.
6. Give final approval for the single `integration/mui-yc → main` PR/merge.

**STOP — consolidated report ready. Nothing merged, pushed, deployed, migrated, or sent. Awaiting
your explicit approval. Candidate: `integration/mui-yc @ 70b8209`.**
