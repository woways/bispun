-- =========================================================================
-- PROD-SAFE, REVIEWED variant of 0005 — Stable per-company Lead IDs.
-- REVIEW REQUIRED. Apply ONLY with explicit operator approval to Neon
-- production via the SQL editor (never via an uncontrolled `prisma db push`).
--
-- WHY THIS VARIANT EXISTS (verified 2026-11-11):
--   Production public."Lead" is MISSING the "leadNumber" column entirely
--   (migration 0005 was never applied to prod). The Prisma model is
--   `leadNumber Int?` (NULLABLE). This script matches that model exactly:
--   it OMITS the dev migration's `SET NOT NULL`, so that the next automatic
--   Render `prisma db push` finds prod == schema and makes NO change to Lead
--   (no ADD COLUMN, no DROP NOT NULL, index already present). Data integrity
--   is guaranteed by the BEFORE-INSERT trigger (always fills leadNumber) plus
--   the per-company unique index, not by a NOT NULL constraint.
--
--   If you instead require a hard NOT NULL in prod, you must ALSO remove
--   `prisma db push` from the Render Build Command (separate approval), because
--   db push would otherwise relax NOT NULL back to match the `Int?` model.
--
-- Verified in an isolated Postgres 18 clone (prod-like, column missing):
--   single create, 5-row bulk createMany (distinct 5..9, no unique violation),
--   per-company isolation, LD-id search, 0 nulls / 0 dups after apply.
-- =========================================================================

ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "leadNumber" INTEGER;

-- Backfill existing leads using the portal's historical display order:
-- Lead Store / Admissions-origin leads first, then the rest, by createdAt.
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

-- NOTE: NO `ALTER COLUMN ... SET NOT NULL` here (keeps prod == Prisma `Int?`
-- so automatic db push stays a no-op). Integrity is enforced below.

CREATE UNIQUE INDEX IF NOT EXISTS "Lead_companyId_leadNumber_key"
ON "Lead"("companyId", "leadNumber");

-- Serialize allocation per company so concurrent creates cannot collide.
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

-- Post-apply verification (expect 0 and no rows):
--   SELECT count(*) FILTER (WHERE "leadNumber" IS NULL) AS nulls FROM "Lead";
--   SELECT "companyId","leadNumber",count(*) FROM "Lead" GROUP BY 1,2 HAVING count(*)>1;

-- Rollback (if ever needed):
--   DROP TRIGGER IF EXISTS "Lead_assign_lead_number" ON "Lead";
--   DROP FUNCTION IF EXISTS "assign_company_lead_number"();
--   DROP INDEX IF EXISTS "Lead_companyId_leadNumber_key";
--   ALTER TABLE "Lead" DROP COLUMN IF EXISTS "leadNumber";
