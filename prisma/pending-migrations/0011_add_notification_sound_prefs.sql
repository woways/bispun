-- 0011_add_notification_sound_prefs.sql
-- Feature #11: persist notification SOUND preferences (soundEnabled, volume)
-- on UserNotificationPreference, so they survive logout/login and sync across a
-- user's devices instead of living only in per-device localStorage.
--
-- Additive + idempotent. Safe to run with `npx prisma db push` or `psql -f`.
-- Then run: npm run prisma:generate
--
-- EXECUTION IS GATED: apply ONLY against the DEVELOPMENT database
-- (bispun-mobile-dev, host ep-blue-mouse...) with explicit, separate operator
-- authorization. DO NOT run against Production.
--
-- Existing-data compatibility: both columns are NOT NULL with defaults that
-- equal the current frontend defaults (soundEnabled=true, volume=1.0), so every
-- pre-existing row is backfilled to today's behavior — no user sees a change
-- until they move the control themselves.

ALTER TABLE "UserNotificationPreference"
  ADD COLUMN IF NOT EXISTS "soundEnabled" BOOLEAN          NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "volume"       DOUBLE PRECISION NOT NULL DEFAULT 1;

-- Defensive clamp: keep any pre-existing out-of-range value within [0, 1]
-- (no-op on a fresh add; guards against a prior partial/manual backfill).
UPDATE "UserNotificationPreference"
   SET "volume" = LEAST(1, GREATEST(0, "volume"))
 WHERE "volume" < 0 OR "volume" > 1;

-- =========================================================================
-- ROLLBACK (manual, reviewed — run ONLY if this change must be reverted):
--   ALTER TABLE "UserNotificationPreference"
--     DROP COLUMN IF EXISTS "soundEnabled",
--     DROP COLUMN IF EXISTS "volume";
--   -- then revert prisma/schema.prisma and run: npm run prisma:generate
-- Dropping the columns is lossless for all OTHER notification preferences
-- (type toggles are untouched); only the sound/volume values are discarded,
-- after which the frontend transparently falls back to localStorage/defaults.
-- =========================================================================
