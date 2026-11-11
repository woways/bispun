# Bispun — CORRECTED Production Schema Finding + Verified Lead-Number Workflow Test (2026-11-11)

**Supersedes the `leadNumber` conclusions in** `BISPUN-PROD-DBPUSH-AUTHORITATIVE-AUDIT-20261111.md`,
`BISPUN-DBPUSH-IMPACT-AUDIT-20261111.md`, and `BISPUN-RENDER-DBPUSH-P0-20261111.md`.
RC HEAD `b762edf`; `prisma validate` valid; `npm test` **86/86** at this SHA. Nothing merged,
deployed, pushed, migrated; no branches deleted; prod `pond` untouched; no credentials used.

## 0. The corrected fact (operator-verified, read-only)
Operator ran read-only `information_schema.columns` on Neon `consulbuzz-production` → branch
`production` → `neondb` → schema `public`:
- `public."Lead"` **exists**, but column **`leadNumber` DOES NOT EXIST**.
- `preferredColleges`, `assignedToUserId`, `followUpAt`, `alternatePhone` **exist**.

→ Migration **0005 was never applied to Production**. The earlier assumption "prod `leadNumber`
is NOT NULL" and the "db push would DROP NOT NULL" simulation **do not describe current prod** and
are **withdrawn**. (`preferredColleges` existing confirms 0004's column reached prod; so prod sits
between 0004 and 0005 — the last db push predates `leadNumber` entering the schema.)

## 1. Exact effect of the next Render `prisma db push` (from the REAL prod schema)
Authoritative `migrate diff` (Prisma 7.9.1) from a prod-like schema (leadNumber + its index +
`AccountDeletionRequest` removed) → RC `schema.prisma`:
```sql
ALTER TABLE "Lead" ADD COLUMN "leadNumber" INTEGER;                      -- nullable, NO backfill, NO NOT NULL
CREATE TABLE "AccountDeletionRequest" ( ... );                           -- additive
CREATE INDEX "AccountDeletionRequest_status_createdAt_idx" ...;
CREATE INDEX "AccountDeletionRequest_email_idx" ...;
CREATE INDEX "AccountDeletionRequest_companyId_idx" ...;
CREATE UNIQUE INDEX "Lead_companyId_leadNumber_key" ON "Lead"("companyId","leadNumber");
```
**Conspicuously ABSENT** from db push: the **backfill UPDATE**, `SET NOT NULL`,
`CREATE FUNCTION assign_company_lead_number`, and `CREATE TRIGGER Lead_assign_lead_number`.
Both ops db push *does* emit are non-destructive, so the build would **succeed** — silently shipping
a **half-built feature**. This proves your point: **`prisma db push` alone does NOT complete the
stable Lead ID feature.**

## 2. Migration 0005 in full (what db push omits)
`prisma/pending-migrations/0005_add_stable_lead_number.sql`: (1) ADD COLUMN nullable → (2) backfill
via `ROW_NUMBER()` partitioned by `companyId`, ordering LEAD_STORE/Admissions-origin first then
`createdAt` → (3) `SET NOT NULL` → (4) unique index `Lead_companyId_leadNumber_key` → (5) function
`assign_company_lead_number` (serialized with `pg_advisory_xact_lock(hashtext(companyId))`,
`MAX(leadNumber)+1`) → (6) BEFORE-INSERT trigger `Lead_assign_lead_number`. The app **never writes
`leadNumber`** on create (verified across `clientLeads`, `clientLeadStore`, `clientWalkins`,
`admissionsLeadSync`); the trigger is the sole assignment path.

## 3. Trigger/function/index remnants in prod? — effectively impossible, verify anyway
With the `leadNumber` **column missing**, the 0005 trigger/function/index cannot exist (creating the
index or a trigger that reads `NEW."leadNumber"` requires the column; 0005 is all-or-nothing). So
there should be **no remnants**. Confirm with the read-only SQL in §6(C).

## 4. VERIFIED workflow test (isolated Postgres 18 clone, prod-like schema)
Built an ephemeral local cluster, created `Lead` **without** `leadNumber`, then:
- **Stage A — bare db push** (ADD nullable column + unique index only): a new lead insert →
  `leadNumber = NULL`. **Every row NULL → feature dead, but no crash, no data loss.** ✅ matches §1.
- **Stage B — reviewed nullable 0005** (`0005P`, below): backfill gave `1,2,3` (C1) and `1` (C2) in
  the correct historical order; idempotent over the Stage-A state (`IF NOT EXISTS` no-ops).
- **TEST 1 — single create** → `leadNumber = 4` (trigger assigns). ✅
- **TEST 2 — bulk import in ONE multi-row INSERT** (the `tx.lead.createMany` path): rows got
  **distinct 5,6,7,8,9, no unique-index violation.** The BEFORE-INSERT trigger's `MAX()+1` sees
  earlier same-statement rows, so batch imports are safe. ✅ (This was the main open risk.)
