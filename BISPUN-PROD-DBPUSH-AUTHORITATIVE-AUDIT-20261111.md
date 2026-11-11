> **⚠️ SUPERSEDED (see BISPUN-PROD-SCHEMA-CORRECTED-FINDING-20261111.md):** §2 below assumed prod
> `Lead.leadNumber` might be NOT NULL and that db push would DROP NOT NULL. Operator read-only SQL
> on 2026-11-11 proved the column is **MISSING entirely** (0005 never applied). The real next db
> push therefore **ADDs a nullable `leadNumber` + unique index with no backfill/trigger** (feature
> dead, no data loss) — not a DROP NOT NULL. Use the corrected doc for the verdict and the required
> SQL (apply `0005P_prod_stable_lead_number_nullable.sql`).

# Bispun — Authoritative Production `db push` Audit (2026-11-11)

Corrects/extends `BISPUN-DBPUSH-IMPACT-AUDIT-20261111.md`. The main→RC diff is **not** proof of
the prod→RC `db push` effect. This doc gives the authoritative method (operator-run, read-only)
and proves the one effect the main→RC diff missed. **Nothing executed against any DB.**

## Environment
Prisma CLI **7.9.1**. `prisma migrate diff` in v7 uses `--from-config-datasource` /
`--to-config-datasource` (the removed `--from-url` is gone). RC `16f3d12`; `prisma validate` valid;
`npm test` **86/86** at this SHA.

## 1. Authoritative prod→RC check (operator must run — genuinely read-only)
`migrate diff` never writes; with a **read-only** datasource it is safe. Use a Neon **read-only
role** (or a read-only Production connection string), **never** the pond app/write credential, and
never print it.
- Put the read-only Production URL in the datasource Prisma config reads (e.g. the `DATABASE_URL`
  env for a one-off shell, sourced from a secret store — do not paste it anywhere), then:
```
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```
- **This prints the EXACT SQL the next `db push` would apply to Production.**
- **GO expects exactly:** `CREATE TABLE "AccountDeletionRequest"` + its 3 indexes, **and nothing
  else** (in particular, no `ALTER TABLE "Lead" ... DROP NOT NULL`, no other ALTER/DROP).
- If the output contains anything beyond the additive table → **NO-GO**; apply only reviewed SQL.

If a read-only role is unavailable, run the per-object SQL in §4 instead (do not substitute the
main→RC diff).

## 2. PROVEN: `db push` WOULD drop `Lead.leadNumber` NOT NULL (if prod is NOT NULL)
Read-only schema simulation — prod-like (`leadNumber Int` NOT NULL) → RC (`leadNumber Int?`):
```
-- AlterTable
ALTER TABLE "Lead" ALTER COLUMN "leadNumber" DROP NOT NULL;
```
So **the trigger making inserts succeed does NOT mean `db push` preserves NOT NULL — `db push`
actively DROPs it** to match the `Int?` model. This is the effect the main→RC diff hid (main is
also `Int?`).
- **Data-loss?** No — relaxing NOT NULL is non-destructive. But it **silently removes a Production
  integrity constraint**, which your rules bar without approval.
- **Can we keep NOT NULL by changing the model to `Int`?** No — the app never passes `leadNumber`
  on create (the BEFORE-INSERT trigger assigns it); a required `Int` would make Prisma Client throw
  "Argument leadNumber is missing" on every lead create. `Int?` is the only workable model, and it
  has no Prisma-expressible DB default for a trigger value. So **`db push` will always want to drop
  NOT NULL** while the trigger approach stands.
- **Net:** if prod `Lead.leadNumber` is currently **NOT NULL**, retaining `db push` means the next
  deploy relaxes it (non-destructive, trigger still fills values). That is an unapproved schema
  change → must be **explicitly approved** or avoided. If prod is **already nullable**, there is no
  ALTER and db push applies only the additive table.
- **Decision required (operator):** (a) approve the DROP NOT NULL (accept constraint relaxation;
  trigger preserves integrity), OR (b) keep NOT NULL by NOT using db push for this change (safe
  build command + reviewed migration), OR (c) confirm prod is already nullable (no issue).

## 3. Objects Prisma does NOT manage (migrate diff will not report them)
`migrate diff`/`db push` only reconcile Prisma-modeled tables/columns/indexes/enums. They do **not**
see or manage: the **trigger** `assign_company_lead_number`, its **function**, and any hand-made
indexes/constraints/defaults outside the schema. Consequences:
- `db push` will **not drop** the trigger (good) — but will **not create** it on a fresh/reset DB.
- Verify these separately via §4 SQL. Never assume migrate diff covers them.

