-- =============================================================================
-- PENDING MIGRATION — REVIEW REQUIRED. DO NOT RUN AGAINST PRODUCTION.
-- Feature: Mobile push notifications (feat/mobile-notifications)
-- Adds the additive "DeviceToken" table only. It creates NO changes to any
-- existing table, column, index or constraint, so existing desktop/web CRM
-- behaviour is unaffected.
--
-- How to apply on a DEDICATED development database (never production):
--   Option A (recommended, lets Prisma track history):
--     npx prisma migrate dev --name add_device_token
--   Option B (raw SQL, if you manage migrations manually):
--     psql "$DATABASE_URL" -f prisma/pending-migrations/0001_add_device_token.sql
-- After applying, run: npm run prisma:generate
-- =============================================================================

CREATE TABLE "DeviceToken" (
    "id"         TEXT NOT NULL,
    "companyId"  TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "platform"   TEXT NOT NULL DEFAULT 'android',
    "active"     BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_companyId_idx" ON "DeviceToken"("companyId");
CREATE INDEX "DeviceToken_userId_active_idx" ON "DeviceToken"("userId", "active");
CREATE INDEX "DeviceToken_companyId_userId_idx" ON "DeviceToken"("companyId", "userId");

ALTER TABLE "DeviceToken"
    ADD CONSTRAINT "DeviceToken_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeviceToken"
    ADD CONSTRAINT "DeviceToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
