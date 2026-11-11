# Referrals — Final QA / Verification Report (PDF §11)

Independent verification of the referral lifecycle implementation. Findings below are from direct inspection of the committed code and actually-executed tests — not from the prior implementation summary.

## A. Git branch & commit

| Item | Value |
|---|---|
| Branch | `feat/referrals-lifecycle` (local only — **not pushed**) |
| Verified commit | `c714a7d` (exists; base `f6b7dd5` is an ancestor) |
| QA-pass changes | Added auth tests + a double-credit safety fix (uncommitted at time of writing — see §I) |
| Files changed vs base | 13 referral files only; **no** Dashboard/Finance/Analytics/Admissions/Lead-Store/etc. files touched |
| Remote | Branch not on origin; `origin/main` unchanged |

## B. Requirement traceability (11.1–11.9)

| Req | Implemented? | Frontend evidence | Backend evidence | Test evidence | Result |
|---|---|---|---|---|---|
| 11.1 Four-stage lifecycle | Yes | `ReferralHome.jsx` stepper + 4 `<section>` stages (Link/Referred/Earned/Credited) | `clientReferrals.js /me` returns code, referrals, summary{earned,credited,pendingCredit} | build green; unit tests | **PASS (code)** · live flow BLOCKED |
| 11.2 Generate/copy link | Yes | Stage 1: code + Copy, Copy link, WhatsApp; link `…/?ref=CODE`; persists (no regen) | `ensureCode()` lazy, `User.referralCode @unique` | — | **PASS (code)** · browser copy BLOCKED |
| 11.3 Referred | Yes | Stage 2 list: name, plan, join date, "Qualified"; empty state | `/me` returns crmReferrals; `referredCompanyId @unique` (dedup); self-referral guard | self-referral guard verified in code | **PASS (code)** · live attribution BLOCKED |
| 11.4 Earned | Yes | Stage 3: total earned, count, rate, slabs (₹2,500/₹3,000/₹4,000) | `getReferralRewardSummary`; qualification = paid signup (pre-existing at baseline) | 14 reward/credit unit tests pass | **PASS** (logic tested) |
| 11.5 5–8 day expectation | Yes | Stage 4 "Expected in about 5–8 days…"; distinct from Credited | `CREDIT_EXPECTATION_DAYS={5,8}` exposed | test asserts window | **PASS (code)** |
| 11.6 Client read-only | Yes | No redeem/payout control anywhere in client UI | `POST /redeem` **removed**; client cannot credit | grep confirms no redeem refs | **PASS** |
| 11.7 Super Admin credit | Yes | Admin "Mark credited" + confirm dialog (Cancel default, irreversible text) | `POST /credit` idempotent, advisory-locked, audited (`creditedById`, `source`, `paidAt`) | 5 auth tests + credit-math tests pass | **PASS (code + auth tested)** · live confirm BLOCKED |
| 11.8 Credited notification | Yes | Notification routes to `my-referrals` | `createReferralCreditedNotification`; deduped via `notifiedAt` | — | **PASS (code)** · live delivery BLOCKED |
| 11.9 Rework old UI | Yes | 4-stage rebuild; redeem removed; lead-tagging kept as separate tab; legacy payouts panel retained read-safely | — | — | **PASS (code)** |

## C. Frontend verification (static inventory of actual controls)

**Client (`ReferralHome.jsx`):** 4-step stepper buttons; Copy code; Copy link; Share on WhatsApp (new tab, sr-only warning); Referred list + empty state; Earned tiles + slab cards; Credited/Awaiting cards + 5–8 day note; credit-history table (caption + scope). **No redeem/payout control** (confirmed). Tabs: "Referral program" / "My Referrals" (plain buttons, `aria-current`).
**Admin (`Referrals.jsx`):** Refresh; summary tiles; slab structure; Referrer Earnings table with per-row **Mark credited**; native `<dialog>` (Cancel autofocus, confirm `Mark <name> credited`, `aria-busy`); legacy payouts panel (Approve/Reject/Mark Paid).
**Accessibility:** two independent accessibility-lead reviews on the final code → all CONFIRMED; defects fixed (always-mounted `role=status` live region; focus-moving stepper; native dialog pattern; table caption/scope; −700 chip contrast; awaited clipboard write; post-credit focus restore; contrast bumped `slate-400`→`slate-500`; ARIA-tabs simplified to buttons).
Live responsive (375/390/768/1024/1440) + keyboard/SR run: **BLOCKED** (needs running app + authenticated data).

## D. Backend / API & security

