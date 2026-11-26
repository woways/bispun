# Pond (production) deploy checklist — 2026-11-26 work

**Status: NOT executed. Nothing here has been run against Pond. No production data
was read or modified while preparing this.** Pond = Neon `ep-weathered-pond`.
Dev = `ep-blue-mouse`. **Never `db push` against Pond. Never paste the prod
`DATABASE_URL` into chat.**

This covers deploying the code pushed to `main` on 2026-11-26
(commits `e3d1d88` + `2f28cd9`). Read this together with
`PROD_DEPLOY_RUNBOOK_PR43.md`, which is the authoritative baseline process and
list of still-pending reconciliation migrations; this file only adds what is new
for today's deploy.

---

## What today's code needs from the database

### Needs NO schema change (safe as-is on Pond)
These read/write only existing columns — deploy without any migration:
- **Lead bulk-assign fix** (`server/routes/clientLeadStore.js`) — only a widened
  `WHERE` (now matches `source=LEAD_STORE` **OR** `notes contains "Admissions origin:"`).
- **KPI-card select + assign**, **searchable assignee picker**, **Lead Store
  Joined College / Stream** (a read-only join over existing `Admission` tables),
  **dataset name**, and **all UI/table/chart/spacing** changes.

### Needs a schema change (MUST be applied to Pond)
- **Storage limits** (bundled in `e3d1d88`): `schema.prisma` now has
  `Plan.storageLimitMb` and `Company.storageBytesUsed`. If the code deploys
  without these columns, the backend throws
  `The column Plan.storageLimitMb does not exist` (as seen on Dev).
  → Apply **`0014_add_storage_limits.sql`**.
- **Dashboard tasks** (from earlier commit `c240f5e`, if not already live on
  Pond): the Quick-create/dashboard task form posts to `/api/client/tasks`.
  → Apply **`0014_add_dashboard_tasks.sql`** only if the drift check (Step 1)
  shows the Tasks table/columns are missing on Pond.

> Verify with precision on your own DB first: `0014_add_storage_limits.sql`
> has already been **verified on Dev (ep-blue-mouse)** per its header. Do that
> before Pond if you have not.

---

## Step 0 — Prerequisites (operator)
1. Take a **Neon PITR branch/snapshot of Pond** immediately before any change
   (primary rollback). Confirm the PITR window.
2. Have the **Pond** `DATABASE_URL` in a secure shell only. Never commit/paste it.
3. Apply via the **Neon SQL editor with autocommit** (not one big transaction).
   All reviewed files are `IF NOT EXISTS` / idempotent, so re-applying is a safe
   no-op.

## Step 1 — READ-ONLY drift check (source of truth)
Run the authoritative, read-only diff (writes nothing to the DB):
```
npx prisma migrate diff \
  --from-url "$POND_DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > pond_drift_20261126.sql
```
Review `pond_drift_20261126.sql`. It will list every object missing on Pond
relative to the current schema — this is what you actually apply. Confirm it
includes `"Plan"."storageLimitMb"` and `"Company"."storageBytesUsed"`, and check
whether the Tasks table/columns appear (tells you if `0014_add_dashboard_tasks.sql`
is still needed). Anything the diff shows that is **not** covered by a reviewed
file must be turned into reviewed SQL and approved before applying.

Quick targeted read-only confirmation (optional, same intent):
```
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'Plan' AND column_name = 'storageLimitMb';
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'Company' AND column_name = 'storageBytesUsed';
```

## Step 2 — Apply migrations (Neon SQL editor, autocommit), in order
Apply any still-pending baseline files from
`PROD_DEPLOY_RUNBOOK_PR43.md` Step 2 that the drift check still shows missing,
**then** today's additions:

1. …(any still-missing files from the PR43 runbook, in that runbook's order)…
2. `0014_add_storage_limits.sql`  ← adds the two columns + defaults the ₹4,999 plan to 5 GB (idempotent)
3. `0014_add_dashboard_tasks.sql`  ← **only if** Step 1 shows Tasks objects missing

Apply **before** the new code goes live, so the backend never queries a missing
column. Do **not** apply `0001_add_device_token.sql` or
`0007_DRAFT_add_calendar_event_visibility.sql` (per the PR43 runbook).

## Step 3 — Deploy the code
- Ensure the deploy does **not** run `prisma db push` (see PR43 runbook Step 4 —
  the Render build command must be `npm install && npx prisma generate`, no
  `db push`). With the columns already applied in Step 2, `generate` is a no-op
  on schema.
- Deploy backend, confirm `/api/health`, then the frontend.

## Step 4 — Post-deploy reconciliation
Storage usage counters start at 0; reconcile actual usage from S3:
```
node scripts/backfillStorageUsage.js
```
(Run once, after Step 2 + deploy. Safe to re-run.)

## Step 5 — Verification (expect these)
```
-- storage columns present
SELECT column_name FROM information_schema.columns
 WHERE table_name IN ('Plan','Company')
   AND column_name IN ('storageLimitMb','storageBytesUsed');   -- expect 2 rows

-- entry plan defaulted (if a ₹4,999 yearly plan exists)
SELECT "name","yearlyPrice","storageLimitMb" FROM "Plan" WHERE "yearlyPrice" = 4999;

-- backend no longer errors on plan queries (check logs: no "Plan.storageLimitMb does not exist")
```
Spot-check the live app: Dashboard KPI drawers (Qualified Leads → select → assign),
Lead Store bulk-assign (incl. an admissions-origin lead), Admissions Overall
graph + tables, and that billing/plans pages load without error.

## Rollback / recovery
- Primary: Neon **PITR / branch restore** to the Step 0 snapshot.
- Per-object (if needed), the columns added today can be dropped:
  ```
  ALTER TABLE "Plan" DROP COLUMN IF EXISTS "storageLimitMb";
  ALTER TABLE "Company" DROP COLUMN IF EXISTS "storageBytesUsed";
  ```
  (Only if you are also rolling back the storage-limits code.)

## GO criteria (all must hold)
- Step 1 drift reviewed; every MISSING object has reviewed SQL.
- Step 2 applied; Step 5 shows both storage columns present and no `Plan` errors.
- `db push` is not part of the deploy build.
- Pond PITR snapshot taken before changes.
