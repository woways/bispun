# Bispun CRM — Development Runtime QA (pre-production-merge)

Date: 2026-11-01 · DEV only · Read-only except where noted. **No prod access, no
records created/updated, no credentials entered, no merge/push/deploy.**

## Phase 1 — Environment verification (read-only)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Neon endpoint = intended dev project | ⚠️ **PARTIAL** | Endpoint `ep-weathered-credit-axobwesm`, DB `neondb`, `NODE_ENV=development`. The Neon **project name** ("bispun-mobile-dev") is not in the connection string, so I can't match the label — **please confirm** that endpoint is your dev branch. No production markers. |
| 2 | Backend + frontend on dev services only | ✅ backend / ⚠️ frontend | Backend: `NODE_ENV=development`, `DATABASE_URL` → dev Neon, API on `:4000`. Frontend: the only `VITE_API_URL` is **`http://10.0.2.2:4000`** — the **Android-emulator alias**. Correct for mobile dev; **not reachable from a desktop browser**, and no Vite dev server is running (`:5173` down). |
| 3 | Firebase identity + QA push safety | ✅ identified / ⚠️ caution | Firebase project **`bispun-crm`** (project# 636688255334, pkg `com.bispun.crm`). Server push configured: `GOOGLE_APPLICATION_CREDENTIALS=bispun-fcm-admin.json` (file present), `firebase-admin` installed. **Caution:** this looks like a **single Firebase project (shared dev/prod)** — QA push is safe **only** if sent via the **dev backend to the specific emulator device token** (dev DB), never a topic/broadcast. |
| 4 | No production deploy/write can be triggered | ✅ **PASS** | Deploy triggers **only** on push to `main` (not doing that). All writes go to the **dev** Neon DB via `:4000`. Production API/DB is separate (Render/Vercel on `main`). |
| 5 | Existing authorized QA users / test records | ⚠️ **PARTIAL** | Seeded users (from `prisma/seed.js`): SUPER_ADMIN `admin@consulbuzz.com`, CLIENT_ADMIN `admin@studentmentor.co.in`. The mobile QA account **`bispun.qa.admin@example.com`** ("Bispun Mobile QA") is **not seeded** (created manually). The QA tenant appears to have **only one user** (New-chat showed "No people found"). Full enumeration needs a read-only dev-DB query or your confirmation. |

## Phases 2–6 — status

| Phase | Result | Why |
|---|---|---|
| **2. Desktop CRM smoke** | ⛔ **NOT TESTED (blocked)** | No desktop-usable web dev session: `VITE_API_URL=10.0.2.2:4000` is emulator-only, no Vite server running, and you asked me not to change env vars. Desktop login also needs QA creds (httpOnly cookie). Desktop **layout** was already confirmed unchanged at code level (`lg:`-gated) in the UI pass. |
| **3. Auth + OTP** | ✅ mobile auth PASS / ⛔ OTP NOT TESTED | Mobile login + `/auth/me` + session persistence already verified on-device (see `MOBILE-AUTH-VERIFICATION.md`). OTP onboarding runtime would **create a dev record** → needs your approval + test data. Code-level coexistence is clean (OTP files don't conflict with mobile-auth; combined build+tests pass). |
| **4. Billing / Plans** | ⛔ **NOT TESTED** | Verified at code/build level only (clean merge + build). Any runtime billing/plan action **writes dev records** → needs your approval + designated dev test data; must avoid real payments/links. |
| **5. Firebase push** | ✅ token-register PASS / ⛔ delivery NOT TESTED | `POST /device-tokens/register → 200` captured during login. Delivery + tap-nav + invalid-token handling need **sending a push** (write/send action) → needs approval; and must target **only the emulator's dev token** (shared Firebase project). |
| **6. Chat send/attachments** | ⛔ **NOT TESTED (blocked)** | No **second** authorized dev QA user exists in the tenant (New-chat "No people found"), so a conversation can't be opened. Creating a user needs your approval — not done. |

## Exact remaining blockers
1. **Desktop dev session** — the dev env is emulator-oriented (`VITE_API_URL=10.0.2.2:4000`); a desktop browser can't reach it without an env change (which you forbade). Need either a desktop-dev setup (localhost API) you run, or authorization to temporarily point a local build at `http://localhost:4000`, plus a QA login.
2. **QA credentials** — I will not enter the QA password; desktop/web login must be done by you or via an approved password-manager flow.
3. **Per-action approval + dev test data** for the record-creating tests: OTP onboarding (Phase 3), Billing/Plans (Phase 4), Push delivery (Phase 5).
4. **Second dev QA user** for chat (Phase 6) — doesn't exist; creating one needs your approval.
5. **Confirm** the Neon endpoint `ep-weathered-credit-axobwesm` is the `bispun-mobile-dev` branch.

## What I need you to authorize (pick any; I'll proceed only on your word)
- **A — Desktop smoke:** you log into the dev web (I'll drive/verify read-only), or authorize a temporary local `VITE_API_URL=http://localhost:4000` build for smoke.
- **B — OTP onboarding:** authorize a **dev-only** onboarding test and name the test contact/data to use.
- **C — Billing/Plans:** authorize a **dev-only** billing/plan action (no real payment) and the test record to use.
- **D — Push delivery:** authorize a **dev** push to the emulator's token only.
- **E — Chat:** authorize creating **one** dev QA user (or point me to an existing second user) to test send/attachments.
- **F — QA-user enumeration:** authorize a read-only dev-DB query to list QA users/records.

## Final production release recommendation
- **Code integration readiness:** ✅ **GO** (clean 3-way merge, 40/40 tests, clean build, containment confirmed, mobile UI + mobile auth verified on-device).
- **Production release:** 🔴 **NO-GO for now.** Because merging to `main` **auto-deploys production (Render + Vercel)**, and the runtime flows OTP onboarding, Billing/Plans, push **delivery**, desktop smoke, and chat send are **unverified**, I recommend **not merging yet**. Clear the gated runtime tests above (with your authorization) — or explicitly accept the residual risk — then it becomes a **conditional GO** with a release/rollback plan.

**STOP — awaiting your authorizations for the dev runtime tests, and your decision
on the production merge. No records, credentials, merges, or deploys were touched.**
