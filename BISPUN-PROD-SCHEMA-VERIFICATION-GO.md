# Bispun — Production schema compatibility for `main @ 33659f1`

**Date:** 2026-11-18 · **Target commit:** `33659f1` · **Render build command (confirmed by operator):** `npm install && npx prisma generate` (no `db push`).

## Scope of my verification (and its limit)
I verified, **read-only from the repo**, exactly what `main @ 33659f1` requires of the database, and that this release changes the schema by **nothing**. I have **no access to the production Pond/Neon database** (its `DATABASE_URL` lives only in Render's env store and I will not use app credentials against prod), so the **final prod-state confirmation is the read-only SQL in §3, which the operator runs in Neon.** I did not modify production data or My Store.

## 1. Two facts that de-risk this deploy
1. **Zero schema delta in this release.** `git diff --name-only ecdf34a..33659f1 -- prisma/` = **0 files**. C2 uses existing `CouponRedemption.status`/`reservedAt`; Meet uses existing `ChatMessage`/`ConversationMember`. Nothing new is required beyond what `ecdf34a` already required.
2. **The deploy no longer mutates the schema.** With `db push` removed from the build command, deploying `33659f1` runs `prisma generate` (local, no DB contact) and then the server. **It cannot alter, drop, or sync the prod schema.** The old uncontrolled-`db push` P0 is therefore neutralised for this deploy.

→ Compatibility reduces to one question: **does prod already contain the objects the `33659f1` backend queries?** Because prod was continuously `db push`-synced to `schema.prisma` on prior deploys, and coupons are already live in prod, the answer is almost certainly yes — but it must be confirmed with §3.

## 2. What `main` requires (must exist in prod)
**Critical for the whole backend (not just this release):**
- `Lead.leadNumber` (integer) — the backend **selects it** in `clientAdmissions.js` and `clientAnalytics.js`. **If this column is absent, admissions & analytics will 500.** (Nullability NOT NULL vs nullable does not matter to the code.) Ideally also its unique index `Lead_companyId_leadNumber_key` and trigger `Lead_assign_lead_number` (for correct ID assignment).

**Coupons (coupon fixes + C2):**
- Tables `Coupon`, `CouponRedemption`; enum `CouponRedemptionStatus` = {RESERVED, CONSUMED, RELEASED}.
- `CouponRedemption` columns: `status`, `reservedAt`, `consumedAt`, `releasedAt`, `providerOrderId` (UNIQUE), `customerEmail`, `couponId`, `amount`, `planKey`, `companyId`.

**Referrals (attribution + credit flow):**
- Tables `Referral`, `CrmReferral`, `ReferralPayoutRequest`; enum `ReferralPayoutStatus`.
- `ReferralPayoutRequest` credit-audit columns: `source`, `creditedById`, `notifiedAt` (from `0007_add_referral_credit_audit.sql`).

Note: Coupon/Referral tables have **no numbered migration file** — they only ever reached prod via historical `db push`. They are expected present (coupons are live), but §3 confirms it.

## 3. READ-ONLY verification SQL (operator runs in Neon → project `consulbuzz-production` → branch `production` → db `neondb` → SQL Editor). SELECT-only; changes nothing.
```sql
-- (A) Lead.leadNumber — REQUIRED (admissions/analytics select it)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='Lead' AND column_name='leadNumber';                 -- expect 1 row, integer
SELECT indexname FROM pg_indexes
WHERE tablename='Lead' AND indexname='Lead_companyId_leadNumber_key'; -- expect present
SELECT tgname FROM pg_trigger WHERE tgname='Lead_assign_lead_number'; -- expect present

-- (B) Coupon tables + enum + CouponRedemption columns — REQUIRED (coupons + C2)
SELECT to_regclass('"Coupon"') AS coupon, to_regclass('"CouponRedemption"') AS redemption; -- both non-null
SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
WHERE t.typname='CouponRedemptionStatus' ORDER BY e.enumsortorder;    -- RESERVED,CONSUMED,RELEASED
SELECT column_name FROM information_schema.columns
WHERE table_name='CouponRedemption'
  AND column_name IN ('status','reservedAt','consumedAt','releasedAt','providerOrderId','customerEmail','couponId','amount','planKey','companyId');
SELECT indexdef FROM pg_indexes
WHERE tablename='CouponRedemption' AND indexdef ILIKE '%providerOrderId%'; -- expect a UNIQUE index

-- (C) Referral tables + payout audit columns — REQUIRED (referral credit flow)
SELECT to_regclass('"Referral"') AS referral,
       to_regclass('"CrmReferral"') AS crm_referral,
       to_regclass('"ReferralPayoutRequest"') AS payout;               -- all non-null
SELECT column_name FROM information_schema.columns
WHERE table_name='ReferralPayoutRequest'
  AND column_name IN ('source','creditedById','notifiedAt','status','amount');
SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
WHERE t.typname='ReferralPayoutStatus' ORDER BY e.enumsortorder;       -- expect PENDING + others
```

## 4. GO / NO-GO decision tree
- **(A) `Lead.leadNumber` present** AND **(B) coupon objects present** AND **(C) referral objects present** → ✅ **GO.** The deploy is schema-neutral and the new code is fully compatible. Proceed with §5.
- **`Lead.leadNumber` MISSING** → 🔴 **NO-GO** until you apply `prisma/pending-migrations/0005P_prod_stable_lead_number_nullable.sql` (§6). Admissions/analytics would 500 otherwise.
- **Any coupon/referral object MISSING** (unlikely — coupons are live) → 🔴 **NO-GO**; stop and tell me — those have no migration file, so I will produce reviewed additive SQL from `schema.prisma`. Do **not** fix by re-enabling `db push`.

My assessment: given coupons are live in prod and prod was `db push`-synced on prior deploys, I expect **all three present → GO**. The SQL is the final confirmation.

## 5. Manual Render deploy steps (once §4 = GO)
1. **Pre-checks (Render → `bispun-api`):** Build Command = `npm install && npx prisma generate` ✓ (no `db push`); Start = `npm run server`; Pre-Deploy empty. Env present: `DATABASE_URL` (prod Neon), `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. For the C2 sweeper to run, `DISABLE_BACKGROUND_WORKERS` must be unset/false; `COUPON_RESERVATION_TTL_MINUTES` optional (default 60).
2. **Safety checkpoint:** in Neon, create a branch from `production` (instant restore point) or confirm the PITR window. (Deploy is schema-neutral, but keep a restore point.)
3. **Deploy:** Render → `bispun-api` → **Manual Deploy → Deploy a specific commit → `33659f1`** (or "Deploy latest commit" since `main` HEAD = `33659f1`). Optionally "Clear build cache".
4. **Watch build logs:** confirm `prisma generate` succeeds and **no `prisma db push` runs**; build completes; service restarts.
5. **Health:** confirm the service is Live and the startup log shows the API listening and the background workers starting (no `DISABLE_BACKGROUND_WORKERS` warning). Hit the health endpoint (200).
6. **Smoke (test data only — no real payments/credits):** open a coupon in Super Admin (loads, dates correct), start a chat Meet (all members get the "Meeting started/Join" card with the same link), open a referral `/signup?ref=CODE` (code prefills). Watch logs for the first coupon-sweeper run line (`released / keptPaid / keptUnknown`).
7. **Rollback if needed:** Render → Events/Deploys → Rollback to the previous healthy deploy. Frontend unaffected (schema-neutral); for any data incident use the Neon branch/PITR from step 2.

## 6. Minimal safe migration (only if §3 shows `leadNumber` MISSING)
1. **Backup:** Neon → branch from `production` (restore point); note it.
2. **Apply (controlled, NOT `db push`):** in the Neon SQL editor against `production`, run `prisma/pending-migrations/0005P_prod_stable_lead_number_nullable.sql` (already validated twice on a prod-like clone; additive + idempotent). If other lead/dataset objects are also missing, use the reviewed order in `APPLY_prod_reconciliation_20261111.sql` (skip `0001` and `0007_DRAFT`).
3. **Verify:** 0 NULL `leadNumber`, 0 duplicates per `(companyId, leadNumber)`, unique index + trigger present (post-conditions listed in that runbook).
4. **Re-run §3**, then proceed to §5.

## Boundaries honoured
Read-only verification only; no prod data changed; no `db push`; no schema edit; **My Store (`StoreAsset`) untouched**; no changes to any unrelated functionality or other developers' branches.