- **TEST 3 — per-company isolation**: C2 numbered independently (1 then 2). ✅
- **TEST 4 — LD-id search** (`/^LD0*(\d+)$/` → numeric): `LD004` returned the right lead. ✅
- **TEST 5 — integrity**: 11 rows, **0 NULLs, 0 duplicates** per `(companyId, leadNumber)`. ✅
- **RC backend**: `formatLeadDisplayId(null)` → `Number(null)=NaN` → returns `null` (graceful; no
  crash) and `lead.leadNumber || null` → `null`. So even in the interim half-pushed state the UI
  degrades gracefully (blank LD id), confirming a graceful fallback, not a hard dependency.

## 5. Required Production changes, safe order, rollback (nothing executed)
Verify each object first (§6); apply only the **missing** ones, each reviewed + separately approved,
to Neon `production` via the SQL editor — **not** via uncontrolled db push. Idempotent order:
1. `0002_add_user_designation_and_level` (verify first; likely present)
2. `0003_add_utm_influencer_name`
3. `0004_add_lead_types_and_preferred_colleges` — **column present**; verify the 5 ENUM values too
   (`ALTER TYPE ... ADD VALUE` must run **outside** a transaction block)
4. **`0005P_prod_stable_lead_number_nullable.sql`** ← the prod-safe variant (REQUIRED; column
   confirmed missing)
5. `0006_add_lead_dataset_duplicate_details`
6. `0009_add_admission_folder_locked` (PR#18; newer than prod's last deploy → likely missing)
7. `0008_add_account_deletion_request` (confirmed absent)
— **skip `0007` (calendar) — HOLD.**

Applying 4–7 as reviewed SQL makes the subsequent merge-triggered `db push` a **verified no-op**
(prod == schema). **Rollback** is per-object DROP (table/column/index/trigger/function); prefer Neon
branch/PITR for any data incident. Backfill data is derived and regenerable.

## 6. Operator read-only verification SQL (run before applying anything)
```sql
-- A) columns (0002/0003/0004/0005/0006 + PR#18 locked)
SELECT table_name, column_name, is_nullable, column_default
FROM information_schema.columns
WHERE (table_name='User'        AND column_name IN ('designationId','levelId','levelName','leadStoreColumnOrder'))
   OR (table_name='UtmLink'     AND column_name='influencerName')
   OR (table_name='Lead'        AND column_name IN ('preferredColleges','leadNumber'))
   OR (table_name='LeadDataset' AND column_name='duplicateDetails')
   OR (table_name='AdmissionAttachmentFolder' AND column_name='locked')
ORDER BY table_name, column_name;
-- B) enum values from 0004 (expect GOOGLE_FORM, WEBSITE_FORM, IM, DM, INTERNAL present)
SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
WHERE t.typname='LeadDatasetType' ORDER BY e.enumsortorder;
-- C) confirm NO 0005 remnants while column is missing (expect all empty)
SELECT indexname FROM pg_indexes WHERE tablename='Lead' AND indexname='Lead_companyId_leadNumber_key';
SELECT tgname FROM pg_trigger WHERE tgname='Lead_assign_lead_number';
SELECT proname FROM pg_proc WHERE proname='assign_company_lead_number';
-- D) account-deletion table
SELECT to_regclass('"AccountDeletionRequest"') AS adr;  -- expect null (absent) -> will be created
```

## 7. Keep automatic Render `db push`? — YES, safely, IF migrations are applied first
Your preference to retain automatic deploys is achievable **without regressions**:
- Apply steps 4–7 (reviewed) to prod **before** merging. `0005P` keeps `leadNumber` **nullable**
  (matching the `Int?` model) + backfill + trigger + unique index → feature fully works, enforced by
  the trigger/index.
- The next db push then changes **nothing** on `Lead` (no ADD, no DROP NOT NULL — proven idempotent)
  and nothing on `AccountDeletionRequest` (already applied). Build command can stay as-is.
- The only deliberate difference vs the dev 0005 is **no hard NOT NULL** (incompatible with `Int?`
  under db push). The trigger guarantees population; the unique index prevents duplicates. This is a
  reviewed decision, **not** a missing backfill or a feature regression.
- If you require a hard NOT NULL instead, that needs the build command changed to
  `npm install && npx prisma generate` (drop db push) — a separate approval; not done here.

## 8. GO / NO-GO — 🔴 NO-GO (pending operator apply + confirmations), with a proven safe path
Flips to **GO** when:
1. §6 verification run; apply missing items in the §5 order, including **`0005P`** (confirmed
   required) and `0008` (confirmed absent); confirm 0 NULL `leadNumber` and 0 dups afterward.
2. Neon PITR/restore window confirmed; Vercel production branch + auto-deploy + rollback confirmed.
3. Explicit authorization for the controlled Production deploy.
Then: merge RC→main → db push is a verified no-op on Lead + creates nothing already applied →
backend deploy (verify `/api/health`) → frontend. Stable-ID feature ships complete. Signed AAB
remains separate (keystore creds). Branch cleanup only after a verified-healthy deploy.

## Evidence this run
Prisma 7.9.1; `migrate diff` prod-like→RC (exact db push SQL); isolated-clone workflow test
(Stage A/B + 5 tests, all pass, 0 nulls/0 dups, bulk-insert distinct); backend read-only + graceful
null handling; `prisma validate` valid; `npm test` 86/86; git main `f6b7dd5`, RC `b762edf`.
No merge/deploy/db-push/migration/dashboard change/branch deletion; pond untouched; no creds.
