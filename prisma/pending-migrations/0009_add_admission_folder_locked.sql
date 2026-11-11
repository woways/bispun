-- =====================================================================
-- PENDING MIGRATION — REVIEW REQUIRED. DO NOT RUN AGAINST PRODUCTION
-- without explicit, separate authorization.
--
-- Feature: Admissions admin-only confidential (locked) college folder
--          (origin/main PR #18, commit 8bc7222). The Prisma schema adds
--          AdmissionAttachmentFolder.locked; main was applied via `prisma
--          db push`, so there was no hand-written SQL in this repo. This
--          file records the exact additive change for Production.
--
-- Safety / impact:
--   * Single ADDITIVE column with a DEFAULT, so existing rows get `false`.
--   * NOT NULL is safe because of the DEFAULT; no existing data is modified
--     beyond backfilling the default. No indexes/constraints/relations change.
--   * Reversible with: ALTER TABLE "AdmissionAttachmentFolder" DROP COLUMN "locked";
--   * Required by the candidate backend (server/routes/clientAdmissions.js reads
--     and writes `locked`); if absent in Production, those queries will fail.
-- =====================================================================

ALTER TABLE "AdmissionAttachmentFolder"
  ADD COLUMN IF NOT EXISTS "locked" BOOLEAN NOT NULL DEFAULT false;
