# Bispun — Operator Production-Evidence Checklist (minimal)

Collect this read-only evidence so the release can move from NO-GO → GO. **Read-only only** —
do not deploy, migrate, or change Production settings.

## 1. Neon Production schema (read-only; Neon SQL Editor, Production branch, DB `neondb`)
Run and return the output (catalog only — no PII, no writes):
```sql
-- 0001 DeviceToken, 0008 AccountDeletionRequest
SELECT to_regclass('"DeviceToken"') AS devicetoken,
       to_regclass('"AccountDeletionRequest"') AS accountdeletionrequest;
-- 0002 User cols + 0003/0004/0005/0006 columns
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE (table_name='User'        AND column_name IN ('designationId','levelId','levelName','leadStoreColumnOrder'))
   OR (table_name='UtmLink'     AND column_name='influencerName')
   OR (table_name='Lead'        AND column_name IN ('preferredColleges','leadNumber'))
   OR (table_name='LeadDataset' AND column_name='duplicateDetails')
ORDER BY table_name, column_name;
-- 0004 enum values
SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
WHERE t.typname='LeadDatasetType' ORDER BY e.enumsortorder;
-- 0005 unique index + trigger
SELECT indexname FROM pg_indexes WHERE tablename='Lead' AND indexname='Lead_companyId_leadNumber_key';
SELECT tgname FROM pg_trigger WHERE tgname='Lead_assign_lead_number';
```
**GO needs:** User's 4 cols present; `UtmLink.influencerName` present; `Lead.preferredColleges`
present; **`Lead.leadNumber` present AND `is_nullable=NO`** with index `Lead_companyId_leadNumber_key`
and trigger `Lead_assign_lead_number`; `LeadDataset.duplicateDetails` present; enum has
GOOGLE_FORM, WEBSITE_FORM, IM, DM, INTERNAL. `AccountDeletionRequest` may be absent (fail-safe),
but must be **present** before relying on the public deletion URL in production.

## 2. Vercel (dashboard)
- Project connected to `woways/bispun`? Production Branch (= `main`?).
- Settings → Git: is "Automatically deploy" ON for pushes to the production branch?
- Deployment Protection (on/off).
- Settings → Environment Variables (Production scope): `VITE_API_URL` = the prod HTTPS API URL.
- Note the current Production deployment id/URL (for rollback).

## 3. Render (dashboard)
- Service hosting the backend; connected repo + **branch** (= `main`?).
- Auto-Deploy: On/Off.
- Build Command / Start Command / Health Check Path.
- **Pre-Deploy Command** — confirm it does NOT run `prisma db push`/`migrate` unintentionally.
- Env: `DATABASE_URL` (prod), `CLIENT_URL` (prod frontend domain), `JWT_*`,
  `DISABLE_BACKGROUND_WORKERS` (prod value — if workers are on, confirm outbound is intended).
- Any separate cron/worker services.
- Note the current live commit (for rollback).

## 4. Rollback readiness
- Vercel: previous Production deployment available to "Promote/Rollback"? (yes/no)
- Render: previous deploy available to "Rollback"? current live commit = ?
- Neon: PITR / branch restore window available? (yes/no)
- Git rollback refs on origin: `backup/pre-release/main-20261110b` (`890ba58`),
  `backup/pre-consolidation/main-20261110` (`29283ec`).

Return 1–4 and the release flips from NO-GO to CONDITIONAL GO (merge still requires explicit
Production-deployment authorization, since a main push auto-deploys).
