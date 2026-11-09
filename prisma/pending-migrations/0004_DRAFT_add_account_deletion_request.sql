-- =====================================================================
-- DRAFT — NOT APPROVED, NOT APPLIED (awaiting explicit migration approval)
-- Durable store for account/data deletion REQUESTS (Google Play compliance).
--
-- Scope: records a request only. It does NOT delete or anonymize any account
-- or data — that remains a separate, policy-gated operation.
--
-- Safety / impact:
--   * Single ADDITIVE `CREATE TABLE IF NOT EXISTS` + three indexes. Idempotent.
--   * No changes to any existing table; no FK constraints (companyId/userId are
--     plain nullable columns), so there is zero risk to existing rows/relations.
--   * No data modified or removed. Reversible with DROP TABLE if ever needed.
--   * Target: DEVELOPMENT blue-mouse first. Production requires separate auth.
--
-- After approval (DEV): apply this SQL -> `npx prisma generate` -> restart
-- backend. The endpoints already guard on the client delegate, so they switch
-- from the honest "can't record right now" fallback to durable persistence
-- automatically once the table + client exist.
-- =====================================================================

CREATE TABLE IF NOT EXISTS "AccountDeletionRequest" (
  "id"                TEXT PRIMARY KEY,
  "email"             TEXT NOT NULL,
  "reason"            TEXT,
  "source"            TEXT NOT NULL DEFAULT 'public',   -- 'public' | 'in-app'
  "status"            TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING|VERIFIED|PROCESSED|REJECTED
  "companyId"         TEXT,
  "userId"            TEXT,
  "verificationToken" TEXT,
  "verifiedAt"        TIMESTAMP(3),
  "handledByUserId"   TEXT,
  "handledAt"         TIMESTAMP(3),
  "adminRemarks"      TEXT,
  "ipAddress"         TEXT,
  "userAgent"         TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_status_createdAt_idx"
  ON "AccountDeletionRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_email_idx"
  ON "AccountDeletionRequest"("email");
CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_companyId_idx"
  ON "AccountDeletionRequest"("companyId");

-- Prisma supplies id (cuid) and updatedAt from the app layer on create/update.
