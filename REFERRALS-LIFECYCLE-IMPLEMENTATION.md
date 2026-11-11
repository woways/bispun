# Referrals Lifecycle — Implementation Report (PDF §11)

**Branch:** `feat/referrals-lifecycle` (base: `origin/main` @ `f6b7dd5`)
**Scope:** PDF Section 11 (Referrals, 11.1–11.9) only. All other modules (Dashboard → Analytics, Finance, Admissions, etc.) untouched.
**Status:** Implemented on the feature branch. Not merged / pushed / deployed. No production DB changes.

---

## 1. Existing implementation audit

There are **two distinct referral systems** in the codebase:

| System | Model | Purpose | Earns money? |
|---|---|---|---|
| **SaaS referral** | `CrmReferral` | A Bispun user shares a code/link; another **company** signs up for Bispun CRM with it | **Yes** (this is PDF §11) |
| **Lead tagging** | `Referral` | A user tags an internal CRM **lead** as "referred" (the "My Referrals" tab) | No |

**Qualification rule (existing, approved — reused, not invented):** in `server/lib/selfServeOnboard.js`, when a new company completes a **paid** self-serve signup (`subscription ACTIVE` + `payment CAPTURED`) using a referral code, a `CrmReferral` is created `status=SUCCESSFUL`, `qualifiedAt=now`, inside the signup transaction.

**Reward rule (existing, approved — reused):** `server/lib/referralRewards.js` slabs — 1–5 → ₹2,500, 6–10 → ₹3,000, 11+ → ₹4,000, each per successful referral; `totalEarnings = count × slabRate`.

| Finding | Detail |
|---|---|
| Works | Persistent unique `User.referralCode` (lazy-generated); copy + WhatsApp share; `?ref=CODE` link; attribution on paid signup; **duplicate attribution blocked** by `CrmReferral.referredCompanyId @unique`; slab rewards; backend-enforced roles; tenant-scoped queries |
| Partial | "Credited" was modelled as a **client-initiated payout request** (`ReferralPayoutRequest` PENDING→APPROVED→PAID) — backwards vs the PDF |
| Missing | 5–8 day credit expectation (11.5); **"Amount credited" notification (11.8)**; Super-Admin-initiated "mark credited" (11.7); credit audit trail; self-referral guard |
| Conflicted with PDF | Client "Request Payout / Redeem" form violated 11.6 (clients must only *view*); UI mixed lead pipeline + CRM earnings confusingly (11.9) |
| Reused safely | `referralRewards.js`, `createClientNotification`, auth middleware, `CrmReferral` / `ReferralPayoutRequest` models, link/code generation |

---

## 2. PDF §11 requirement checklist

| Req | Requirement | Status | Where |
|---|---|---|---|
| 11.1 | Lifecycle Link → Referred → Earned → Credited | ✅ | `ReferralHome.jsx` 4-stage stepper |
| 11.2 | Generate/copy unique link | ✅ | `ReferralHome.jsx` Stage 1 (code + link + WhatsApp) |
| 11.3 | Referred person appears under Referred | ✅ | `ReferralHome.jsx` Stage 2 (name, plan, join date, Qualified) |
| 11.4 | See referral money earned | ✅ | Stage 3 (total earned, count, rate, slabs) |
| 11.5 | ~5–8 day credit expectation | ✅ | Stage 4 + `CREDIT_EXPECTATION_DAYS` on server |
| 11.6 | Client read-only (no manual credit) | ✅ | Client `/redeem` removed; UI read-only |
| 11.7 | Super Admin checkbox/action to mark credited | ✅ | `POST /api/admin/referrals/credit` + confirmation dialog |
| 11.8 | "Amount credited" notification | ✅ | `createReferralCreditedNotification` on credit |
| 11.9 | Remove/rework non-conforming UI | ✅ | Redeem removed; 4-stage rebuild; lead tagging kept as a separate tab |

---

## 3. Confirmed business decisions (approved by product owner this session)

1. **Remove client-initiated redeem** → clients get a read-only Earned → Pending Credit → Credited view.
2. **Credit the available balance** → one Super-Admin action credits the earned-but-uncredited amount (aggregate, fits slab math, preserves history).
3. **Keep lead-tagging "My Referrals"** as a separate tab (feature preserved, not surfaced in the 4-stage journey).

No reward rule or qualifying event was invented. Section 17 (Coupon/Referral Codes) is explicitly deferred to a separate business-rule definition and is **out of scope**.

---

## 4. Files changed

**Added**
- `prisma/pending-migrations/0007_add_referral_credit_audit.sql` — additive, reversible credit-audit columns
- `server/lib/referralRewards.test.js` — 14 unit tests (slab + credit logic)
- `REFERRALS-LIFECYCLE-IMPLEMENTATION.md` — this report

