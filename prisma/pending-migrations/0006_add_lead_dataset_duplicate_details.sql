-- Persist row-level duplicate information for Lead Store import batches.
-- Existing datasets remain valid; only new imports will have detailed rows.
ALTER TABLE "LeadDataset"
ADD COLUMN IF NOT EXISTS "duplicateDetails" JSONB;
