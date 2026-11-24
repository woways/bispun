# Referrals & Coupons — Audit and Safe Bug Fixes

**Date:** 2026-11-18
**Baseline:** latest remote `main` (commit `ecdf34a`), audited in an isolated worktree (`S:\Bispun-meetfix`).
**Status:** Fixes applied and verified locally. **Nothing pushed, merged, or deployed.** Meet functionality untouched. Final-price coupon model preserved (no conversion to percentage).

---

## 1. How it was verified

| Check | Result |
|---|---|
| Backend syntax (`node --check`) on all changed `.js` files | Pass |
| Prisma client generate | Pass |
| Frontend production build (`vite build`) | Pass — only the pre-existing "chunk > 500 kB" warning, unrelated to these changes |
| Full test suite (`npm test`) | **116 / 116 pass, 0 fail** |

No production data was touched. No real payments or credits were initiated. DB/security checks were read-only.

---

## 2. Results table

| # | Feature | Bug | Root cause | Fix | Files changed | Test result | Remaining manual verification |
|---|---|---|---|---|---|---|---|
| BUG-1 | Referral share link (both referral pages) | The shared link (`https://www.bispun.com/?ref=CODE`) **never captured the referral code**. QR code and WhatsApp share carried the same broken link. | Root route `/` does `<Navigate to="/app" replace />`, which drops the query string. The `?ref=` code is only read on `/signup` (SignupPage.jsx:444). So every referral link landed on `/app` and lost the code. | Point the link at `/signup?ref=CODE` so the code prefills on the signup form. | `src/modules/client/ReferralHome.jsx`, `src/modules/client/MyReferrals.jsx` | Build pass | Open the portal, copy a referral link, open it in a fresh/incognito window → signup form should prefill the referrer code. Scan the QR → same. |
| BUG-2 | "My Referrals" page copy | Misleading descriptions: implied referrals are **auto-tagged** ("no manual work — the system links them") and that this page pays a **money reward** ("Earn your reward… unlocks automatically"). Neither is true for this page. | "My Referrals" is the **lead-tagging** system (tag a lead you referred; track it to admission). It has **no money**. Tagging is **manual**. The money/credit system is the separate CRM referral program (Super Admin credits). The copy conflated the two. | Reworded the 4-step guide and headings to describe the real flow: Share → **Tag** (manual) → Track → **Admitted**. Removed the money/auto-tag claims. Dropped the now-unused `Gift` icon import. | `src/modules/client/MyReferrals.jsx` | Build pass | Open "My Referrals" → the "How referral works" steps and "Share your link" card should read accurately (no "earn/reward", no "auto-tagged"). |
| C1 | Coupon redemption (checkout) | A limited coupon (`maxRedemptions`) could be **oversold** — two near-simultaneous checkouts could both pass the cap check and both reserve. | Count-then-create ran under Read Committed with no lock, so concurrent transactions didn't see each other's pending reservation. | Take a `SELECT … FOR UPDATE` row lock on the `Coupon` first, serialising reservations for that coupon; cap check (RESERVED + CONSUMED) then runs inside the lock. | `server/lib/coupons.js` | 116/116 | Load-test or two-tab concurrent checkout on a 1-redemption test coupon → only one should succeed. |
| C3 | Coupon per-customer limit | The per-customer limit was enforced only at quote time (counting `CONSUMED` only), so duplicate/concurrent signups by the same email could slip past. | Quote-time check counted only consumed redemptions and wasn't inside the reservation lock. | Enforce per-customer limit inside the same `FOR UPDATE` transaction, counting RESERVED + CONSUMED. | `server/lib/coupons.js` | 116/116 | Same email, two concurrent checkouts on a `perCustomerLimit: 1` test coupon → second should be rejected. |
| C5 | Public onboarding `/start` | If coupon reservation hit an unexpected (non-coupon) error, the request could proceed **without** applying the coupon state. | The catch block swallowed non-`CouponError` errors and continued. | Fail closed: on an unexpected reserve error return `503 COUPON_RESERVE_FAILED` instead of silently continuing. | `server/routes/publicOnboard.js` | 116/116 | Hard to trigger manually; confirmed by code review + tests. Normal coupon signup still works. |
| C6 | Super Admin coupon create/edit | A coupon could be saved with `validFrom` **after** `validUntil` (a window that's never valid). | No ordering validation on create or patch. | Reject when effective `validFrom > validUntil` on both create and patch (patch uses incoming-or-existing values). | `server/routes/adminCoupons.js` | 116/116 | In Super Admin → Coupons, try saving valid-from later than valid-until → should be rejected with a clear message. |
| C4 | Super Admin coupon date display | Coupon dates could show **off by one day** for IST users. | `toISOString().slice(0,10)` converts to UTC before slicing, shifting the date back for +05:30. | Format the date input value in `Asia/Kolkata` via `toLocaleDateString("en-CA", …)`. | `src/modules/admin/Coupons.jsx` | Build pass | In Super Admin → Coupons, edit a coupon → the valid-from/until shown should match what was saved (no −1 day). |
| LOW-2 | CRM referral on client creation | A client could be recorded as referring **themselves** if the referrer email matched the new client admin's email. | No self-referral guard before `crmReferral.create`. | Skip creating the CRM referral when referrer email == client admin email (case-insensitive). | `server/routes/adminClients.js` | 116/116 | Create a client in Super Admin with a referrer code whose email equals the new admin's email → no self-referral row created. |

---

## 3. Known issue flagged (NOT fixed — needs your decision)

**C2 — Stale `RESERVED` coupon reservations are never released.** If a checkout reserves a coupon slot but the customer never pays (abandons/closes the tab) and no explicit release runs, that `RESERVED` row counts against `maxRedemptions` / per-customer limit **forever**, slowly "using up" a limited coupon.

- **Why not fixed here:** the correct fix is a scheduled sweeper/worker (release reservations older than N minutes) or a TTL — that's an infrastructure decision (where it runs, how often, the expiry window), and adding a background worker unilaterally is outside "safe, reviewed" scope.
- **Recommendation:** add a small periodic job that releases `RESERVED` redemptions older than your payment-session timeout. I can implement it once you approve the approach and the expiry window.

---

## 4. Plain-English: how Referrals & Coupons work

### There are TWO separate referral systems — they are often confused

**A. CRM referral program (money).** When a *business* signs up for Bispun using another customer's referral code, that's recorded as a CRM referral. The **Super Admin** reviews these and credits the referrer a cash reward (slabs: ₹2,500 / ₹3,000 / ₹4,000, by the current slab). This is the one with money. It lives in the Super Admin portal.

**B. "My Referrals" (lead tagging — no money).** Inside a customer's own CRM, a staff member can **tag a lead they referred** and then **track that lead through the admissions stages** (Share → Tag → Track → Admitted). This is purely for attribution and follow-up within that customer's pipeline. **It pays nothing.** (The misleading "earn a reward" copy here is what BUG-2 fixed.)

### Coupons (Super Admin → Coupons)

- A coupon is a **flat, GST-inclusive final price** for an eligible plan — e.g. "Advanced plan for ₹X all-inclusive" — **not** a percentage discount. (This model is preserved.)
- Super Admin creates coupons with: code, final amount, eligible plan(s), optional validity window, max total redemptions, and per-customer limit.
- At signup a customer enters the coupon code; the system validates it (active, in date, plan-eligible, under limits, and genuinely cheaper than the normal price) and **reserves** a redemption for the order.
- On successful payment the reservation is **consumed** (and `usedCount` increments); on failure/cancel it's **released**. Reservations are idempotent per order.
- The concurrency and validity fixes above (C1/C3/C5/C6) harden this flow; C2 is the one open item.

---

## 5. Constraints honoured

- Existing Web / Backend / Android functionality preserved; no features removed.
- **Meet functionality not touched.**
- Final-price coupon model preserved — **no** percentage conversion.
- No push / merge / deploy; changes live only in the audit worktree for your review.
- No production data modified; no real payments or credits; no secrets exposed.
- Security/permission behaviour preserved (all coupon admin routes still `requireSuperAdmin`; fixes only add stricter checks).

---

## 6. To review the changes

Changes are in the worktree `S:\Bispun-meetfix` on top of `main` (`ecdf34a`). The 7 changed files:

```
server/lib/coupons.js               (C1, C3)
server/routes/adminClients.js       (LOW-2)
server/routes/adminCoupons.js       (C6)
server/routes/publicOnboard.js      (C5)
src/modules/admin/Coupons.jsx       (C4)
src/modules/client/MyReferrals.jsx  (BUG-1, BUG-2)
src/modules/client/ReferralHome.jsx (BUG-1)
```

Tell me when you've reviewed and I'll prepare them for a commit (and, on your go-ahead, decide branch vs. main per your earlier preference).