**Modified**
- `prisma/schema.prisma` — `ReferralPayoutRequest`: `source`, `creditedById`, `notifiedAt`
- `server/lib/referralRewards.js` — `getReferralCreditState`, `resolveCreditAmount`, `CREDIT_EXPECTATION_DAYS`; hardened count parsing
- `server/lib/notifications.js` — `createReferralCreditedNotification` (11.8)
- `server/routes/adminReferrals.js` — `POST /credit` (idempotent, locked, audited, notifies); credit state in list; notify on legacy PAID
- `server/routes/clientReferrals.js` — expose earned/credited/pendingCredit + expectation; **removed `POST /redeem`**
- `server/lib/selfServeOnboard.js` — self-referral guard
- `src/modules/client/ReferralHome.jsx` — rebuilt as the 4-stage lifecycle view
- `src/modules/client/Referrals.jsx` — 2-tab orchestrator, redeem removed
- `src/modules/admin/Referrals.jsx` — "Mark credited" + accessible confirmation dialog
- `package.json` — referral tests added to `npm test`

---

## 5. Database / migration

`0007_add_referral_credit_audit.sql` adds nullable/defaulted columns only — no data dropped or rewritten; existing rows back-filled as legacy client requests; existing PAID rows marked already-notified. Rollback SQL is in the file header.

**Apply to Dev (operator, deliberate):**
```bash
# ensure .env points at the DEV database, then:
psql "$DATABASE_URL" -f prisma/pending-migrations/0007_add_referral_credit_audit.sql
npm run prisma:generate
```
**Do not run against production** without explicit approval.

---

## 6. API changes

| Method | Route | Change |
|---|---|---|
| GET | `/api/client/referrals/me` | Adds `rewardProgram.summary.{earned,credited,pendingCredit}` and `rewardProgram.creditExpectationDays` |
| POST | `/api/client/referrals/redeem` | **Removed** (11.6) |
| GET | `/api/admin/referrals` | Adds `summary.{earned,credited,pendingCredit}` per referrer |
| POST | `/api/admin/referrals/credit` | **New** — `{ referrerId, amount?, paymentReference? }`; idempotent, advisory-locked, audited, notifies |
| PATCH | `/api/admin/referrals/payouts/:id` | Now sends the credited notification once on PAID (legacy records) |

---

## 7. Security / permissions

- Client routes: `requireClientUser`; admin credit route: `requireSuperAdmin` (JWT role **and** DB re-check — never frontend-trusted).
- Credit is **idempotent + race-safe**: `pg_advisory_xact_lock(hashtext(referrerId))` serializes concurrent credits; outstanding balance recomputed inside the transaction; a second/double action credits nothing.
- Audit: `source=ADMIN_CREDIT`, `creditedById`, `paidAt`, `amount`, `referrerId`, optional `paymentReference` persisted.
- Notification dedup: `notifiedAt` guards against duplicate "Amount credited" messages on retry.
- Self-referral blocked (referrer email == new admin email → no reward).
- Tenant isolation preserved (client queries scoped by `companyId` + `referrerId`).

---

## 8. Tests executed

- `npm test` → **40/40 pass** (26 pre-existing + 14 new referral tests).
- New tests cover: slab selection + boundaries, `totalEarnings`, credit-state split, over-credit clamp, `resolveCreditAmount` (default full, nothing-to-credit guard, exceeds-outstanding, invalid amounts, valid partial), expectation window.
- `npm run build` → see report footer (Vite production build).

> Credit endpoint idempotency/locking is covered at the pure-logic layer (`resolveCreditAmount`, `getReferralCreditState`) + the advisory lock. A full DB integration test is a recommended follow-up.

---

## 9. Local testing instructions (sample scenarios)

```bash
npm run prisma:generate
# apply 0007 to your DEV DB (section 5), then
npm run server   # backend
npm run dev      # web
```

1. **Link** — Client portal → Referrals → "Referral program": copy code/link; refresh — same code persists.
2. **Referred** — self-serve signup a test company at `/?ref=<CODE>` and complete paid onboarding → appears under "Referred", `pendingCredit` increases.
3. **Self-referral** — sign up using your own code + your own email → no reward created.
4. **Earned** — verify slab/rate/total against §1 rules.
5. **Credited** — Super Admin → Referrals → "Mark credited" → confirm dialog → client sees Credited rise, Awaiting credit fall, credit-history row, and an "Amount credited" notification. Double-click the action → second attempt rejected (idempotent).
6. **Permissions** — a non-super-admin JWT calling `POST /api/admin/referrals/credit` → 401.

---

## 10. Remaining blockers / decisions

- **None blocking §11.** Section 17 (coupon/referral codes) deferred by the PDF.
- Recommended follow-ups (not required for §11): DB-level integration test for the credit endpoint; optional cleanup of legacy open payout requests.

---

## 11. Preservation of unrelated modules

Only referral files were changed (section 4). Dashboard → Analytics, Finance, Admissions, Lead Store, Chats, UTM, Counselling, Walk-ins, notifications infra, auth/session, signup/billing and the lead-tagging feature are untouched; `npm test` baseline (26) still passes.
