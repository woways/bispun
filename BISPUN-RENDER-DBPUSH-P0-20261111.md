> **⚠️ UPDATE (see BISPUN-PROD-SCHEMA-CORRECTED-FINDING-20261111.md):** the deployment-mechanism P0
> here (Render build runs `prisma db push`) stands. But the `leadNumber` row in the table below
> ("prod = NOT NULL → db push DROPs NOT NULL") is **wrong**: prod `Lead.leadNumber` is **MISSING**
> (verified 2026-11-11), so db push would **ADD a nullable column + index** (no trigger/backfill),
> leaving the feature non-functional. Fix by applying `0005P` first. Use the corrected doc.

# Bispun — P0 CORRECTION: Render runs `prisma db push` on every deploy (2026-11-11)

**Supersedes** the earlier statement in `BISPUN-RELEASE-GATE-REPORT-20261110.md` and
`BISPUN-FINAL-MERGE-REPORT-20261111.md` that "no migration runs automatically on deploy."
**That was wrong for Render.** Operator dashboard evidence:

- **Render service:** `bispun-api` · connected branch **`main`** · **Auto-Deploy: On Commit** ·
  Pre-Deploy: empty · Start: `npm run server` ·
  **Build Command: `npm install && npx prisma generate && npx prisma db push`**
- **Neon:** project `consulbuzz-production`, branch `production`, db `neondb`. `DeviceToken`
  present; **`AccountDeletionRequest` absent** (`to_regclass` null). Column/enum/index/trigger
  tabs still pending.
- **Vercel:** repo connected; production branch / status / rollback still to verify.

## 1. Corrected Production risk — 🔴 P0
A push/merge to `main` auto-deploys `bispun-api` on Render, whose **build runs `prisma db push`
against the Production `DATABASE_URL`**. `db push` makes Production's schema **match
`schema.prisma`** with **no migration history, no review, and no approval gate** — the exact
"uncontrolled Production schema synchronization" we must prevent. This is now the top blocker.

### How `db push` reaches Production (no credential exposure)
Render injects the service's `DATABASE_URL` env var (the Production Neon connection string) into
the build shell; `prisma db push` reads it and connects directly to `neondb` on branch
`production`. The credential lives only in Render's env store — it is never printed here and must
not be. (We did not read it.)

### What the next `db push` WOULD do to Production (diff vs `schema.prisma`)
Because `db push` has run on prior `main` deploys, Production already tracks **main's**
`schema.prisma`. Merging the RC adds/changes:

| Change | db push action | Risk |
|---|---|---|
| `AccountDeletionRequest` model (RC-only; absent in prod) | **CREATE TABLE** + indexes automatically | low (additive) but **unapproved/uncontrolled** |
| `AdmissionAttachmentFolder.locked` (in main already) | likely already pushed by PR#18 deploy | low |
| `0003–0006` columns/enum (in main) | likely already pushed by their deploys | low |
| **`Lead.leadNumber`**: schema = `Int?` (nullable); prod = **NOT NULL** (from 0005 SQL) | **db push DROPs NOT NULL** to match schema | **unintended regression** — weakens the stable-ID guarantee (trigger still fills it, but the constraint is lost) |
| DB **trigger** `assign_company_lead_number` + function (not in Prisma schema) | **not managed** by db push (left as-is) | ok, but a fresh/reset DB would get `leadNumber` with **no trigger/backfill** |
| Any prod object absent from `schema.prisma`, or a narrowing type change | **db push aborts** (bare command, no `--accept-data-loss`) | **build FAILS → backend not deployed → partial/mixed-version deploy** |

