-- =============================================================================
-- Bispun — PRODUCTION (Pond / Neon) read-only schema verification for main @ d6bad84
-- (supersedes the earlier 33659f1 script: main now carries the Referrals
--  REFERRED->EARNED lifecycle, so Section D below is new.)
-- =============================================================================
-- PURPOSE : Confirm production already contains every object the deployed backend
--           queries, AND the 0008a referral-stage objects that the new referral
--           signup write-path needs.
--
-- SAFETY  : 100% READ-ONLY (SELECT / catalog lookups only). Creates, alters,
--           drops and writes NOTHING. Safe on live production.
--
-- WHERE   : Neon -> project `consulbuzz-production` -> branch `production`
--           -> database `neondb` -> SQL Editor. Paste the whole file and run.
--
-- RESULT  : one row per check (PASS/FAIL) + a single `overall` verdict column.
--
-- IMPORTANT DEPLOY NOTE: main @ d6bad84 introduces a schema delta vs the previous
-- release (the CrmReferral REFERRED-stage columns in Section D). Reads are
-- dual-status safe (code treats legacy SUCCESSFUL == EARNED), but creating new
-- REFERRED rows at signup REQUIRES the Section D objects. Therefore:
--   * Section D FAIL  -> apply 0008a_referral_referred_stage_expand.sql to Pond
--                        BEFORE deploying d6bad84 (additive + idempotent).
--   * Run 0008b_referral_status_backfill.sql ONLY AFTER the dual-status code is live.
-- =============================================================================

WITH checks AS (
  -- (A) Lead.leadNumber + integrity objects (admissions/analytics SELECT it).
  SELECT 1 AS n, 'A1 Lead.leadNumber column exists' AS check_name,
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='Lead' AND column_name='leadNumber') AS ok
  UNION ALL SELECT 2, 'A2 unique index Lead_companyId_leadNumber_key',
    EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='Lead'
            AND indexname='Lead_companyId_leadNumber_key')
  UNION ALL SELECT 3, 'A3 trigger Lead_assign_lead_number',
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='Lead_assign_lead_number' AND NOT tgisinternal)
  UNION ALL SELECT 4, 'A4 function assign_company_lead_number()',
    EXISTS (SELECT 1 FROM pg_proc WHERE proname='assign_company_lead_number')

  -- (B) Coupons + C2 sweeper.
  UNION ALL SELECT 5, 'B1 table Coupon', to_regclass('public."Coupon"') IS NOT NULL
  UNION ALL SELECT 6, 'B2 table CouponRedemption', to_regclass('public."CouponRedemption"') IS NOT NULL
  UNION ALL SELECT 7, 'B3 enum CouponRedemptionStatus = RESERVED/CONSUMED/RELEASED',
    (SELECT COUNT(DISTINCT e.enumlabel) FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
      WHERE t.typname='CouponRedemptionStatus'
        AND e.enumlabel IN ('RESERVED','CONSUMED','RELEASED')) = 3
  UNION ALL SELECT 8, 'B4 CouponRedemption has all 10 required columns',
    (SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='CouponRedemption'
        AND column_name IN ('status','reservedAt','consumedAt','releasedAt','providerOrderId',
                            'customerEmail','couponId','amount','planKey','companyId')) = 10
  UNION ALL SELECT 9, 'B5 CouponRedemption.providerOrderId UNIQUE index',
    EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='CouponRedemption'
            AND indexdef ILIKE '%providerOrderId%' AND indexdef ILIKE '%unique%')

  -- (C) Referral attribution + credit/payout flow.
  UNION ALL SELECT 10, 'C1 table Referral', to_regclass('public."Referral"') IS NOT NULL
  UNION ALL SELECT 11, 'C2 table CrmReferral', to_regclass('public."CrmReferral"') IS NOT NULL
  UNION ALL SELECT 12, 'C3 table ReferralPayoutRequest', to_regclass('public."ReferralPayoutRequest"') IS NOT NULL
  UNION ALL SELECT 13, 'C4 ReferralPayoutRequest audit cols (source/creditedById/notifiedAt/status/amount)',
    (SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='ReferralPayoutRequest'
        AND column_name IN ('source','creditedById','notifiedAt','status','amount')) = 5
  UNION ALL SELECT 14, 'C5 enum ReferralPayoutStatus exists',
    EXISTS (SELECT 1 FROM pg_type WHERE typname='ReferralPayoutStatus' AND typtype='e')

  -- (D) NEW in main @ d6bad84 — CrmReferral REFERRED-stage objects (migration 0008a).
  --     Needed to create REFERRED rows at signup. Apply 0008a if any FAIL.
  UNION ALL SELECT 15, 'D1 CrmReferral.pendingSignupId column',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='CrmReferral' AND column_name='pendingSignupId')
  UNION ALL SELECT 16, 'D2 unique index CrmReferral_pendingSignupId_key',
    EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='CrmReferral'
            AND indexname='CrmReferral_pendingSignupId_key')
  UNION ALL SELECT 17, 'D3 CrmReferral.referredEmail column',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='CrmReferral' AND column_name='referredEmail')
  UNION ALL SELECT 18, 'D4 CrmReferral.referredName column',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='CrmReferral' AND column_name='referredName')
  UNION ALL SELECT 19, 'D5 CrmReferral.referredCompanyId is NULLABLE',
    (SELECT is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='CrmReferral' AND column_name='referredCompanyId') = 'YES'
)
SELECT
  n,
  check_name,
  CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result,
  CASE WHEN bool_and(ok) OVER () THEN '✅ GO — all required objects present'
       ELSE '🔴 NO-GO — a required object is missing (see FAIL rows)' END AS overall
FROM checks
ORDER BY n;

-- =============================================================================
-- IF A CHECK FAILS
-- =============================================================================
-- A1 (Lead.leadNumber MISSING) -> apply 0005P_prod_stable_lead_number_nullable.sql
--     (additive+idempotent) in the Neon SQL editor. NOT via `prisma db push`.
-- A2/A3/A4 missing but A1 present -> same 0005P adds the index+trigger idempotently.
-- B* or C* MISSING (unlikely — coupons/referrals are live) -> STOP; these tables have
--     no numbered migration file. Do NOT re-enable db push; report for reviewed additive SQL.
-- D* MISSING -> apply 0008a_referral_referred_stage_expand.sql BEFORE deploying d6bad84
--     (additive, nullable, idempotent). Then run 0008b_referral_status_backfill.sql
--     ONLY AFTER the dual-status code is live. Until D passes, do NOT deploy d6bad84,
--     because new referral signups create REFERRED rows that need these columns.
-- =============================================================================
