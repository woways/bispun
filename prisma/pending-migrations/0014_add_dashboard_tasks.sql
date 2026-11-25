-- 0014_add_dashboard_tasks.sql
-- Feature: dashboard "Today's Tasks" board. Adds a new DashboardTask table — a
-- lightweight, company-scoped to-do list shown on the dashboard, optionally
-- assigned to a user and linked to a lead. Independent of TargetTask (which
-- models goal/target numbers).
--
-- type/priority are stored as TEXT (app-validated) so this migration needs no
-- Postgres enum types. Additive only — creates a NEW table and its indexes,
-- touches no existing table or row, so the rest of the schema is unaffected.
-- Idempotent (CREATE TABLE/INDEX IF NOT EXISTS). Then run: npm run prisma:generate
--
-- EXECUTION IS GATED: apply ONLY against the DEVELOPMENT database
-- (bispun-mobile-dev, host ep-blue-mouse...) with explicit, separate operator
-- authorization. DO NOT run against Production (ep-weathered-pond).
--
-- The server reads/writes this table only through Prisma; before this migration
-- is applied the Tasks API simply has no table to hit, so the rest of the
-- dashboard keeps functioning normally.

CREATE TABLE IF NOT EXISTS "DashboardTask" (
  "id"               TEXT NOT NULL,
  "companyId"        TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "type"             TEXT NOT NULL DEFAULT 'GENERAL',
  "priority"         TEXT NOT NULL DEFAULT 'NORMAL',
  "dueAt"            TIMESTAMP(3),
  "pinned"           BOOLEAN NOT NULL DEFAULT false,
  "done"             BOOLEAN NOT NULL DEFAULT false,
  "notes"            TEXT,
  "leadId"           TEXT,
  "assignedToUserId" TEXT,
  "createdByUserId"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"      TIMESTAMP(3),
  CONSTRAINT "DashboardTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DashboardTask_companyId_fkey" FOREIGN KEY ("companyId")
    REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DashboardTask_companyId_dueAt_idx"
  ON "DashboardTask" ("companyId", "dueAt");
CREATE INDEX IF NOT EXISTS "DashboardTask_companyId_done_idx"
  ON "DashboardTask" ("companyId", "done");
CREATE INDEX IF NOT EXISTS "DashboardTask_companyId_assignedToUserId_idx"
  ON "DashboardTask" ("companyId", "assignedToUserId");

-- =========================================================================
-- ROLLBACK (manual, reviewed — run ONLY if this change must be reverted):
--   DROP TABLE IF EXISTS "DashboardTask";
--   -- then revert prisma/schema.prisma and run: npm run prisma:generate
-- Dropping the table only discards dashboard tasks; every other table is
-- untouched.
-- =========================================================================
