# Referrals & Coupons — Final Report

**Date:** 2026-11-18
**Branch merged:** `fix/referrals-coupons-safe-fixes` → `main`
**Merge commit:** `9a1f138` (PR [#44](https://github.com/woways/bispun/pull/44), MERGED)
**Baseline:** latest remote `main` `ecdf34a` (no concurrent dev work to reconcile)

---

## 1. C2 — stale coupon reservation cleanup + expiry policy

**Problem:** A coupon redemption is `RESERVED` the moment a Razorpay order is created for a coupon signup. It only becomes `CONSUMED` (verified payment) or `RELEASED` (`payment.failed` webhook). A customer who **abandons checkout** triggers no webhook, so the row stayed `RESERVED` forever and kept counting against `maxRedemptions` and the per-customer limit — eventually making a valid coupon look exhausted. This is the most likely cause of **"coupons not working."**

**Implementation:** `server/lib/couponReservationSweeper.js`, a background worker registered in `server/index.js` using the **existing** worker pattern and the existing `DISABLE_BACKGROUND_WORKERS` gate (no new infrastructure). It runs every 10 minutes and releases **only** stale, **provably-unpaid** reservations:

1. Considers only rows still `RESERVED` and older than the TTL.
2. Establishes payment status **authoritatively** before releasing:
   - cheap DB signals first — `PendingSignup = CONSUMED`, `PaymentTransaction = CAPTURED`, or redemption already non-`RESERVED` → **keep**; `PendingSignup = FAILED` → releasable without any API call;
   - otherwise **Razorpay `orders.fetchPayments`** — any `captured` or `authorized` (in-flight) payment → **keep**.
3. If payment status **cannot be established** (Razorpay/DB error) → **kept, never released blindly**.
4. Release is a conditional, idempotent `updateMany(status: RESERVED → RELEASED)` — a racing consume always wins, and repeat sweeps are no-ops. Concurrency-safe.

**Selected expiry policy:** `COUPON_RESERVATION_TTL_MINUTES`, **default 60 minutes, floor 15 minutes.** The floor matches Razorpay's standard-checkout payment-session window (~15 min); 60 leaves generous room for a slow payer. Critically, **the TTL is not what protects a paid order — the live Razorpay payment check is** — so Razorpay's long webhook-retry window (up to ~24h) can never cause a wrongful release even with a short TTL. Delayed webhooks and retries are handled correctly because capture requires a prior authorization, which the live check detects and preserves.

**Not changed (deliberately):** the GST-inclusive final-price coupon model is untouched; order creation was **not** given a hard `expire_by` (that would risk failing legitimate slow payers) — safety is enforced by the live payment check instead.

---

## 2. Complete list of bugs fixed

| ID | Area | Fix |
|----|------|-----|
| BUG-1 | Referrals | Share link / QR / WhatsApp used `/?ref=` which redirects to `/app` and drops the code; now `/signup?ref=` so signup attribution works. |
| BUG-2 | Referrals | "My Referrals" (lead-tagging, no money) no longer claims a cash reward or auto-tagging; steps reworded Share → Tag → Track → Admitted. |
| C1 | Coupons | `FOR UPDATE` row lock in `reserveCouponRedemption` prevents overselling a limited coupon under concurrency. |
| C3 | Coupons | Per-customer limit enforced in-transaction (RESERVED + CONSUMED), closing the duplicate/concurrent bypass. |
| C5 | Coupons | `publicOnboard /start` fails closed (`503`) on an unexpected reserve error instead of silently continuing. |
| C6 | Coupons | Reject `validFrom > validUntil` on create and patch. |
| C4 | Coupons | Super Admin coupon date inputs formatted in `Asia/Kolkata` (were off by one day). |
| LOW-2 | Referrals | Self-referral guard before `crmReferral.create`. |
| **C2** | Coupons | **New** background sweeper releases abandoned reservations (above). |

---

## 3. Test results — including what is NOT tested

- **Automated suite: 127 / 127 pass** (116 prior + **11 new C2 tests**: expiry, paid-skip, in-flight/authorized-skip, fresh-skip, unknown-status-skip, failed-release, consumed-keep, race/idempotency, mixed batch, TTL policy).
- `node --check` on all changed backend files; `vite build` green; Prisma generate clean (no schema change — C2 uses existing `CouponRedemption.status` / `reservedAt`).
- **Accessibility:** the referral UI changes were reviewed by the accessibility lead — **PASS, AA-conformant, approved to ship** (one pre-existing, non-blocking note on the step switcher, out of scope).
- Re-verified all 8 earlier fixes by reading the actual merged code (coupons.js lock + per-customer; publicOnboard fail-closed; adminCoupons create+patch ordering; Coupons.jsx IST date; adminClients self-referral guard).

**NOT covered by automated tests (needs manual / staging verification):**
- **Real end-to-end Razorpay payment lifecycle** (sandbox): capture → consume, failure → release, and a live sweep against genuinely abandoned orders. The unit tests **mock** Razorpay and Prisma — do not treat 127 green tests as proof of the live payment path.
- **Two-window concurrent checkout** on a 1-redemption coupon (C1/C3) against a real database.
- Referral signup attribution end-to-end (open a real `/signup?ref=CODE` and confirm the code prefills and is credited).

---

## 4. Files changed and commits

**Commits (3):**
- `3e938b5` fix(referrals): correct signup attribution link and accurate My Referrals copy
- `658522a` fix(coupons): harden redemption concurrency, validity and limits
- `a8ae4dc` feat(coupons): release abandoned coupon reservations via background sweeper (C2)
- (merge) `9a1f138` Merge pull request #44

**Files (11):**
```
server/lib/coupons.js                       (C1, C3)
server/lib/couponReservationSweeper.js      (C2 — new)
server/lib/couponReservationSweeper.test.js (C2 tests — new)
server/index.js                             (register C2 sweeper)
server/routes/adminCoupons.js               (C6)
server/routes/publicOnboard.js              (C5)
server/routes/adminClients.js               (LOW-2)
src/modules/admin/Coupons.jsx               (C4)
src/modules/client/MyReferrals.jsx          (BUG-1, BUG-2)
src/modules/client/ReferralHome.jsx         (BUG-1)
package.json                                (register C2 test)
```

**Deliberately excluded from this PR:** the Meet announcement change (`server/socket.js`, `server/routes/clientChat.js`) from the prior turn — this task said *do not modify Meet functionality* and *keep the PR focused*. Those edits remain uncommitted in the `S:\Bispun-meetfix` worktree, held separately for your decision.

---

## 5. PR and main merge status

- PR [#44](https://github.com/woways/bispun/pull/44): **MERGED** into `main`.
- CI at merge: `conflict-and-syntax` ✅, `Vercel` ✅, `Vercel Preview Comments` ✅ — all green; `mergeStateStatus: CLEAN`; no required approval by branch protection.
- `origin/main` now at `9a1f138`. **Final destination reached: latest GitHub main.**

---

## 6. Remaining production deployment blockers

1. **Backend redeploy on Render is required for the coupon fix to actually take effect.** Render runs a **pinned** commit. Merging `main` auto-deploys only the **frontend** (Vercel) — so the urgent "coupons not working" fix (C1/C3/C5/**C2**) and LOW-2 are **not live** until someone redeploys the Render backend to `9a1f138`. **This is the key action still outstanding, and it is yours to trigger.**
2. **Live payment verification before/after that redeploy** (see §3 "not tested"): confirm in Razorpay sandbox or carefully in production that capture → consume, failure → release, and the sweeper's release-of-abandoned behave correctly against the real Razorpay API. The sweeper calls the live Razorpay API and will release real reservations — it is conservative and unit-tested, but has **not** been exercised against live Razorpay.
3. **`COUPON_RESERVATION_TTL_MINUTES`** is optional (defaults to 60). Set it in the Render environment only if you want a different window.
4. No DB migration and no destructive DB operations are involved; the schema is unchanged.

I stopped short of the Render backend redeploy because (a) I have no access to Render, and (b) activating the live-Razorpay sweeper in production without a live payment check is a material production risk that is your call to confirm.
