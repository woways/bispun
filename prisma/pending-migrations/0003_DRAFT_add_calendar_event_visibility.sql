-- =====================================================================
-- DRAFT — NOT APPROVED, NOT APPLIED (awaiting explicit migration approval)
-- Calendar private/shared-event visibility model.
--
-- Purpose: let an event be COMPANY-shared (visible to all company users,
-- current behavior) or PRIVATE (visible/editable only to its owner/assignee +
-- CLIENT_ADMIN). Edit/delete authorization already exists in code
-- (server/lib/calendarAccess.js); this adds the VIEW dimension.
--
-- Safety / impact:
--   * Additive & backward-compatible: NEW column with DEFAULT 'COMPANY', so
--     every existing event stays shared — no behavior change until the GET
--     filter below is enabled in code.
--   * No data modified or removed. No FK. One supporting index.
--   * Target: DEVELOPMENT blue-mouse first; Production requires separate auth.
--     (Production already has designation/level + leadStoreColumnOrder; this
--      column is NOT yet in Production.)
--
-- Apply (DEV only, after approval):
--   psql "$DATABASE_URL" -f prisma/pending-migrations/0003_DRAFT_add_calendar_event_visibility.sql
--   then: edit prisma/schema.prisma (see below) -> npx prisma generate
-- =====================================================================

ALTER TABLE "CalendarEvent"
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'COMPANY';

CREATE INDEX IF NOT EXISTS "CalendarEvent_companyId_visibility_idx"
  ON "CalendarEvent"("companyId", "visibility");

-- Allowed values (enforced in app code): 'COMPANY' | 'PRIVATE'.

-- ---------------------------------------------------------------------
-- Prisma schema change to make AFTER the column exists (NOT done here):
--   model CalendarEvent {
--     ...
--     visibility String @default("COMPANY")   // "COMPANY" | "PRIVATE"
--     @@index([companyId, visibility])
--   }
--
-- Code change to make AFTER prisma generate (server/routes/clientCalendar.js GET):
--   non-admin list/read filter adds:
--     AND: [{ OR: [
--       { visibility: "COMPANY" },
--       { createdByUserId: <me> },
--       { assignedToUserId: <me> },
--     ] }]
--   (admins unrestricted). A single-record read uses the same rule;
--   meetingRoom/Meet link is only returned when the rule allows viewing.
-- ---------------------------------------------------------------------
