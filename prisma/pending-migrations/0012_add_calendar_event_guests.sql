-- 0012_add_calendar_event_guests.sql
-- Feature: meeting guests / attendees. Adds a CalendarEventGuest table so a
-- calendar event can have multiple guests. A guest is either a company user
-- (userId set, FK -> User) or a free-text entry (name/email). Replaces the
-- single "Assigned to" owner in the UI with a searchable multi-guest picker.
--
-- Additive only — creates a NEW table, touches no existing column or row, so
-- every pre-existing event keeps working unchanged. Idempotent (IF NOT EXISTS).
-- Then run: npm run prisma:generate
--
-- EXECUTION IS GATED: apply ONLY against the DEVELOPMENT database
-- (bispun-mobile-dev, host ep-blue-mouse...) with explicit, separate operator
-- authorization. DO NOT run against Production (ep-weathered-pond).
--
-- The server includes this relation only via an explicit, capability-checked
-- include (it probes for the table once and caches the result), so the calendar
-- API keeps functioning normally even BEFORE this migration is applied.

CREATE TABLE IF NOT EXISTS "CalendarEventGuest" (
  "id"        TEXT         NOT NULL,
  "eventId"   TEXT         NOT NULL,
  "userId"    TEXT,
  "name"      TEXT,
  "email"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEventGuest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CalendarEventGuest_eventId_idx"
  ON "CalendarEventGuest"("eventId");

CREATE INDEX IF NOT EXISTS "CalendarEventGuest_userId_idx"
  ON "CalendarEventGuest"("userId");

-- Foreign keys (added separately so re-running after a partial apply is safe).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEventGuest_eventId_fkey'
  ) THEN
    ALTER TABLE "CalendarEventGuest"
      ADD CONSTRAINT "CalendarEventGuest_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEventGuest_userId_fkey'
  ) THEN
    ALTER TABLE "CalendarEventGuest"
      ADD CONSTRAINT "CalendarEventGuest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================================================================
-- ROLLBACK (manual, reviewed — run ONLY if this change must be reverted):
--   DROP TABLE IF EXISTS "CalendarEventGuest";
--   -- then revert prisma/schema.prisma and run: npm run prisma:generate
-- Dropping the table only discards guest lists; all events and every other
-- field are untouched, and the UI falls back to no guests.
-- =========================================================================