### Failure / data-loss / lock / partial-deploy modes
- **Partial deployment:** Vercel (frontend) and Render (backend) deploy independently. If the
  Render build fails at `db push` (any data-loss-requiring diff, or an enum-value removal, which
  Postgres can't do in-place), **the frontend can go live against an un-updated or down backend.**
- **Data loss:** `db push` is destructive-capable. With no `--accept-data-loss` it refuses such
  changes (fails the build) rather than dropping data — safer, but still breaks the deploy; if
  anyone ever adds `--accept-data-loss`, it would drop columns/tables to match the schema.
- **Drift:** the `leadNumber` NOT NULL→nullable change above would actually be applied on the
  next deploy — an unintended Production change driven purely by schema/DB divergence.
- **Locks:** additive columns are low-risk; a type change or new index on large tables can hold
  locks during deploy.

## 2. Exact proposed SAFE Render Build Command (prepare only — do NOT change the dashboard yet)
```
npm install && npx prisma generate
```
- Keeps dependency install + **Prisma Client generation** (required for the backend to run).
- **Removes `prisma db push`** so deploys never auto-sync Production schema.
- Schema changes then go through a **separate, reviewed, explicitly-approved** step (below).
- Changing this is an operator dashboard action requiring separate approval; it is NOT done here.

## 3. Required schema changes + approvals (gated; nothing executed)
First finish the read-only checks (§4). For each **missing** object, apply additive SQL in order,
each reviewed and separately authorized, to Neon `production` (never via an uncontrolled `db push`):

`0003_utm_influencer_name` → `0004_lead_types_and_preferred_colleges` →
`0005_stable_lead_number` → `0006_lead_dataset_duplicate_details` →
`0009_add_admission_folder_locked` → `0008_add_account_deletion_request`
(**skip `0007` calendar — HOLD**). Most are idempotent (`IF NOT EXISTS`). **`0005`** is special:
backfill + `SET NOT NULL` + unique index + trigger/function; run off-peak; verify 0 NULL
`leadNumber` after. Note: if Production already has `0003–0006`/`locked` (pushed by earlier main
deploys), those steps are no-ops — the read-only check decides.

**Reconcile the `leadNumber` drift:** either change `schema.prisma` `leadNumber Int?` → `Int`
(non-null) so a future managed migration matches prod, or keep nullable and rely on the trigger —
decide before adopting `migrate deploy`. (No schema edit made in this task.)

**Rollback per object:** `DROP TABLE "AccountDeletionRequest"`; `ALTER TABLE
"AdmissionAttachmentFolder" DROP COLUMN "locked"`; drop added columns/enums/index/trigger. Prefer
Neon branch/PITR for any data-affecting incident.

## 4. Remaining operator read-only SQL (Neon → project consulbuzz-production → branch production → neondb → SQL Editor)
```sql
-- columns (0002/0003/0004/0005/0006 + PR#18 locked)
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE (table_name='User'        AND column_name IN ('designationId','levelId','levelName','leadStoreColumnOrder'))
   OR (table_name='UtmLink'     AND column_name='influencerName')
   OR (table_name='Lead'        AND column_name IN ('preferredColleges','leadNumber'))
   OR (table_name='LeadDataset' AND column_name='duplicateDetails')
   OR (table_name='AdmissionAttachmentFolder' AND column_name='locked')
ORDER BY table_name, column_name;
-- enum values (expect incl. GOOGLE_FORM, WEBSITE_FORM, IM, DM, INTERNAL)
SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
WHERE t.typname='LeadDatasetType' ORDER BY e.enumsortorder;
-- 0005 unique index + trigger (expect both present; note leadNumber is_nullable above)
SELECT indexname FROM pg_indexes WHERE tablename='Lead' AND indexname='Lead_companyId_leadNumber_key';
SELECT tgname FROM pg_trigger WHERE tgname='Lead_assign_lead_number';
```

## 5. Frontend/backend mixed-version compatibility + deployment ordering
- The candidate backend reads `AccountDeletionRequest` (guarded, fail-safe 503 if absent) and
  `AdmissionAttachmentFolder.locked`, `Lead.leadNumber`, etc. (direct).
- **Safe order (after the build command is fixed):** (1) apply approved schema SQL to prod →
  (2) deploy **backend** (Render) and verify `/api/health` → (3) deploy **frontend** (Vercel) with
  the prod HTTPS `VITE_API_URL`. Backend-before-frontend avoids the new UI calling absent columns.
- With the CURRENT `db push` build command, ordering can't be guaranteed (schema sync + backend
  deploy are coupled, and a failure strands the frontend) — another reason to fix the build first.

## 6. Rollback & deployment-control runbook (prepared; not executed)
1. **Freeze:** since Auto-Deploy is On Commit, do not push `main` until the build command is fixed.
2. **Frontend rollback:** Vercel → Deployments → previous Production → Promote.
3. **Backend rollback:** Render → Events/Deploys → Rollback to last healthy commit.
4. **Code ref:** `backup/pre-release/main-20261110b` = `890ba58`; `backup/pre-consolidation/main-20261110` = `29283ec`.
5. **DB:** additive changes need no DB rollback on code revert; for a bad `0005`, drop trigger/
   function/index/column; use Neon branch/PITR for data incidents.
6. **Workers:** confirm prod `DISABLE_BACKGROUND_WORKERS`; to halt outbound during an incident set
   it true and restart.
- Untested: platform rollbacks not exercised; Neon PITR window unconfirmed.

## 7. Updated GO/NO-GO — 🔴 NO-GO
Blockers (prioritized):
- **P0:** Render Build Command runs uncontrolled `prisma db push` on Production → must be changed
  to `npm install && npx prisma generate` (operator, approved) before any merge.
- **P0:** Production column/enum/index/trigger state still unverified (run §4); `AccountDeletionRequest`
  confirmed **absent** in prod.
- **P0:** Vercel production branch / auto-deploy / rollback not yet confirmed.
- **P1:** `leadNumber` schema(`Int?`)-vs-prod(NOT NULL) drift to reconcile; signed AAB keystore creds.
Do not mark GO until the `db push` risk is eliminated via an approved, verified process **and** §4
+ Vercel checks pass.

## Preserved / untouched
No merge/push to main; no Render/Vercel deploy; no dashboard change; no `db push`; no migration;
no pond access with app credentials; no branch deletion; no Play submission. All Web/Backend/
Mobile features and all Git branches/backup tags preserved. RC unchanged except this doc.
