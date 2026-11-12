# Bispun — Consolidated Operator Checklist (2026-11-11)

Everything below needs **operator** access (Neon SQL editor with a read-only/approved role, Render &
Vercel dashboards, and your explicit deploy authorization). Claude has completed all independent,
authorized work; these are the only remaining actions, in order. **Do them top to bottom.** RC
`7563478` · main `f6b7dd5` (0 behind / 50 ahead). Nothing here has been executed.

Rules still in force: never use pond creds; never force-push main; keep the Render Build Command
unchanged; 0007 on HOLD; 0001 excluded (already applied, not idempotent).

---

## STEP 1 — Read-only Production inventory (one block; Neon → consulbuzz-production → production → neondb → SQL editor)
Run as a **read-only** role. Paste all results back.
```sql
-- (A) Columns for 0002/0003/0004/0005/0006 + PR#18 locked
SELECT table_name, column_name, is_nullable, column_default
FROM information_schema.columns
WHERE (table_name='User'        AND column_name IN ('designationId','levelId','levelName'))
   OR (table_name='UtmLink'     AND column_name='influencerName')
   OR (table_name='Lead'        AND column_name IN ('preferredColleges','leadNumber'))
   OR (table_name='LeadDataset' AND column_name='duplicateDetails')
   OR (table_name='AdmissionAttachmentFolder' AND column_name='locked')
ORDER BY 1,2;
-- (B) Enum values (expect base 5; after 0004 also GOOGLE_FORM,WEBSITE_FORM,IM,DM,INTERNAL)
SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder)
FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='LeadDatasetType';
-- (C) Indexes
SELECT indexname FROM pg_indexes
WHERE indexname IN ('User_companyId_designationId_idx','User_companyId_levelId_idx','Lead_companyId_leadNumber_key')
ORDER BY 1;
-- (D) Custom objects Prisma can't see (expect ALL EMPTY while leadNumber is missing)
SELECT tgname  FROM pg_trigger WHERE tgname='Lead_assign_lead_number';
SELECT proname FROM pg_proc    WHERE proname='assign_company_lead_number';
-- (E) Tables present?
SELECT to_regclass('"AccountDeletionRequest"') AS adr, to_regclass('"DeviceToken"') AS devicetoken;
-- (F) Lead data sanity (pre-migration)
SELECT count(*) AS leads FROM "Lead";
```
**Expected from your prior checks:** `leadNumber` absent, `preferredColleges` present, DeviceToken
present, AccountDeletionRequest null. (A)/(B)/(C) decide the remaining UNKNOWNs (0002, 0003, enum,
0006, 0009).

## STEP 2 — Backup / recovery (before any write)
- Neon → project `consulbuzz-production` → branch `production`: **create a branch** (instant restore
  point) and note the **PITR/history-retention window** (hours/days). Record both.
- Confirm you can restore from that branch if needed.

## STEP 3 — Apply ONLY the missing reviewed SQL (approved, in order)
From `prisma/pending-migrations/`, apply only items STEP 1 shows missing. Confirmed required:
**`0005P_prod_stable_lead_number_nullable.sql`** and **`0008_add_account_deletion_request.sql`**.
Likely also **`0009_add_admission_folder_locked.sql`**; apply `0002/0003/0004/0006` only if missing.
Order: `0002 → 0003 → 0004 → 0005P → 0006 → 0009 → 0008`. Run enum (`0004`) **outside** an explicit
transaction. (Optional master: `APPLY_prod_reconciliation_20261111.sql`.) **Do NOT** run 0001 or 0007.

## STEP 4 — Post-migration verification (read-only; must pass)
```sql
SELECT count(*) FILTER (WHERE "leadNumber" IS NULL) AS nulls FROM "Lead";      -- expect 0
SELECT "companyId","leadNumber",count(*) FROM "Lead" GROUP BY 1,2 HAVING count(*)>1;  -- expect 0 rows
SELECT tgname FROM pg_trigger WHERE tgname='Lead_assign_lead_number';          -- expect 1 row
SELECT proname FROM pg_proc WHERE proname='assign_company_lead_number';        -- expect 1 row
SELECT to_regclass('"AccountDeletionRequest"');                               -- expect non-null
SELECT column_name,is_nullable,column_default FROM information_schema.columns
 WHERE table_name='AdmissionAttachmentFolder' AND column_name='locked';        -- expect locked / NO / false
```
If any fails → STOP, restore from the STEP 2 branch, report.

## STEP 5 — Confirm deploy platforms (dashboards)
- **Render** `bispun-api`: branch `main`, Auto-Deploy On Commit, Build Command unchanged, current
  deployed SHA, and that **Rollback** to a previous deploy is available.
- **Vercel** (woways/bispun): Production branch = `main`, auto-deploy on, current Production SHA,
  a previous deployment is **promotable** (rollback), and Production env `VITE_API_URL` = the prod
  HTTPS API.
- Confirm backend-before-frontend is acceptable (new UI reads the now-present columns).

## STEP 6 — Authorize the merge + deploy
Reply with explicit authorization: "apply done + verified; authorize RC→main merge and the resulting
Production deploy." After migrations are applied, the merge-triggered `db push` is a **verified no-op**
on `Lead` (prod == schema) and creates nothing already applied.

## STEP 7 — (Claude, on your authorization) merge + verify
On your go, Claude will: re-fetch main, open/update the PR, satisfy the required **Vercel** check +
protections, merge (no force-push), record the merge SHA, then verify Render/Vercel deployed SHAs,
`/api/health`, login, Lead Store LD ids, Admissions locked folders, Analytics, Account Deletion.

## STEP 8 — (Claude) branch cleanup — only after a healthy deploy
Delete only fully-merged, obsolete branches (re-confirm `git branch --merged` each). **Preserve:**
`main`, RC, PR#13 head (`feat/bispun-audit-fixes-mobile-completion`), signing branch
(`release/android-signing-prep`), `feat/client-admin-password-reset`, the active worktrees
(`feat/referrals-lifecycle`, `integration/mui-yc`, `feat/referrals-integration`), the Mobile
manager-improvements branch, and all `backup/*` tags.

---
### What is blocked on what
STEP 7 (merge) is blocked until STEP 1–6 complete. STEP 8 is blocked until STEP 7 verifies healthy.
Everything else (build, QA, tests, reviewed SQL, docs) is **done**.
