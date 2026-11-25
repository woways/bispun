-- 0013_add_calendar_event_meeting_link.sql
-- Feature: video-meeting links + guest invites. Adds two nullable columns to
-- CalendarEvent:
--   meetingLink    - an auto-generated Google Meet URL or a pasted Zoom/Teams/
--                    Meet link, shown as a "Join" button in the calendar.
--   googleEventId  - id of the Google Calendar event we created when inviting
--                    guests, so a later reschedule can be pushed to them.
--
-- Additive only — adds NEW nullable columns, touches no existing row, so every
-- pre-existing event keeps working unchanged. Idempotent (ADD COLUMN IF NOT
-- EXISTS). Then run: npm run prisma:generate
--
-- EXECUTION IS GATED: apply ONLY against the DEVELOPMENT database
-- (bispun-mobile-dev, host ep-blue-mouse...) with explicit, separate operator
-- authorization. DO NOT run against Production (ep-weathered-pond).
--
-- The server reads/writes these columns only through Prisma; before this
-- migration is applied the invite feature simply has no link to persist, so the
-- calendar API keeps functioning normally.

ALTER TABLE "CalendarEvent"
  ADD COLUMN IF NOT EXISTS "meetingLink" TEXT;

ALTER TABLE "CalendarEvent"
  ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;

-- =========================================================================
-- ROLLBACK (manual, reviewed — run ONLY if this change must be reverted):
--   ALTER TABLE "CalendarEvent" DROP COLUMN IF EXISTS "meetingLink";
--   ALTER TABLE "CalendarEvent" DROP COLUMN IF EXISTS "googleEventId";
--   -- then revert prisma/schema.prisma and run: npm run prisma:generate
-- Dropping the columns only discards stored links; all events and every other
-- field are untouched.
-- =========================================================================