## 4. Operator read-only SQL (Neon → consulbuzz-production → branch production → neondb → SQL Editor)
```sql
-- A) leadNumber nullability (decides §2) + columns (0002–0006 + PR#18 locked)
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE (table_name='Lead'        AND column_name IN ('leadNumber','preferredColleges'))
   OR (table_name='User'        AND column_name IN ('designationId','levelId','levelName','leadStoreColumnOrder'))
   OR (table_name='UtmLink'     AND column_name='influencerName')
   OR (table_name='LeadDataset' AND column_name='duplicateDetails')
   OR (table_name='AdmissionAttachmentFolder' AND column_name='locked')
ORDER BY table_name, column_name;
-- B) enum values (expect incl. GOOGLE_FORM, WEBSITE_FORM, IM, DM, INTERNAL)
SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
WHERE t.typname='LeadDatasetType' ORDER BY e.enumsortorder;
-- C) unique index + trigger + function (Prisma-unmanaged)
SELECT indexname, indexdef FROM pg_indexes WHERE tablename='Lead';
SELECT tgname FROM pg_trigger WHERE tgname='Lead_assign_lead_number';
SELECT proname FROM pg_proc WHERE proname='assign_company_lead_number';
-- D) AccountDeletionRequest existence + data integrity spot-checks (read-only)
SELECT to_regclass('"AccountDeletionRequest"') AS adr;
SELECT COUNT(*) AS leads, COUNT(*) FILTER (WHERE "leadNumber" IS NULL) AS null_leadnumbers FROM "Lead";
SELECT "companyId","leadNumber",COUNT(*) FROM "Lead" GROUP BY 1,2 HAVING COUNT(*)>1 LIMIT 5; -- expect 0 rows (no dup)
```
Interpretation: `null_leadnumbers` must be 0 and the dup query must return no rows (confirms the
stable-ID guarantee holds regardless of the NOT NULL constraint). `adr` null → db push will create
it (additive).

## 5. AccountDeletionRequest completeness (§8) — ✅ for request intake/review
Every field the code uses — status, email, reason, source, userId, companyId, ipAddress, userAgent,
verifiedAt, handledByUserId, handledAt, adminRemarks (+ id/createdAt/updatedAt/verificationToken) —
exists in the model/0008. Indexes (status+createdAt, email, companyId) match the admin list/lookup
queries. So **CreateTable + 3 indexes fully satisfy the request-tracking feature.** (Actual
deletion/anonymization fulfillment is a separate, still-unimplemented step — not required for intake.)

## 6. Neon backup / Vercel (operator dashboard — not accessible here)
- **Neon:** Console → project `consulbuzz-production` → branch `production` → confirm PITR/restore
  window (history retention) and that a branch/restore recovery is available; note the window length.
- **Vercel:** Project (woways/bispun) → Settings → Git: Production Branch (= `main`?), auto-deploy on
  push; current Production deployment (for rollback); Settings → Env (Production): `VITE_API_URL` =
  prod HTTPS API. Confirm a previous deployment is promotable.

## 7. Keep the existing Render Build Command? (per your preference)
- **Clearable for this release ONLY IF** §1 (or §4) shows the prod→RC db push effect is **just the
  additive `AccountDeletionRequest` table** — i.e., prod `Lead.leadNumber` is **already nullable**
  (no ALTER), and no other drift appears.
- **If prod leadNumber is NOT NULL**, retaining db push performs an unapproved DROP NOT NULL →
  **either** explicitly approve it (non-destructive) **or** use the minimum-risk alternative:
  temporarily set the Build Command to `npm install && npx prisma generate`, apply `0008` as a
  reviewed additive migration, deploy, then restore automation if desired. (Build-command change is
  an operator action — **not made here**, per your instruction.)
- This is a per-release clearance, not a blanket "db push is safe."

## 8. GO / NO-GO — 🔴 NO-GO (pending authoritative evidence + 1 decision)
Flips to **GO** when:
1. §1 authoritative prod→RC diff (or §4 SQL) shows the **only** effect is the additive
   `AccountDeletionRequest` table (no `Lead` DROP NOT NULL, no other ALTER/DROP), **or** you
   explicitly approve the DROP NOT NULL if prod is NOT NULL.
2. §4 integrity: 0 null `leadNumber`, no duplicate `(companyId, leadNumber)`, trigger+function+unique
   index present, enum complete, other columns present.
3. §6: Neon PITR window confirmed; Vercel production branch/auto-deploy/rollback confirmed.
4. Explicit authorization for the resulting Production deploy (additive table creation).
Then merge RC→main is safe; db push creates the table; deploy backend→frontend; verify health.
Signed AAB still separate (keystore creds).

## Evidence this run
Prisma 7.9.1; `--from-config-datasource` confirmed; leadNumber DROP NOT NULL proven via read-only
schema sim; account-deletion schema complete vs code; `prisma validate` valid; `npm test` 86/86;
git main `f6b7dd5`, RC `16f3d12` (0 behind / 46 ahead). No merge/deploy/db-push/migration/dashboard
change/branch deletion; pond untouched; all features + branches preserved.
