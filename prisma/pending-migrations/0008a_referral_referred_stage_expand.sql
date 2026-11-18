-- 0008a — Referrals REFERRED-stage EXPAND (schema-only, PRODUCTION-SAFE).
--
-- Phase 1 of the phased rollout. Safe to run on production BEFORE deploying the
-- dual-status code: it only ADDs nullable columns, makes referredCompanyId
-- nullable, and adds a unique index. It does NOT change any existing status
-- value and does NOT change the status default, so the currently-deployed
-- (SUCCESSFUL-only) code keeps working unchanged.
--
-- Additive + idempotent. Run 0008b (backfill) ONLY AFTER the dual-status code is
-- live in production.
--
-- Rollback:
--   DROP INDEX IF EXISTS "CrmReferral_pendingSignupId_key";
--   ALTER TABLE "CrmReferral" DROP COLUMN IF EXISTS "referredName";
--   ALTER TABLE "CrmReferral" DROP COLUMN IF EXISTS "referredEmail";
--   ALTER TABLE "CrmReferral" DROP COLUMN IF EXISTS "pendingSignupId";
--   -- (referredCompanyId back to NOT NULL only once no NULL rows remain)

ALTER TABLE "CrmReferral" ADD COLUMN IF NOT EXISTS "pendingSignupId" TEXT;
ALTER TABLE "CrmReferral" ADD COLUMN IF NOT EXISTS "referredEmail" TEXT;
ALTER TABLE "CrmReferral" ADD COLUMN IF NOT EXISTS "referredName" TEXT;

-- Allow a REFERRED row to exist before the referred company is created.
ALTER TABLE "CrmReferral" ALTER COLUMN "referredCompanyId" DROP NOT NULL;

-- One referral row per pending signup/order (Postgres allows multiple NULLs).
CREATE UNIQUE INDEX IF NOT EXISTS "CrmReferral_pendingSignupId_key"
  ON "CrmReferral"("pendingSignupId");
