BEGIN;

-- Lead Store: exact assignee + next follow-up schedule.
ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "followUpAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Lead_assignedToUserId_fkey'
  ) THEN
    ALTER TABLE "Lead"
      ADD CONSTRAINT "Lead_assignedToUserId_fkey"
      FOREIGN KEY ("assignedToUserId")
      REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Lead_assignedToUserId_idx"
  ON "Lead"("assignedToUserId");

CREATE INDEX IF NOT EXISTS "Lead_companyId_followUpAt_idx"
  ON "Lead"("companyId", "followUpAt");

-- Backfill the new assignee id for existing leads when a matching user can be
-- resolved safely from the same company. Dataset assignment is used as the
-- second fallback.
UPDATE "Lead" AS lead
SET "assignedToUserId" = (
  SELECT usr."id"
  FROM "User" AS usr
  WHERE usr."companyId" = lead."companyId"
    AND LOWER(usr."name") = LOWER(lead."assignedToName")
    AND usr."active" = TRUE
  ORDER BY usr."createdAt" ASC
  LIMIT 1
)
WHERE lead."assignedToUserId" IS NULL
  AND lead."assignedToName" IS NOT NULL;

UPDATE "Lead" AS lead
SET "assignedToUserId" = dataset."assignedToUserId"
FROM "LeadDataset" AS dataset
WHERE lead."assignedToUserId" IS NULL
  AND lead."leadDatasetId" = dataset."id"
  AND dataset."assignedToUserId" IS NOT NULL;

-- Full remark history. The UI shows only the latest five, but all remarks are
-- retained so history is not lost.
CREATE TABLE IF NOT EXISTS "LeadRemark" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "userId" TEXT,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadRemark_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LeadRemark_companyId_fkey'
  ) THEN
    ALTER TABLE "LeadRemark"
      ADD CONSTRAINT "LeadRemark_companyId_fkey"
      FOREIGN KEY ("companyId")
      REFERENCES "Company"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LeadRemark_leadId_fkey'
  ) THEN
    ALTER TABLE "LeadRemark"
      ADD CONSTRAINT "LeadRemark_leadId_fkey"
      FOREIGN KEY ("leadId")
      REFERENCES "Lead"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LeadRemark_userId_fkey'
  ) THEN
    ALTER TABLE "LeadRemark"
      ADD CONSTRAINT "LeadRemark_userId_fkey"
      FOREIGN KEY ("userId")
      REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "LeadRemark_companyId_leadId_createdAt_idx"
  ON "LeadRemark"("companyId", "leadId", "createdAt");

CREATE INDEX IF NOT EXISTS "LeadRemark_userId_createdAt_idx"
  ON "LeadRemark"("userId", "createdAt");

COMMIT;
