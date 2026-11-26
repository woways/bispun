-- Storage cap: per-plan limit (MB) + per-company usage counter (bytes).
-- Apply on DEV (ep-blue-mouse) first to verify, then PROD (ep-weathered-pond)
-- via the deploy runbook. Idempotent-safe guards included.

ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "storageLimitMb" INTEGER;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "storageBytesUsed" BIGINT NOT NULL DEFAULT 0;

-- Default the ₹4,999 entry plan to 5 GB (5120 MB). No-op if no plan matches
-- that price; other plans stay NULL (= unlimited) until set in Super Admin → Plans.
UPDATE "Plan" SET "storageLimitMb" = 5120
WHERE "storageLimitMb" IS NULL AND "yearlyPrice" = 4999;

-- After deploy, reconcile existing usage from S3:  node scripts/backfillStorageUsage.js
