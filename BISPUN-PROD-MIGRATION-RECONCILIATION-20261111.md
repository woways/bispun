# Bispun — Production Migration Reconciliation & Final Release Checklist (2026-11-11)

RC `eab0dd0` · main `f6b7dd5` (verified unchanged since the audit — 0 new commits).
`prisma validate` valid · `npm test` **86/86**. Builds on
`BISPUN-PROD-SCHEMA-CORRECTED-FINDING-20261111.md`. **Nothing executed against Production;
no db push; no merge/deploy; no branch/worktree deletion; no pond creds.**

Priority honored: keep the existing automatic Render Build Command (`npm install && npx prisma
generate && npx prisma db push`) **if** the reviewed migrations are applied first — which makes the
next db push a verified no-op (proven below). No build-command change is proposed.

---

## A. Migration-by-migration status matrix
Status is grounded in operator-verified prod facts (leadNumber MISSING, AccountDeletionRequest
ABSENT, preferredColleges EXISTS, DeviceToken PRESENT) and marked UNKNOWN where prod metadata has
not yet been read. Resolve every UNKNOWN with the §E queries before applying.

| # | File | Objects | Idempotent? | Prod status | Action |
|---|------|---------|-------------|-------------|--------|
| 0001 | add_device_token | `DeviceToken` table+idx+FKs | **NO** (bare CREATE) | **ALREADY APPLIED** (DeviceToken present) | **EXCLUDE** — re-run would error |
| 0002 | add_user_designation_and_level | `User.designationId/levelId/levelName` + 2 idx | YES | **UNKNOWN** | verify → apply if missing |
| 0003 | add_utm_influencer_name | `UtmLink.influencerName` | YES | **UNKNOWN** | verify → apply if missing |
| 0004 | add_lead_types_and_preferred_colleges | enum +5 values; `Lead.preferredColleges` | YES | **PARTIAL** — column APPLIED; **enum values UNKNOWN** | verify enum → apply (column is no-op) |
| 0005P | prod_stable_lead_number_nullable | `Lead.leadNumber`(nullable)+backfill+uniq idx+fn+trigger | YES | **MISSING** (confirmed) | **APPLY** (reviewed) |
| 0006 | add_lead_dataset_duplicate_details | `LeadDataset.duplicateDetails` JSONB | YES | **UNKNOWN** | verify → apply if missing |
| 0009 | add_admission_folder_locked | `AdmissionAttachmentFolder.locked` BOOL NN DEF false | YES | **UNKNOWN** (PR#18 newest → likely MISSING) | verify → apply if missing |
| 0008 | add_account_deletion_request | `AccountDeletionRequest` table + 3 idx | YES | **MISSING** (confirmed absent) | **APPLY** (reviewed) |
| 0007 | DRAFT_add_calendar_event_visibility | calendar visibility | — | **HOLD** | do not apply |

**0005 (original)** stays dev-only (it has `SET NOT NULL`, which conflicts with the Prisma `Int?`
model under db push). Prod uses **0005P** instead.

## B. Exact missing Production objects + evidence needed
- **Confirmed MISSING → will apply:** `Lead.leadNumber` (+ its backfill, unique index, function
  `assign_company_lead_number`, trigger `Lead_assign_lead_number`); `AccountDeletionRequest` (+ 3
  indexes).
- **Needs one read-only check each (§E) before deciding:** `User` designation/level cols+indexes;
  `UtmLink.influencerName`; the 5 new `LeadDatasetType` enum values; `LeadDataset.duplicateDetails`;
  `AdmissionAttachmentFolder.locked`.
- **Confirmed present → do nothing:** `Lead.preferredColleges`; `DeviceToken`.
Evidence = the §E query output from Neon `consulbuzz-production` → branch `production` → `neondb`
(read-only role, never pond write creds).

## C. Reviewed SQL — only the required changes (all guarded/idempotent)
Canonical per-object files (reviewed) in `prisma/pending-migrations/`:
`0002_…`, `0003_…`, `0004_…`, **`0005P_prod_stable_lead_number_nullable.sql`**, `0006_…`,
`0009_…`, `0008_…`. Optional master runbook: **`APPLY_prod_reconciliation_20261111.sql`** (ordered
`\i` includes; excludes 0001 and 0007). Every statement uses `IF NOT EXISTS` /
`CREATE OR REPLACE` / `DROP … IF EXISTS`, so applying an already-present object is a safe no-op.

**Risk review (§5):**
- **Duplicate-column:** none — all `ADD COLUMN IF NOT EXISTS` (0002/0003/0004/0005P/0006/0009).
- **Enum:** `ALTER TYPE … ADD VALUE IF NOT EXISTS` — must run **outside an explicit transaction
  block**; idempotent; cannot be rolled back by DROP VALUE (Postgres has none) — low concern, values
  are additive.
- **Index:** all `CREATE [UNIQUE] INDEX IF NOT EXISTS`. The `Lead_companyId_leadNumber_key` unique
  index tolerates many NULLs (NULLs distinct in Postgres), so it creates cleanly even before backfill.
- **Trigger/function:** `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` then `CREATE TRIGGER`
  — safe to re-run.
- **Constraint:** no new constraints except the unique index (0001's FKs are excluded/already in prod).
- **Data-backfill:** only 0005P writes data — `UPDATE … WHERE leadNumber IS NULL` (idempotent;
  second pass updates 0 rows). No other migration touches existing rows except 0009's default
  backfill (`false`), which is safe.

## D. Safe migration sequence + rollback/recovery
**Order** (validated): `0002 → 0003 → 0004 → 0005P → 0006 → 0009 → 0008`. Apply only the
MISSING/PARTIAL/UNKNOWN-confirmed-missing ones. Ordering is not strictly required (objects are
independent), but this order is what was validated and keeps enum-before-use tidy.
**Rollback (per object, additive → reversible):**
- 0008: `DROP TABLE IF EXISTS "AccountDeletionRequest";`
- 0009: `ALTER TABLE "AdmissionAttachmentFolder" DROP COLUMN IF EXISTS "locked";`
- 0006: `ALTER TABLE "LeadDataset" DROP COLUMN IF EXISTS "duplicateDetails";`
- 0005P: `DROP TRIGGER IF EXISTS "Lead_assign_lead_number" ON "Lead"; DROP FUNCTION IF EXISTS
  "assign_company_lead_number"(); DROP INDEX IF EXISTS "Lead_companyId_leadNumber_key"; ALTER TABLE
  "Lead" DROP COLUMN IF EXISTS "leadNumber";`
- 0004: `ALTER TABLE "Lead" DROP COLUMN IF EXISTS "preferredColleges";` (enum values cannot be
  dropped — harmless if unused)
- 0003/0002: drop the added columns/indexes.
**Recovery:** for any data-affecting incident prefer a **Neon branch/PITR restore** over manual
rollback. Capture a Neon branch snapshot immediately before applying (see §F).

## E. Post-/pre-migration read-only verification queries (Neon SQL editor, read-only role)
```sql
-- (1) columns present?
SELECT table_name, column_name, is_nullable, column_default
FROM information_schema.columns
WHERE (table_name='User'        AND column_name IN ('designationId','levelId','levelName'))
   OR (table_name='UtmLink'     AND column_name='influencerName')
   OR (table_name='Lead'        AND column_name IN ('preferredColleges','leadNumber'))
   OR (table_name='LeadDataset' AND column_name='duplicateDetails')
   OR (table_name='AdmissionAttachmentFolder' AND column_name='locked')
ORDER BY 1,2;
-- (2) enum values (expect base 5 + GOOGLE_FORM,WEBSITE_FORM,IM,DM,INTERNAL after apply)
SELECT string_agg(enumlabel,',' ORDER BY enumsortorder)
FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='LeadDatasetType';
-- (3) indexes present?
SELECT indexname FROM pg_indexes
WHERE indexname IN ('User_companyId_designationId_idx','User_companyId_levelId_idx','Lead_companyId_leadNumber_key')
ORDER BY 1;
-- (4) 0005P custom objects (Prisma cannot inspect these)
SELECT tgname  FROM pg_trigger WHERE tgname='Lead_assign_lead_number';
SELECT proname FROM pg_proc    WHERE proname='assign_company_lead_number';
-- (5) leadNumber integrity after apply (expect nulls=0 and NO dup rows)
SELECT count(*) AS leads, count(*) FILTER (WHERE "leadNumber" IS NULL) AS nulls FROM "Lead";
SELECT "companyId","leadNumber",count(*) FROM "Lead" GROUP BY 1,2 HAVING count(*)>1;
-- (6) account-deletion table
SELECT to_regclass('"AccountDeletionRequest"') AS adr;
```

## F. Updated release GO/NO-GO checklist — 🔴 NO-GO (operator steps remain)
| Gate | State |
|------|-------|
| RC consolidated, superset of main | ✅ 0 behind / 49 ahead |
| main unchanged since audit | ✅ `f6b7dd5`, 0 new commits |
| `prisma validate` / `npm test` | ✅ valid / 86-86 |
| Reviewed migration SQL prepared + validated (isolated DB, 2 passes, idempotent) | ✅ |
| leadNumber workflow (single/bulk/isolation/search/integrity) | ✅ proven |
| **Prod schema verified via §E** | 🔴 operator to run |
| **Approved migrations applied to prod (0005P, 0008, + any §E-missing)** | 🔴 operator |
| **Neon PITR window confirmed + pre-apply branch snapshot** | 🔴 operator |
| **Vercel prod branch/auto-deploy/rollback confirmed** | 🔴 operator |
| **Explicit deploy authorization** | 🔴 operator |
| Signed AAB (keystore creds) | 🔴 separate |
| Authenticated UI / device QA | 🟡 see G |

## G. Exact remaining actions to finish merge, verify prod, clean branches
1. **Verify prod** — run §E; mark each UNKNOWN as present/missing.
2. **Snapshot** — create a Neon branch of `production` (instant rollback point); note PITR window.
3. **Apply reviewed SQL** (missing items only) in the §D order via Neon SQL editor:
   **0005P** and **0008** for sure, plus any §E-missing (likely **0009**, possibly enum/others).
   Re-run §E (5)+(6): confirm **0 nulls, 0 dups**, trigger+function+index present.
4. **Confirm deploy platforms** — Vercel production branch=`main`, auto-deploy, a promotable previous
   deployment, prod `VITE_API_URL`=HTTPS; Render service healthy, build command unchanged.
5. **Authorize + merge** RC → main. Render runs `prisma db push` → now a **verified no-op** (prod ==
   schema; only object it could add, AccountDeletionRequest, is already applied) → backend deploys;
   verify `/api/health`. Frontend (Vercel) deploys; smoke-test login.
6. **Post-deploy prod verification** (read-only): a lead create/import shows an LD id; LD-search
   works; confidential folder lock works; account-deletion request persists.
7. **Authenticated UI/device QA** (not covered by `npm test`): web login + Lead Store create/import +
   Admissions confidential folder + Analytics drilldown; Android: fresh **debug** APK from
   `eab0dd0` on Pixel_6 (login, lead list, LD ids). Signed AAB remains blocked on keystore creds.
8. **Branch cleanup** — ONLY after a verified-healthy deploy, and only branches fully merged into
   main (0 ahead): candidates `feat/admissions-notifications-calendar`, `feat/mobile-ui-optimization`,
   `feat/referrals-integration`, `hotfix/prod-login-coldstart`, `integration/mui-yc`,
   `finance-changes` (re-confirm each `git branch --merged` before deletion). Retain `main`, RC,
   PR#13 head, signing branches, `feat/client-admin-password-reset`, all backup tags. (No deletion
   now — HOLD per instruction.)

## Evidence this run
All pending SQL read (0001–0009); main `f6b7dd5` unchanged (0 new commits); full set applied twice
in an isolated Postgres 18 clone (prod-like baseline) — idempotent, 0 errors, enum=10 values,
leadNumber 0 nulls/0 dups with correct ordering + per-company isolation + trigger-assigned new rows,
locked NOT NULL default false, AccountDeletionRequest + 3 indexes; `prisma validate` valid; `npm
test` 86/86. No prod writes, no db push, no merge/deploy, no branch deletion, no pond creds.
