# Production deploy runbook — unblock PR #43 (notification deep-links)

**Status: PRODUCTION DEPLOY BLOCKED until the operator completes Steps 1–4 below under explicit approval.**
Nothing in this runbook has been executed against production by automation. No production data was read or modified while preparing it.

## Why the deploy is blocked (root cause)
- Per operator-confirmed evidence, the Render **Build Command runs `prisma db push`** against the production database on every deploy (uncontrolled schema sync).
- Production `public."Lead"` is **missing the `leadNumber` column** (migration 0005 was never applied). The Prisma model is `leadNumber Int?`.
- A `db push` would add `leadNumber` as a **bare nullable column plus the unique index, but WITHOUT** the backfill, the `assign_company_lead_number()` function, or the `BEFORE INSERT` trigger (Prisma does not model DB functions/triggers). Result: new leads get `NULL` lead numbers and stable "LD" IDs silently break. Not data loss, but a shipped-broken feature.
- `main` has also advanced since the last validated reconciliation (referrals `0007_add_referral_credit_audit`, SMS `0010_add_sms_config`, and coupon/pricing changes that may have **no hand-written SQL** and would otherwise arrive only via `db push`).

## Prerequisites (operator)
1. Confirm a **Neon PITR window** and take a **branch/snapshot** of `production` immediately before changes (primary rollback).
2. Have the **production** `DATABASE_URL` available in a secure shell (never commit it; never paste it into chat).
3. Apply everything via the **Neon SQL editor with autocommit** (NOT one big transaction — `0004` uses `ALTER TYPE ... ADD VALUE`). Every reviewed file is guarded with `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP ... IF EXISTS`, so re-applying an already-present object is a safe no-op.

## Step 1 — Authoritative, READ-ONLY drift check (do this first)
This is the source of truth for the *current* gap (captures referrals/SMS/coupons even where no hand-written SQL exists):
```
npx prisma migrate diff \
  --from-url "$PROD_DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prod_drift.sql    # READ-ONLY; writes nothing to the DB
```
Also run the read-only `information_schema` / `pg_indexes` / `pg_trigger` / `pg_proc` checks in `BISPUN-PROD-SCHEMA-CORRECTED-FINDING-20261111.md §6` to confirm which objects are MISSING.
Review `prod_drift.sql`: apply only MISSING objects. **Anything it shows that is not covered by a reviewed file below (e.g. coupon/pricing tables that currently rely on `db push`) must be turned into reviewed SQL and approved before applying.**

## Step 2 — Apply reviewed migrations in THIS order (Neon SQL editor, autocommit)
Reviewed, idempotent files already in `prisma/pending-migrations/`. Base order is the validated `APPLY_prod_reconciliation_20261111.sql` (validated twice on an isolated Postgres 18 prod-like clone: 0 errors, 0 null lead numbers, 0 duplicates), extended with the newer migrations:
1. `0002_add_user_designation_and_level.sql`
2. `0003_add_utm_influencer_name.sql`
3. `0004_add_lead_types_and_preferred_colleges.sql`  ← enum `ADD VALUE`, must run outside an explicit transaction
4. `0005P_prod_stable_lead_number_nullable.sql`  ← **use 0005P, NOT 0005** (0005's `SET NOT NULL` would re-introduce drift vs the `Int?` model that a later `db push` would fight)
5. `0006_add_lead_dataset_duplicate_details.sql`
6. `0007_add_referral_credit_audit.sql`
7. `0009_add_admission_folder_locked.sql`
8. `0008_add_account_deletion_request.sql`
9. `0010_add_sms_config.sql`
10. Any additional reviewed SQL derived from `prod_drift.sql` in Step 1 (e.g. coupon/pricing schema).

**Do NOT apply:** `0001_add_device_token.sql` (already in prod, not idempotent — would error) or `0007_DRAFT_add_calendar_event_visibility.sql` (on hold).

## Step 3 — Post-apply verification (expect the stated results)
```
-- lead numbers: expect 0 nulls and no duplicate rows
SELECT count(*) FILTER (WHERE "leadNumber" IS NULL) AS nulls FROM "Lead";
SELECT "companyId","leadNumber",count(*) FROM "Lead" GROUP BY 1,2 HAVING count(*)>1;
-- trigger + function present
SELECT tgname FROM pg_trigger WHERE tgname = 'Lead_assign_lead_number';
SELECT proname FROM pg_proc WHERE proname = 'assign_company_lead_number';
-- enum values present
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='LeadDatasetType';
-- additive tables/columns present
SELECT to_regclass('"AccountDeletionRequest"');
SELECT column_name FROM information_schema.columns WHERE table_name='SystemSettings' AND column_name LIKE 'sms%';
```
Confirm existing leads, their lead IDs, and per-tenant numbering are intact (spot-check a few companies' `(companyId, leadNumber)` sequences are contiguous and unchanged for pre-existing rows).

## Step 4 — Remove the unsafe automatic `db push` (deployment config, operator-side)
After Step 2, prod == schema, so a `db push` would be a no-op on `Lead`. Make it safe permanently:
- **Change the Render Build Command** from `npm install && npx prisma generate && npx prisma db push` to **`npm install && npx prisma generate`** (drop `db push`). This is in the Render dashboard, **not** in this repo — it requires an operator with Render access.
- Long-term (recommended, separate change): adopt `prisma migrate` with a committed baseline in `prisma/migrations/` and deploy via `prisma migrate deploy`, replacing the hand-applied-SQL process. `prisma.config.ts` already points `migrations.path` at `prisma/migrations` (currently empty).

## Step 5 — Merge PR #43 and deploy (only after Steps 1–4 pass)
1. Mark PR #43 "Ready for review", obtain required approvals (do not bypass branch protection).
2. Merge to `main`. With `db push` removed, the Render build runs `prisma generate` only — no schema mutation.
3. Verify backend `/api/health` → then Vercel frontend. Re-run the Step 3 verification against prod post-deploy.

## Rollback / recovery
- Primary: Neon **PITR / branch restore** to the pre-change snapshot (Prerequisite 1).
- Per-object: each reviewed SQL file carries its own `DROP ... IF EXISTS` rollback (see the rollback block at the bottom of `0005P_prod_stable_lead_number_nullable.sql`).

## GO criteria (all must hold before merge)
- Step 1 drift reviewed; all MISSING objects have reviewed SQL.
- Step 2 applied; Step 3 verification shows 0 null / 0 duplicate lead numbers, trigger + function present, additive objects present, existing lead IDs intact.
- Step 4 `db push` removed from the Render build command.
- Then — and only then — PR #43 is safe to merge/deploy.
