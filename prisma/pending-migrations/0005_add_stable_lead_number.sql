-- Stable per-company Lead IDs (LD001, LD002, ...)
-- Internal Lead.id cuid values remain unchanged.

ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "leadNumber" INTEGER;

-- Backfill existing leads using the numbering order the portal previously displayed:
-- existing Lead Store / Admissions-origin leads first, then any other company leads.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "companyId"
      ORDER BY
        CASE
          WHEN "source" = 'LEAD_STORE'
            OR COALESCE("notes", '') LIKE '%Admissions origin:%'
          THEN 0
          ELSE 1
        END,
        "createdAt" ASC,
        "id" ASC
    )::INTEGER AS "newLeadNumber"
  FROM "Lead"
)
UPDATE "Lead" AS l
SET "leadNumber" = ranked."newLeadNumber"
FROM ranked
WHERE l."id" = ranked."id"
  AND l."leadNumber" IS NULL;

ALTER TABLE "Lead"
ALTER COLUMN "leadNumber" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Lead_companyId_leadNumber_key"
ON "Lead"("companyId", "leadNumber");

-- Serialize allocation per company so concurrent lead creation cannot receive the same number.
CREATE OR REPLACE FUNCTION "assign_company_lead_number"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."leadNumber" IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW."companyId"));

    SELECT COALESCE(MAX("leadNumber"), 0) + 1
      INTO NEW."leadNumber"
    FROM "Lead"
    WHERE "companyId" = NEW."companyId";
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Lead_assign_lead_number" ON "Lead";

CREATE TRIGGER "Lead_assign_lead_number"
BEFORE INSERT ON "Lead"
FOR EACH ROW
EXECUTE FUNCTION "assign_company_lead_number"();
