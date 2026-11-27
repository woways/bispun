-- Seat cap per plan + the new "Startup" plan (₹4999/yr, 2 users, 5 GB).
-- Apply on DEV (ep-blue-mouse) first to verify, then PROD (ep-weathered-pond)
-- via the deploy runbook. Additive + idempotent guards included.
--
-- Then run: npm run prisma:generate
--
-- EXECUTION IS GATED: apply ONLY against the DEVELOPMENT database first, with
-- explicit, separate operator authorization. DO NOT run against Production
-- (ep-weathered-pond) outside the deploy runbook.

-- 1) Seat cap column. null = unlimited (all existing plans stay unlimited).
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER;

-- 2) Seed the Startup plan. Idempotent (skipped if key already present).
--    Raw insert must supply id/timestamps (Prisma defaults don't apply here).
-- Startup mirrors the Basic plan's context (tagline + description); the 2-user
-- cap and price are what set it apart. Falls back to literals if no Basic plan.
INSERT INTO "Plan" (
  "id", "key", "name", "tagline", "description",
  "monthlyPrice", "yearlyPrice", "maxUsers", "storageLimitMb",
  "active", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, 'startup', 'Startup',
  COALESCE((SELECT "tagline" FROM "Plan" WHERE "key" = 'basic'), 'Core CRM for small consultancies'),
  COALESCE((SELECT "description" FROM "Plan" WHERE "key" = 'basic'), 'Core Bispun CRM package'),
  0, 4999, 2, 5120,
  true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "Plan" WHERE "key" = 'startup');

-- 3) Give Startup the same modules as Basic (the current entry plan).
--    Idempotent (unique on planId+moduleId; skips rows already present).
INSERT INTO "PlanModule" ("id", "planId", "moduleId", "createdAt")
SELECT gen_random_uuid()::text, s."id", pm."moduleId", now()
FROM "Plan" s
JOIN "Plan" b ON b."key" = 'basic'
JOIN "PlanModule" pm ON pm."planId" = b."id"
WHERE s."key" = 'startup'
  AND NOT EXISTS (
    SELECT 1 FROM "PlanModule" x
    WHERE x."planId" = s."id" AND x."moduleId" = pm."moduleId"
  );

-- =========================================================================
-- ROLLBACK (manual, reviewed — run ONLY if this change must be reverted):
--   DELETE FROM "PlanModule" WHERE "planId" IN (SELECT "id" FROM "Plan" WHERE "key"='startup');
--   DELETE FROM "Plan" WHERE "key"='startup';   -- only if no Subscription references it
--   ALTER TABLE "Plan" DROP COLUMN IF EXISTS "maxUsers";
--   -- then revert prisma/schema.prisma and run: npm run prisma:generate
-- =========================================================================
