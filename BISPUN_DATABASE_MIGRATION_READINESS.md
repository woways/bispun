# Bispun CRM — Database & Migration Readiness

**Date:** 2026-11-12. Verified against `origin/main`/integration branch schema + `prisma/pending-migrations/`. Production DB state is **cited prior operator evidence** (I have no authorized prod DB access) — re-confirm before applying.

## 1. Mechanism (verified)
- **No `prisma/migrations/` managed history.** Schema reaches a DB only via **`prisma db push`** (`package.json:prisma:push`). All versioned SQL is **manual** in `prisma/pending-migrations/`.
- **`db push` applies the schema's columns/indexes but NOT triggers/functions/backfills.** The stable-Lead-ID **trigger `Lead_assign_lead_number` + function `assign_company_lead_number`** exist **only** in `0005*.sql`, never in `schema.prisma`. Confirmed again on this branch.

## 2. Local verification (this branch, DB `bispun_final`)
- `prisma db push` → 61 tables. `0005P` applied → trigger present. Seed + provision OK.
- Lead creation assigns `leadNumber` (LDxxx), 0 NULL — stable Lead ID **works locally** with the trigger applied.
- `@@unique([companyId, leadNumber])` present → per-company uniqueness enforced.
- Admission→lead linkage verified (shared Lead ID). Account-deletion schema (`AccountDeletionRequest`) present + rows persisted.

## 3. Production DB state (CITED — re-verify, read-only, authorized)
Per `BISPUN-PROD-SCHEMA-CORRECTED-FINDING-20261111.md` (operator ran read-only `information_schema` on Neon `consulbuzz-production`):
- `Lead.leadNumber` **MISSING** → migration **0005 never applied** → **stable Lead ID non-functional in prod** (new leads would get NULL → blank LD id; UI degrades gracefully).
- `AccountDeletionRequest` **ABSENT**.
- `preferredColleges` (0004) present → prod sits **between 0004 and 0005**.
- 0005 unique index + trigger **absent** (cannot exist without the column).
- Referral lifecycle migration **0007** columns are in `schema.prisma` → a prod `db push` would add them; whether a deploy has run since is **UNVERIFIED** (backend route exists ⇒ code deployed).

## 4. Migration number collision to resolve BEFORE any referral-signup work
If `fa0518f` is ever adopted, its `0008_referral_referred_stage.sql` **collides** with main's `0008_add_account_deletion_request.sql`. Renumber (e.g. `0010_referral_referred_stage.sql`) and reconcile the `CrmReferral` schema change deliberately.

## 5. Safe production migration sequence (PREPARED — do NOT execute; needs separate approval)
Pre-reqs: take a Neon branch/PITR snapshot; run off-peak; verify each object read-only first.
Apply only the **missing** objects to Neon `production` via the SQL editor (reviewed, approved), idempotent order:
1. `0003_add_utm_influencer_name`
2. `0004_add_lead_types_and_preferred_colleges` (column present; verify the 5 enum values — `ALTER TYPE ... ADD VALUE` must run outside a txn)
3. **`0005P_prod_stable_lead_number_nullable.sql`** ← REQUIRED (adds column + backfill + unique index + function + trigger)
4. `0006_add_lead_dataset_duplicate_details`
5. `0009_add_admission_folder_locked`
6. `0008_add_account_deletion_request`
7. **HOLD `0007_DRAFT_add_calendar_event_visibility`** (draft)

### Validation after each (examples)
```sql
SELECT count(*) FILTER (WHERE "leadNumber" IS NULL) AS nulls FROM "Lead";            -- expect 0 after 0005P
SELECT "companyId","leadNumber",count(*) FROM "Lead" GROUP BY 1,2 HAVING count(*)>1;  -- expect 0 rows
SELECT tgname FROM pg_trigger WHERE tgname='Lead_assign_lead_number';                 -- expect 1 row
SELECT to_regclass('public."AccountDeletionRequest"');                                -- expect non-null after 0008
```

## 6. Failure recovery / rollback
- `db push`/bare SQL that hits a data-loss diff **aborts** (no `--accept-data-loss`) → fix forward, don't force.
- Per-object rollback: drop added column/index/trigger/function/table (each migration documents its own rollback). Prefer **Neon branch/PITR** for any data-affecting incident.
- Code rollback: Render → previous deploy; Vercel → promote previous. Additive schema needs no DB rollback on code revert.

## 7. Readiness verdict
🔴 **NOT ready.** Prod schema is behind (0004→0005) and the `db push` deploy mechanism cannot complete the stable-ID trigger. Apply the sequence above (approved) + fix the build command (see Deployment Readiness) before release.
