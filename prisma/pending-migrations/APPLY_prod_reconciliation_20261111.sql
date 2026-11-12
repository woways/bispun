-- =========================================================================
-- OPTIONAL MASTER RUNBOOK — Production schema reconciliation (2026-11-11)
-- REVIEW REQUIRED. Apply ONLY with explicit, separate operator authorization,
-- via the Neon SQL editor against branch `production`. DO NOT run prisma db
-- push for this; these are the controlled, reviewed changes.
--
-- VALIDATED: this exact order was run twice (fresh + re-apply) against an
-- isolated Postgres 18 clone with a prod-like baseline — all idempotent,
-- 0 errors, 0 null leadNumbers, 0 duplicates. See
-- BISPUN-PROD-MIGRATION-RECONCILIATION-20261111.md.
--
-- EXCLUDED ON PURPOSE:
--   * 0001_add_device_token.sql  -> ALREADY APPLIED in prod (DeviceToken
--     present). It is NOT idempotent (bare CREATE TABLE / CREATE UNIQUE INDEX /
--     ADD CONSTRAINT) and WOULD ERROR if re-run. Do NOT include it.
--   * 0007_DRAFT_add_calendar_event_visibility.sql -> ON HOLD.
--
-- PRECONDITIONS: run the §E read-only checks first and apply only the objects
-- marked MISSING/PARTIAL/UNKNOWN. Every file below is independently guarded with
-- IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS, so applying an
-- already-present object is a safe no-op (prints a NOTICE, changes nothing).
--
-- IMPORTANT (enum): 0004 uses ALTER TYPE ... ADD VALUE. Run it NOT inside an
-- explicit transaction block (psql autocommit is fine); do not wrap the whole
-- runbook in a single BEGIN/COMMIT.
--
-- RECOMMENDED METHOD (matches what was validated): run each file separately,
-- in THIS order. The \i includes below are provided for convenience when run
-- from the prisma/pending-migrations directory with psql autocommit.
-- =========================================================================

\set ON_ERROR_STOP on
\echo '--- 0002 user designation/level ---'
\i 0002_add_user_designation_and_level.sql
\echo '--- 0003 utm influencerName ---'
\i 0003_add_utm_influencer_name.sql
\echo '--- 0004 lead types (enum) + preferredColleges ---'
\i 0004_add_lead_types_and_preferred_colleges.sql
\echo '--- 0005P stable lead number (NULLABLE, prod-safe) ---'
\i 0005P_prod_stable_lead_number_nullable.sql
\echo '--- 0006 lead dataset duplicateDetails ---'
\i 0006_add_lead_dataset_duplicate_details.sql
\echo '--- 0009 admission folder locked ---'
\i 0009_add_admission_folder_locked.sql
\echo '--- 0008 account deletion request ---'
\i 0008_add_account_deletion_request.sql
\echo '--- DONE. Run the post-migration verification queries next. ---'

-- POSTCONDITIONS (expect): Lead.leadNumber 0 nulls / 0 dups per (companyId,
-- leadNumber); LeadDatasetType has GOOGLE_FORM,WEBSITE_FORM,IM,DM,INTERNAL;
-- AdmissionAttachmentFolder.locked NOT NULL default false; AccountDeletionRequest
-- table + 3 indexes; trigger Lead_assign_lead_number + function
-- assign_company_lead_number present.
--
-- FAILURE HANDLING: ON_ERROR_STOP halts on the first real error (NOTICEs are not
-- errors). Each object is additive and independently reversible — see the
-- rollback section in BISPUN-PROD-MIGRATION-RECONCILIATION-20261111.md. Prefer a
-- Neon branch/PITR restore for any data-affecting incident.
