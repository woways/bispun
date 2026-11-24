# Bispun — Production migration & Render deploy runbook (main `a34923e`)

**Date:** 2026-11-18 · Target deploy commit: **`a34923e`** (verified `origin/main`).

## What I could and could not do
- **Done by me (safe, in-repo):** confirmed `origin/main = a34923e`; analyzed every pending migration, its order, dependencies and idempotency; built the read-only verification SQL and the exact apply SQL below.
- **Operator-gated (I have NO access, by design — never used app creds against Pond):** reading the live Pond schema, running any SQL, confirming the deployed Render commit, triggering the Render deploy, and live-verifying features. These are prepared below for an authorized operator; **nothing was executed against production.**

## Migration dependency summary
This release's backend (`a34923e`) uses columns that must exist **before** it runs:
| Migration | What | When | Idempotent? |
|---|---|---|---|
| `0007_add_referral_credit_audit.sql` | `ReferralPayoutRequest.source/creditedById/notifiedAt` (used by Mark Credited + PR #46) | **before deploy** | Yes (`ADD COLUMN IF NOT EXISTS`, `COALESCE` update) |
| `0008a_referral_referred_stage_expand.sql` | `CrmReferral.pendingSignupId/referredEmail/referredName`, `referredCompanyId` nullable, unique index | **before deploy** | Yes (`IF NOT EXISTS`, `DROP NOT NULL` no-op if already nullable) |
| *(deploy `a34923e` to Render)* | dual-status code live (reads SUCCESSFUL **and** EARNED) | — | — |
| `0008b_referral_status_backfill.sql` | `SUCCESSFUL → EARNED`, default `→ REFERRED` | **after deploy only** | Yes (re-run finds no SUCCESSFUL rows) |
| `0008_referral_referred_stage.sql` | **SUPERSEDED — contains no statements, DO NOT RUN** | never | — |

Because the currently-deployed Render backend is an **older pinned commit**, `a34923e` may also need earlier pending objects already present or not: `0002`–`0006` (designation/level, UTM influencerName, lead types enum + preferredColleges, **stable `Lead.leadNumber`**, lead dataset duplicateDetails), `0009` (AdmissionAttachmentFolder.locked), `0008_add_account_deletion_request`, `0010_add_sms_config`, `0001` (DeviceToken, already present). The read-only check (§A) tells you which are missing; apply only those, via the already-validated `APPLY_prod_reconciliation_20261111.sql` (it excludes `0001` and `0007_DRAFT` calendar), plus `0007_add_referral_credit_audit` and `0008a`.

## §A — READ-ONLY production verification (run FIRST; changes nothing)
Neon → project `consulbuzz-production` → branch `production` → db `neondb` → SQL Editor.
```sql
-- Referral credit audit (0007) — REQUIRED before deploy
SELECT column_name FROM information_schema.columns
WHERE table_name='ReferralPayoutRequest' AND column_name IN ('source','creditedById','notifiedAt','paymentReference','paidAt');
-- 0008a — REQUIRED before deploy
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_name='CrmReferral' AND column_name IN ('pendingSignupId','referredEmail','referredName','referredCompanyId') ORDER BY column_name;
SELECT indexname FROM pg_indexes WHERE tablename='CrmReferral' AND indexname='CrmReferral_pendingSignupId_key';
-- CrmReferral status distribution + default (shows 0008b impact; default should still be SUCCESSFUL pre-0008b)
SELECT status, count(*) FROM "CrmReferral" GROUP BY status;
SELECT column_default FROM information_schema.columns WHERE table_name='CrmReferral' AND column_name='status';
-- Lead numbering (backend selects Lead.leadNumber in Admissions/Analytics — must exist)
SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='Lead' AND column_name='leadNumber';
SELECT indexname FROM pg_indexes WHERE tablename='Lead' AND indexname='Lead_companyId_leadNumber_key';
SELECT tgname FROM pg_trigger WHERE tgname='Lead_assign_lead_number';
-- Other pending objects presence (apply only the MISSING ones via the reconciliation runbook)
SELECT to_regclass('"AccountDeletionRequest"') AS acct_del;
SELECT column_name FROM information_schema.columns WHERE table_name='AdmissionAttachmentFolder' AND column_name='locked';
SELECT to_regclass('"SmsConfig"') AS sms_config;  -- 0010 (if the backend uses SMS config)
SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='LeadDatasetType' ORDER BY e.enumsortorder;
```

## §B — Backup / recovery readiness (before any write)
- Create a **Neon branch from `production`** (instant copy-on-write restore point) and record its name, **or** confirm the PITR window covers the maintenance slot. All migrations below are additive/idempotent, but keep the restore point regardless.

## §C — Apply BEFORE deploy (only the objects §A shows MISSING; controlled SQL, NOT `db push`)
Run in the Neon SQL editor against `production`, in this order. Each file is guarded (`IF NOT EXISTS` / idempotent), so re-running an already-present object is a safe no-op.
1. `APPLY_prod_reconciliation_20261111.sql` — only if §A shows lead/dataset/account-deletion/locked objects missing (it runs `0002,0003,0004,0005P,0006,0009,0008_account_deletion`; **not inside one transaction** — `0004` uses `ALTER TYPE ... ADD VALUE`). Skip entirely if all present.
2. `0007_add_referral_credit_audit.sql`
3. `0008a_referral_referred_stage_expand.sql`
4. `0010_add_sms_config.sql` — only if §A shows `SmsConfig` missing and the backend needs it.
Re-run §A to confirm all required objects now present. **Do NOT run `0008b` yet. Do NOT run the superseded `0008_referral_referred_stage.sql`.**

## §D — Deploy `a34923e` to Render
1. Confirm Render `bispun-api`: Build Command = `npm install && npx prisma generate` (no `prisma db push`); Start = `npm run server`. Confirm the **currently deployed commit** (dashboard) for rollback reference.
2. Confirm env: `DATABASE_URL`, `JWT_SECRET`, `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` present; `DISABLE_BACKGROUND_WORKERS` unset/false (so the C2 coupon sweeper runs); optional `COUPON_RESERVATION_TTL_MINUTES` (default 60).
3. Manual Deploy → deploy commit **`a34923e`** (or latest main = that). Watch build logs: `prisma generate` succeeds, **no `db push`**.
4. Verify `/api/health` 200; logs show API listening and workers starting (no DISABLE warning).

## §E — Apply AFTER deploy
5. Once `a34923e` is live and healthy, run `0008b_referral_status_backfill.sql` in Neon. Then confirm:
```sql
SELECT status, count(*) FROM "CrmReferral" GROUP BY status;         -- no SUCCESSFUL left; EARNED present
SELECT column_default FROM information_schema.columns WHERE table_name='CrmReferral' AND column_name='status'; -- now 'REFERRED'
```
Earned totals must be unchanged vs the pre-backfill snapshot (SUCCESSFUL and EARNED both count as earned, so no money moves).

## §F — Post-deploy live verification (test data only; no real customer payments/credits)
- **Referrals:** open `/signup?ref=CODE` → code prefills; a test paid signup creates a CrmReferral; Super Admin **Referrals** shows earned/awaiting; **Mark credited** with a test UTR records it and the **Source = "Admin credit"** + reference show in history; double-click does not double-credit.
- **Coupons:** create/edit/activate a test coupon; apply at signup (correct GST-inclusive total); Razorpay **test-mode** capture → CONSUMED (once); failed payment → RELEASED; abandoned checkout → released by the C2 sweeper after the TTL; redemption history + audit correct.
- **Meet:** start a Meet in a chat → all members get the "Meeting started/Join" card with the same link; no duplicate; persists after refresh.
- **Lead numbering / Admissions / Analytics:** pages load (confirms `Lead.leadNumber` present).
- **Permissions / tenant isolation:** non-Super-Admin cannot reach coupon/referral-credit admin; a client sees only its own data.

## §G — Rollback
- **Backend:** Render → Deploys → Rollback to the previously deployed commit.
- **DB:** additive migrations need no rollback on a code revert; `0008b` rollback (only while dual-status code is live): `UPDATE "CrmReferral" SET status='SUCCESSFUL' WHERE status='EARNED'; ALTER TABLE "CrmReferral" ALTER COLUMN status SET DEFAULT 'SUCCESSFUL';`. For any data incident use the Neon branch/PITR from §B.

## GO / NO-GO
- **Code / GitHub:** ✅ `a34923e` on main; PR #46 CI (Vercel build + conflict-and-syntax) passed. No schema change from #46 itself.
- **DB migrations:** ✅ SQL reviewed, idempotent, correct order (0007 + 0008a before, 0008b after). ⏳ **Operator must run §A and apply only missing objects** — the actual present/absent state can only be read in Neon.
- **Deploy:** ⏳ **operator-gated** (no Render access here).
- **Overall:** **CONDITIONAL GO** — safe to proceed once §A confirms prerequisites and §B backup is in place. **Do not** run `0008b` before deploy; **do not** reintroduce `db push`.

## Remaining unavoidable manual (operator) actions
1. Run §A read-only checks in Neon; create the §B restore point.
2. Apply §C (only missing objects) → deploy §D (`a34923e`) → apply §E (`0008b`).
3. Run §F verification. Confirm the deployed commit in the Render dashboard.
My Store and the active Android/notification worktrees were not touched; no production data modified; no deploy performed.
