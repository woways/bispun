-- Referrals lifecycle (PDF §11): add the REFERRED stage before EARNED.
--
-- Additive, idempotent and non-destructive. A referral row can now be created at
-- verified signup (before payment / before the company exists) as REFERRED, then
-- transition to EARNED when Razorpay payment is captured and the company is
-- activated. Existing paid referrals are preserved and mapped SUCCESSFUL -> EARNED
-- so reward counts/amounts are unchanged (no duplicate rewards).
--
-- Rollback:
--   -- (re-point any REFERRED rows or delete pre-payment rows first if desired)
--   ALTER TABLE "CrmReferral" ALTER COLUMN "status" SET DEFAULT 'SUCCESSFUL';
--   UPDATE "CrmReferral" SET "status" = 'SUCCESSFUL' WHERE "status" = 'EARNED';
--   DROP INDEX IF EXISTS "CrmReferral_pendingSignupId_key";
--   ALTER TABLE "CrmReferral" DROP COLUMN IF EXISTS "referredName";
--   ALTER TABLE "CrmReferral" DROP COLUMN IF EXISTS "referredEmail";
--   ALTER TABLE "CrmReferral" DROP COLUMN IF EXISTS "pendingSignupId";
--   -- (referredCompanyId can be set back to NOT NULL only once no NULL rows remain)

ALTER TABLE "CrmReferral" ADD COLUMN IF NOT EXISTS "pendingSignupId" TEXT;
ALTER TABLE "CrmReferral" ADD COLUMN IF NOT EXISTS "referredEmail" TEXT;
ALTER TABLE "CrmReferral" ADD COLUMN IF NOT EXISTS "referredName" TEXT;

-- Allow a REFERRED row to exist before the referred company is created.
ALTER TABLE "CrmReferral" ALTER COLUMN "referredCompanyId" DROP NOT NULL;

-- One referral row per pending signup/order (Postgres allows multiple NULLs).
CREATE UNIQUE INDEX IF NOT EXISTS "CrmReferral_pendingSignupId_key"
  ON "CrmReferral"("pendingSignupId");

-- Preserve existing paid referrals: they are already "earned".
UPDATE "CrmReferral" SET "status" = 'EARNED' WHERE "status" = 'SUCCESSFUL';

-- New rows default to the first lifecycle stage.
ALTER TABLE "CrmReferral" ALTER COLUMN "status" SET DEFAULT 'REFERRED';
