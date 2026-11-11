-- 0008b — Referrals status BACKFILL (data migration).
--
-- Phase 3 of the phased rollout. ⚠️ RUN ONLY AFTER the dual-status code
-- (which treats both SUCCESSFUL and EARNED as "earned") is deployed to
-- production. Running this while the old SUCCESSFUL-only code is still live would
-- make every earned amount read as zero.
--
-- Maps legacy SUCCESSFUL referrals to EARNED (preserving counts/rewards — no
-- duplicate money) and sets the new default for freshly created rows. Idempotent.
--
-- Rollback (only safe while dual-status code is live):
--   ALTER TABLE "CrmReferral" ALTER COLUMN "status" SET DEFAULT 'SUCCESSFUL';
--   UPDATE "CrmReferral" SET "status" = 'SUCCESSFUL' WHERE "status" = 'EARNED';

UPDATE "CrmReferral" SET "status" = 'EARNED' WHERE "status" = 'SUCCESSFUL';

ALTER TABLE "CrmReferral" ALTER COLUMN "status" SET DEFAULT 'REFERRED';
