# Bispun CRM — Final Production Release-Gate Report (2026-11-10)

Evidence-backed GO/NO-GO audit. **Read-only / non-destructive only.** No merge, deploy,
migration, branch deletion, or Play submission performed. Production `pond` not touched.

---

## A. RELEASE VERDICT: 🔴 NO-GO (pending operator evidence) → CONDITIONAL GO when B–D verified

Rationale (per the rule "NO-GO when critical Production schema, deployment behavior or
user-data safety requirements remain unverified"): **Production schema cannot be verified from
this environment** (no authorized read-only prod access), and **Vercel/Render dashboard deploy
triggers are repo-inferred, not dashboard-confirmed**. The code candidate itself is healthy and
clean. Provide the operator evidence in B–D and this flips to **CONDITIONAL GO** (merge only
with Production-deploy authorization).

## B. EVIDENCE TABLE

| Gate | Result | Evidence | Remaining action |
|---|---|---|---|
| Git/RC integrity | ✅ VERIFIED | `origin/main`=`890ba58`, RC=`f87f8d5`, 0 behind/40 ahead, main is ancestor | — |
| RC contains approved work | ✅ VERIFIED | PR#13 + main (incl. PR#17 analytics) + signing all ancestors of RC | — |
| PR #13 mergeable | ✅ VERIFIED | `gh pr view 13`: state OPEN, mergeable MERGEABLE, CLEAN | — |
| Automated tests | ✅ PASS | `npm test` 86/86; `npm run build` ✓ (exit 0); `prisma validate` valid | — |
| Android debug APK | 🟡 PARTIAL | APK built+launch-tested earlier; **predates PR#17 merge** | rebuild debug APK for device QA of analytics drill-down |
| Signed AAB | 🔴 BLOCKED | keystore present (not opened); `keystore.properties` absent (fail-closed) | operator enters credentials locally |
| Vercel triggers | 🟡 UNVERIFIED | repo has only `vercel.json` (SPA); dashboard not accessible here | operator confirm in Vercel dashboard (C) |
| Render triggers | 🟡 UNVERIFIED | no `render.yaml`; backend is dashboard-configured | operator confirm in Render dashboard (C) |
| Auto-migrate on deploy | ✅ VERIFIED (repo) | no `migrate deploy`/`db push` in build/start; no GH Actions | operator confirm no Render pre-deploy hook runs them |
| Production schema | 🔴 UNKNOWN | no authorized read-only prod access | operator runs the SQL in §E |
| Account-deletion persistence (prod) | 🔴 UNKNOWN | `0008` not applied to prod; code returns fail-safe 503 | apply `0008` to prod (gated) before relying on public URL |
| Rollback refs | ✅ VERIFIED | `backup/pre-consolidation/main-20261110`=`29283ec`; `backup/pre-release/main-20261110b`=`890ba58` | — |
| Pond untouched | ✅ VERIFIED | no prod DB access performed | — |

## C. PRODUCTION DEPLOYMENT MAPPING

- **Repo evidence (verified):** `vercel.json` = SPA rewrites only (frontend hosting). No
  `render.yaml`, no `.github/workflows`. `package.json` `build` = `vite build`; **no
  `start`/`postinstall`/`prebuild` and no `db push`/`migrate` in any hook.** `prisma:push`
  exists but is **manual-only**. → **A main push does NOT auto-run DB migrations.**
- **UNVERIFIED (needs dashboard):** whether Vercel auto-deploys Production on push to `main`;
  whether Render auto-deploys its connected branch; the Render build/start commands,
  health-check, and any pre-deploy hook. A missing `render.yaml` does NOT prove no dashboard hook.
- **Impact of merging to main (expected):** Vercel deploys the production frontend; Render
  deploys the backend — **a real Production deployment**, which is **not authorized**.
- **Operator verification checklist:**
  - Vercel → Project → Settings → Git: Production Branch (= `main`?), "Automatically deploy"
    on push, Deployment Protection; Settings → Environment Variables (Production scope:
    `VITE_API_URL` = prod HTTPS API); note current Production deployment for rollback.
  - Render → Service → Settings: Repository + Branch, Auto-Deploy (On/Off), Build Command,
    Start Command, Health Check Path, Pre-Deploy Command (must NOT run migrations unintended),
    Environment (`DATABASE_URL`=prod, `CLIENT_URL`=prod frontend, `JWT_*`), and any
    cron/worker services; note current live commit for rollback.

## D. DATABASE MIGRATION MATRIX (Production = UNVERIFIED here)

Model: Prisma `db push` + hand-applied `prisma/pending-migrations/*.sql`. **No `prisma/migrations`
history; no tool tracks applied state** → Production state must be read from the catalog.

| Dependency | Required object | Dev state | Prod verified | Blocking feature | Risk | Release action |
|---|---|---|---|---|---|---|
| 0001 | `DeviceToken` table | applied | UNKNOWN | mobile push token | low (additive) | operator SQL |
| 0002 | `User.designationId/levelId/levelName` | applied | **PRESENT** (operator-confirmed earlier) + `leadStoreColumnOrder` | Users & Roles | low | re-confirm via SQL |
| 0003 | `UtmLink.influencerName` TEXT null | in main | UNKNOWN | UTM attribution | low (nullable) | operator SQL |
| 0004 | `LeadDatasetType` +5 enum values; `Lead.preferredColleges` TEXT null | in main | UNKNOWN | Lead types / Preferred Colleges | low | operator SQL |
| 0005 | `Lead.leadNumber` INT **NOT NULL** + unique idx + trigger `Lead_assign_lead_number` | in main | UNKNOWN | stable Lead IDs | **HIGH** (NOT NULL + backfill + trigger; inserts fail without trigger) | operator SQL; critical |
| 0006 | `LeadDataset.duplicateDetails` JSONB null | in main | UNKNOWN | import dup details | low | operator SQL |
| 0007 | calendar visibility (DRAFT) | NOT applied | n/a | calendar private/shared | — | **HOLD** |
| 0008 | `AccountDeletionRequest` table + 3 idx | applied | **ABSENT (prod)** | account-deletion persistence | medium (code fail-safe 503) | apply to prod (gated) for Play |

**Key:** `0003–0006` **ship with current `main`** — if Production already runs `main` it must
already have them; **this must be operator-confirmed, not inferred.** `0005` is the highest-risk
(NOT NULL + per-company trigger). `0008` is the only object the RC adds **beyond main**, and it
is **code-guarded (fail-safe 503)**, so the app won't crash without it — but the **public
deletion URL can't persist in prod without it** (Play gap). **Do not run any migration during
this audit (none run).** `CREATE TABLE IF NOT EXISTS` does not prove equivalence.

### Operator read-only verification SQL (Neon SQL Editor, Production branch — catalog only, no PII)
```sql
-- 0001 DeviceToken, 0008 AccountDeletionRequest
SELECT to_regclass('"DeviceToken"') AS devicetoken, to_regclass('"AccountDeletionRequest"') AS accountdeletionrequest;
-- 0002 User cols + 0003/0004/0005/0006 columns
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE (table_name='User' AND column_name IN ('designationId','levelId','levelName','leadStoreColumnOrder'))
   OR (table_name='UtmLink' AND column_name='influencerName')
   OR (table_name='Lead' AND column_name IN ('preferredColleges','leadNumber'))
   OR (table_name='LeadDataset' AND column_name='duplicateDetails')
ORDER BY table_name, column_name;
-- 0004 enum values
SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
WHERE t.typname='LeadDatasetType' ORDER BY e.enumsortorder;
-- 0005 unique index + trigger
SELECT indexname FROM pg_indexes WHERE tablename='Lead' AND indexname='Lead_companyId_leadNumber_key';
SELECT tgname FROM pg_trigger WHERE tgname='Lead_assign_lead_number';
```
Expected for GO: `User` 4 cols present; `UtmLink.influencerName` present; `Lead.preferredColleges`
present; `Lead.leadNumber` present **and NOT NULL** with the unique index + trigger;
`LeadDataset.duplicateDetails` present; enum includes GOOGLE_FORM/WEBSITE_FORM/IM/DM/INTERNAL.
If any `0003–0006` object is ABSENT, **NO-GO** until applied (separately authorized).

### Future migration plan (operator, separately authorized — DEV first, then PROD)
Order: `0003 → 0004 → 0005 → 0006 → 0008` (skip `0007` HOLD). `0001/0002` already present.
- `0005` cautions: NOT NULL after backfill; `UPDATE` over all `Lead` rows (row locks on big
  tables — run off-peak); creates a trigger + plpgsql function; advisory-lock per company.
  Transactional; rollback = drop trigger/function/index/column. **Not idempotent for the
  backfill if partially applied** — verify `leadNumber` NULL count is 0 after.
- `0003/0004/0006/0008` are additive + idempotent (`IF NOT EXISTS` / `ADD VALUE IF NOT EXISTS`).
- Post-apply: `npx prisma generate`; `/api/health`; Lead create (leadNumber assigned); account
  -deletion persist smoke.

## E. ACCOUNT-DELETION VERDICT (Google Play)

- **Request intake:** ✅ implemented — public page `/data-deletion` (unauthenticated route) +
  public API `/api/public/data-deletion` (rate-limited, privacy-safe) + authenticated in-app path.
- **Durable persistence:** 🟡 **Dev-only.** `0008` NOT applied to Production → in prod the
  endpoint returns the honest **503 fallback** (can't record) until applied. **Play gap:** a
  live deletion URL must actually capture requests. Apply `0008` to prod (gated) before relying
  on the public URL.
- **Actual fulfillment (deletion/anonymization):** 🔴 **NOT implemented** (policy-gated by
  design). The system records requests only.
- **`PROCESSED` status risk:** `DELETION_STATUSES = PENDING|VERIFIED|PROCESSED|REJECTED`, set via
  the Super Admin API; **no actual deletion occurs.** `PROCESSED` could misleadingly imply data
  was deleted. **Recommendation:** rename to e.g. `REVIEWED`/`CLOSED`, or gate `PROCESSED` behind
  a verified completion step; ensure no user-facing text equates it with deletion. (No user-facing
  claim of completion exists today; the policy text is accurate.)
- **Public URL:** route exists in the SPA; must be deployed to a public HTTPS domain (Vercel) and
  backed by a prod DB with `0008`. Not deployed.
- **Retention policy:** ✅ documented and reasonable (`DELETION_POLICY_TEXT`: removes profile/
  credentials, retains legally-required billing/audit, org-owned CRM data retained by org admin,
  30-day processing, ownership verification).
- **Classification:** **Partially implemented — needs Production deployment + `0008` migration +
  a `PROCESSED`-naming/fulfillment decision** before Play compliance can be claimed.

## F. FRONTEND / BACKEND COMPATIBILITY

- Coupling: frontend (Vercel) → backend (Render) via `VITE_API_URL` **baked at build time**;
  backend CORS uses `CLIENT_URL`. Production frontend build must bake the **prod HTTPS API URL**;
  Render `CLIENT_URL` must list the prod frontend domain.
- Candidate backend vs prod schema: uses `leadNumber`/`preferredColleges`/`influencerName`/
  `duplicateDetails` **directly** (require `0003–0006`), and `AccountDeletionRequest` **guarded**
  (fail-safe if `0008` absent).
- Mixed-version risk: these features ship in current `main`, so a prod already on `main` is
  compatible. If prod is **behind** main (lacks `0003–0006`), deploying the candidate backend
  would break Lead reads/inserts (esp. `0005`). → schema check in §D is the gate.
- Android release API URL: must be the prod HTTPS endpoint — **never** `localhost`/`10.0.2.2`.
- Fail-safe: account-deletion returns 503 (not crash) if its table is absent — verified in code.

## G. ROLLBACK RUNBOOK (prepared; not executed/tested)

1. **Frontend (Vercel):** redeploy the previous Production deployment (Vercel → Deployments →
   prior → Promote/Rollback). Instant; no DB impact.
2. **Backend (Render):** Render → service → Events/Deploys → "Rollback" to the prior live commit
   (`backup/pre-release/main-20261110b` = `890ba58` is the current main ref).
3. **Code (Git):** `main` currently `890ba58`; a Git revert alone does **not** restore a running
   deployment — use the platform rollbacks above.
4. **Database:** changes in `0003–0006/0008` are **additive** (backward-compatible) — a code
   rollback generally needs **no** DB rollback. If `0005` must be reverted: drop trigger
   `Lead_assign_lead_number`, function `assign_company_lead_number`, index
   `Lead_companyId_leadNumber_key`, column `Lead.leadNumber` (only if no code depends on it).
   Use Neon branch/PITR for any data-affecting incident.
5. **Workers:** backend runs with `DISABLE_BACKGROUND_WORKERS` in dev; confirm the prod setting —
   if nurture/calendar workers are enabled in prod, they can send outbound messages. To halt
   during an incident, set `DISABLE_BACKGROUND_WORKERS=true` and restart.
- **Untested dependencies:** platform rollback not exercised; Neon PITR window not confirmed.

## H. GIT STATE

- `origin/main` = **`890ba58`** (advanced from `29283ec` via PR#17 analytics drill-down).
- RC `rc/consolidated-release-20261110` = **`f87f8d5`** (refreshed: merged main PR#17; 0 behind /
  40 ahead; clean superset; pushed).
- PR #13 OPEN, MERGEABLE/CLEAN (content already in RC).
- Unique unmerged branch: `feat/client-admin-password-reset` (`0084f2d`) — preserved on origin +
  backup tag; **NOT** in RC; decision pending.
- Backup/rollback tags on origin: `backup/pre-consolidation/{main,integration,client-admin-pwreset,
  rc-android-signed}-20261110`, `backup/pre-main-merge-20261109`, `backup/pre-release/main-20261110b`.
- Cleanup eligibility (after an authorized merge only): `feat/admissions-notifications-calendar`,
  `feat/mobile-ui-optimization`, `feat/referrals-integration`, `hotfix/prod-login-coldstart`,
  `integration/mui-yc`, `finance-changes` — all fully in main (0 ahead). **None deleted.**

## I. OPERATOR ACTIONS (human authorization / credentials / dashboard required)

1. **Authorize Production deployment** (Vercel frontend + Render backend) — required before any
   main merge, since a push auto-deploys.
2. **Run the §D SQL** in Neon (Production branch, genuinely read-only) and return results.
3. **Confirm Vercel + Render triggers** per §C (prod branch, auto-deploy, prod env vars,
   build/start, health check, no unintended migrate hook).
4. **Decide `0008` → Production** (needed for the public deletion URL to persist).
5. **Decide `PROCESSED` rename / fulfillment** for Play compliance.
6. **Enter keystore credentials locally** to build + validate the signed AAB (never in chat).
7. **Decide inclusion of `feat/client-admin-password-reset`** in the release.
8. **Explicitly approve** any Play public submission.

## J. FINAL SAFETY CONFIRMATION

- **MAIN MERGE: NOT EXECUTED** (`main` = `890ba58`, unchanged by me)
- **PRODUCTION DEPLOYMENT: NOT EXECUTED**
- **DATABASE MIGRATIONS: NOT EXECUTED**
- **BRANCH DELETIONS: NOT EXECUTED**
- **GOOGLE PLAY SUBMISSION: NOT EXECUTED**
- **PRODUCTION POND: NOT TOUCHED**

### Prioritized blockers
- **P0:** Production schema `0003–0006` unverified (esp. `0005` NOT NULL+trigger); Vercel/Render
  deploy triggers dashboard-unverified; Production-deploy authorization absent.
- **P1:** `0008` not in prod → public deletion URL can't persist (Play); signed AAB blocked on
  keystore creds; `PROCESSED` naming/fulfillment decision.
- **P2:** debug APK predates PR#17 (rebuild for device QA); `feat/client-admin-password-reset`
  inclusion decision; full authenticated device QA on the merged RC not run.
