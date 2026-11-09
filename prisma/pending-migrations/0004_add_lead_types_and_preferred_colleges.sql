-- =========================================================================
-- PENDING MIGRATION — REVIEW REQUIRED. DO NOT RUN AGAINST PRODUCTION.
-- Feature: Lead Store lead types + Preferred Colleges (feat/lead-store-changes)
-- Adds five new values to the "LeadDatasetType" enum (used by Lead Store
-- Add Lead and Import Leads), and a nullable "preferredColleges" TEXT column
-- on "Lead". It creates NO changes to existing rows, tables, indexes or
-- constraints, so existing desktop/web CRM behaviour is unaffected.
--
-- How to apply on a DEDICATED development database (never production):
--   Option A (recommended, lets Prisma track history):
--     npx prisma migrate dev --name add_lead_types_and_preferred_colleges
--   Option B (raw SQL, if you manage migrations manually):
--     psql "$DATABASE_URL" -f prisma/pending-migrations/0004_add_lead_types_and_preferred_colleges.sql
-- After applying, run: npm run prisma:generate
-- =========================================================================

-- New Lead Store / Import lead types.
ALTER TYPE "LeadDatasetType" ADD VALUE IF NOT EXISTS 'GOOGLE_FORM';
ALTER TYPE "LeadDatasetType" ADD VALUE IF NOT EXISTS 'WEBSITE_FORM';
ALTER TYPE "LeadDatasetType" ADD VALUE IF NOT EXISTS 'IM';
ALTER TYPE "LeadDatasetType" ADD VALUE IF NOT EXISTS 'DM';
ALTER TYPE "LeadDatasetType" ADD VALUE IF NOT EXISTS 'INTERNAL';

-- Preferred Colleges per lead (comma-separated free text; nullable).
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "preferredColleges" TEXT;