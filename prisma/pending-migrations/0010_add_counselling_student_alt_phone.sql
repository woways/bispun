-- QA-FIX (P1): CounsellingSession.studentAltPhone missing from schema.
-- server/routes/clientCounselling.js references studentAltPhone in create (L410),
-- update (L473-475), search/where (L173) and read (L96), but the Prisma model
-- lacked the column -> every counselling create/update/phone-search returned 500
-- (PrismaClientValidationError: Unknown argument `studentAltPhone`).
-- This additive, nullable column makes those existing code paths valid.
-- Reviewed; apply with approval (dev first). Rollback: DROP COLUMN.
ALTER TABLE "CounsellingSession"
  ADD COLUMN IF NOT EXISTS "studentAltPhone" TEXT;
