-- 0010_add_sms_config.sql
-- Adds MSG91 transactional SMS configuration to SystemSettings (Super Admin
-- managed). The secret MSG91_AUTH_KEY stays in server env, never in the DB.
-- Additive + idempotent; safe to run with `npx prisma db push` or psql -f.
-- Then run: npm run prisma:generate

ALTER TABLE "SystemSettings"
  ADD COLUMN IF NOT EXISTS "smsEnabled"           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "smsSenderId"          TEXT,
  ADD COLUMN IF NOT EXISTS "smsOtpTemplateId"     TEXT,
  ADD COLUMN IF NOT EXISTS "smsWelcomeTemplateId" TEXT,
  ADD COLUMN IF NOT EXISTS "smsWelcomeEnabled"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "smsEnquiryTemplateId" TEXT,
  ADD COLUMN IF NOT EXISTS "smsEnquiryEnabled"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "smsEnquiryHours"      INTEGER NOT NULL DEFAULT 24;

-- Pre-seed the approved MSG91 template IDs + sender (idempotent via COALESCE, so
-- it never overwrites values a Super Admin later edits). SMS stays OFF until the
-- Super Admin flips the "Enable SMS" toggle and MSG91_AUTH_KEY is set in env.
UPDATE "SystemSettings" SET
  "smsSenderId"          = COALESCE("smsSenderId", 'BISPUN'),
  "smsOtpTemplateId"     = COALESCE("smsOtpTemplateId", '6ae604e0ea46b263e40ced23'),
  "smsWelcomeTemplateId" = COALESCE("smsWelcomeTemplateId", '6ae60605a09463dfa90a6ab2'),
  "smsEnquiryTemplateId" = COALESCE("smsEnquiryTemplateId", '6ae606ca5fe557591d0bde52');