| Check | Result | Evidence |
|---|---|---|
| Admin routes require Super Admin | PASS | `router.use(requireSuperAdmin)`; 5 auth tests (no token / CLIENT_ADMIN / MANAGER / forged / wrong-secret → 401) all pass |
| Credit input validation | PASS (logic) | `resolveCreditAmount` unit tests (invalid/zero/negative/non-integer/exceeds) |
| Idempotent / no double-credit | PASS (logic + design) | advisory lock `pg_advisory_xact_lock`; recompute-in-transaction; `resolveCreditAmount` NOTHING_TO_CREDIT; legacy-reserved excluded (fix §I); legacy PAID guarded |
| Tenant isolation | PASS (code) | client `/me` scoped by `companyId` + `referrerId` |
| Transaction rollback | PASS (design) | credit create inside `$transaction`; throw → rollback |
| Legacy `/redeem` | Removed | returns 404 (route deleted) |
| Full DB-backed HTTP tests (missing IDs, concurrency under load) | **BLOCKED / NOT TESTED** | no test Postgres available |

**No real payment/transfer is performed** — "credited" is an administrative confirmation recorded in `ReferralPayoutRequest` (status PAID, source ADMIN_CREDIT), not a money movement.

## E. Database / migration (`0007`)

Additive (`ADD COLUMN IF NOT EXISTS` × 3), idempotent, non-destructive (only a `COALESCE` backfill of `notifiedAt` on existing PAID rows), reversible (rollback SQL in file header). Schema ↔ migration agree (`source` default `CLIENT_REQUEST`, `creditedById` text null, `notifiedAt` timestamp null). **Not applied to any DB.** Apply to Dev: `psql "$DATABASE_URL" -f prisma/pending-migrations/0007_add_referral_credit_audit.sql && npm run prisma:generate`.

## F. Security & permissions — see §D. Client/Manager/Employee cannot credit (no UI path + backend 401). Self-referral blocked.

## G. Tests executed (actual commands)

- `npm test` → **46/46 pass** (26 pre-existing + 14 reward/credit + 5 admin auth + 1 double-credit regression). Breakdown: `node --test server/lib/{pushService,pushDispatch,leadVisibility,pageAccess,referralRewards}.test.js server/routes/adminReferralsAuth.test.js`.
- `npm run build` (Vite) → **exit 0** (pre-existing chunk-size warning only, unrelated).
- No lint/type-check script is configured in this JS project; the Vite build is the compile gate.

## H. Browser screenshots / evidence

None captured — live browser run is BLOCKED (needs running app + Dev DB + seeded referral data + auth). Use `REFERRALS-MANUAL-QA-GUIDE.md` to capture evidence.

## I. Confirmed defects, fixes, remaining risks

**DEFECT (fixed) — double-credit across old & new flows.** `POST /credit` computed outstanding as `earned − paid`, ignoring amounts reserved by legacy PENDING/APPROVED payout requests; paying such a legacy request afterward could push total credited above earned.
- **Root cause:** two crediting paths (new `/credit` and legacy `PATCH /payouts/:id`) didn't share a balance accounting.
- **Fix:** `/credit` now subtracts legacy reserved (PENDING+APPROVED) from the creditable amount; legacy `PATCH→PAID` now rejects (409) if it would exceed earned; admin list exposes `creditable` so the dialog shows the authoritative figure. Added a regression unit test. (`server/routes/adminReferrals.js`, `src/modules/admin/Referrals.jsx`, `server/lib/referralRewards.test.js`.)

**Remaining risks / notes:**
- Live E2E, concurrency-under-load, and DB-backed HTTP edge cases are **NOT TESTED** (no safe DB in this environment).
- Legacy open payout requests, if any exist in prod, should be resolved by Super Admin; they are shown read-safely and cannot cause over-credit after the fix.
- Mobile/Android referral screens not run here (same web bundle; build green).

## J. Blocked / untested scenarios

E2E referral signup→credit; live notification delivery; browser responsive/keyboard/SR; DB migration execution; concurrency under real load. All require a disposable Dev environment with seeded data + sandbox signup.

## K. Manual testing instructions

See `REFERRALS-MANUAL-QA-GUIDE.md` (Client Admin, Manager, Employee, Super Admin, notifications, E2E, responsive/a11y; with sample data and pass/fail checkboxes).

## L. Final readiness verdict

**CONDITIONAL PASS.**
All nine PDF §11 requirements are implemented and verified at the code + unit-test + authorization level (46/46 tests, green build, two a11y reviews, one real defect found and fixed). It is **not** declared production-ready because the end-to-end flow and the `0007` migration have **not** been executed in a safe environment yet. To reach full PASS: apply `0007` to Dev, run the manual E2E guide (signup → earn → credit → notification, incl. double-credit and unauthorized-credit checks), then push/PR on your approval.

## Strict-rules compliance
No push/merge/deploy. No production DB changes / no migration applied. Dashboard→Analytics and all unrelated modules preserved (diff touches referral files only). No secrets exposed. No unexecuted test marked passed. No historical referral/payment data deleted. No business/payment rules invented (qualification + slabs are pre-existing at baseline).
