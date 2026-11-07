-- Backward-compatible organization metadata for Settings -> Users & Roles.
-- Existing jobTitle/department values remain untouched.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "designationId" TEXT,
  ADD COLUMN IF NOT EXISTS "levelId" TEXT,
  ADD COLUMN IF NOT EXISTS "levelName" TEXT;

CREATE INDEX IF NOT EXISTS "User_companyId_designationId_idx"
  ON "User"("companyId", "designationId");

CREATE INDEX IF NOT EXISTS "User_companyId_levelId_idx"
  ON "User"("companyId", "levelId");
