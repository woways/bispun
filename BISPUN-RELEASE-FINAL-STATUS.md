# Bispun — Referrals, Coupons & Meet: Final Release Status

**Date:** 2026-11-18
**Final `main` commit:** `33659f1` (`origin/main`)
**This release (`ecdf34a` → `33659f1`): 13 files, 0 Prisma/schema changes.**

## Status table

| Feature | Tests | On GitHub main | Live on Render (backend) | Pending |
|---|---|---|---|---|
| Referrals | Unit pass; live E2E **not run** | ✅ (PR #44) | ⚠️ Frontend (BUG-1 link, BUG-2 copy) live via Vercel; backend LOW-2 needs Render deploy | Live signup-attribution test; Render deploy for LOW-2 |
| Coupons | Unit pass; live payment E2E **not run** | ✅ (PR #44) | ❌ Backend (C1/C3/C5/C6) not live; C4 date UI live via Vercel | **Render deploy (blocked)** + live payment test |
| C2 cleanup | 11 unit tests pass; live-Razorpay **not run** | ✅ (PR #44) | ❌ Not live (backend worker) | **Render deploy (blocked)** + live sweep observation |
| Meet | Code-verified; multi-user join **not run** | ✅ (PR #45) | ❌ Not live (backend) | **Render deploy (blocked)** + multi-user join test |

"Live via Vercel" assumes the project's existing `main`→Vercel frontend auto-deploy (the P0 doc flagged Vercel's production-branch config as itself unverified).

## Commits / PRs
- `33659f1` Merge PR **#45** (Meet) — MERGED
- `be801da` fix(chat): Meet announcement server-side
- `9a1f138` Merge PR **#44** (Referrals+Coupons) — MERGED
- `a8ae4dc` C2 sweeper · `658522a` coupon hardening · `3e938b5` referral fixes
- PR **#43** (notification deep-links) left untouched — OPEN/DRAFT, "blocked on prod DB reconciliation" (another workstream).
- My Store: **not touched.** Other devs' 7 worktrees/branches: **untouched.**

## All fixes consolidated on main (10)
BUG-1 referral signup link · BUG-2 My Referrals copy · LOW-2 self-referral guard · C1 coupon FOR UPDATE lock · C3 per-customer limit in-tx · C5 fail-closed reserve · C6 validFrom≤validUntil · C4 IST coupon dates · **C2 abandoned-reservation sweeper** · Meet server-side announcement.

## Tests
- **Automated: 127/127 pass** (incl. 11 new C2 tests). `node --check` on all changed backend files; `vite build` green; no schema change so no Prisma migration.
- Accessibility lead review of the referral UI: **PASS (AA)**.
- **NOT executed (require live env / credentials — not claimed as PASS):**
  - Referrals: real `/signup?ref=` capture, test subscription purchase, slab/reward math on real data, Super Admin Mark-Credited, duplicate-credit protection, tenant isolation — all need Super Admin + a live tenant.
  - Coupons: real Razorpay test-mode payment (capture→consume, failure→release), concurrent reservation on a real DB, delayed/duplicate webhooks, live C2 sweep.
  - Meet: **actual multi-user joining** of the same meeting and live WebSocket disconnect/reconnect delivery (needs two signed-in accounts + Google Meet).

## Production deployment status — 🔴 NO-GO for the Render backend deploy

**I did not deploy to Render** (no access) and deployment is unsafe as-is.

### Exact blocker (P0)
Per the operator-verified doc `BISPUN-RENDER-DBPUSH-P0-20261111.md`, the Render `bispun-api` **Build Command runs `npx prisma db push` against the production Neon DB on every deploy** (Auto-Deploy On Commit as of 2026-11-11). A backend deploy of `main` would therefore uncontrolledly sync prod schema to `schema.prisma`, which risks:
- **`Lead.leadNumber` regression** (schema `Int?` vs prod state) — directly threatens the stable Lead-numbering guarantee; and
- a **build failure on any data-loss-requiring diff → partial/mixed-version deploy** (frontend live against a stale/down backend).

This risk is **pre-existing** (not introduced by this release — this release changes no schema), but it gates the deploy that would make the coupon/Meet/LOW-2 backend fixes live.

### Required before any Render backend deploy (operator actions, need approval — I cannot do these)
1. Change the Render build command to **`npm install && npx prisma generate`** (remove `prisma db push`).
2. Run the §4 **read-only** schema checks in Neon `consulbuzz-production` and reconcile the `leadNumber` drift via the gated additive SQL (per the P0 doc), with a backup / Neon PITR point confirmed.
3. Confirm the currently-deployed Render commit and Vercel production-branch config.
4. Then deploy **backend first** (verify `/api/health`), frontend already auto-deploys.

### C2 worker / Razorpay production safety (verified safe)
The sweeper starts only when `DISABLE_BACKGROUND_WORKERS !== "true"`, makes **read-only** Razorpay calls (`orders.fetchPayments`) — never charges, refunds, or moves money — and only flips abandoned `RESERVED`→`RELEASED` (idempotent, never touches paid/unknown). Optional `COUPON_RESERVATION_TTL_MINUTES` (default 60).

## Bottom line
All verified Referrals, Coupons, C2 and Meet changes are **consolidated on `main` (`33659f1`)** — nothing stranded on a branch or in the worktree. The **urgent coupon fix and the Meet fix are backend** and will only take effect after the **gated Render backend deploy**, which is **NO-GO until the `prisma db push` build-command risk is removed and prod schema is reconciled** (operator + approval). The live payment and multi-user Meet scenarios remain to be verified in a real environment.
