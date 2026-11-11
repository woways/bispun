-- Referrals lifecycle (PDF §11): Super-Admin credit audit on ReferralPayoutRequest.
--
-- Additive and reversible. No data is dropped or rewritten; existing payout
-- requests keep working unchanged and are back-filled as legacy client requests.
--
-- Rollback:
--   ALTER TABLE "ReferralPayoutRequest" DROP COLUMN IF EXISTS "notifiedAt";
--   ALTER TABLE "ReferralPayoutRequest" DROP COLUMN IF EXISTS "creditedById";
--   ALTER TABLE "ReferralPayoutRequest" DROP COLUMN IF EXISTS "source";

ALTER TABLE "ReferralPayoutRequest"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'CLIENT_REQUEST';

ALTER TABLE "ReferralPayoutRequest"
  ADD COLUMN IF NOT EXISTS "creditedById" TEXT;

ALTER TABLE "ReferralPayoutRequest"
  ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);

-- Existing PAID records were credited before this audit existed; mark their
-- source as the historical client-request flow and treat them as already
-- notified so the new idempotent notification does not re-fire for old data.
UPDATE "ReferralPayoutRequest"
SET "notifiedAt" = COALESCE("notifiedAt", "paidAt")
WHERE "status" = 'PAID';
