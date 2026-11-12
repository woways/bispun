# Bispun CRM — Phase 1 Baseline Verification (Repository, Branches & Deployment)

**Date:** 2026-11-12
**Verifier:** independent QA session (worktree `S:\Bispun-qa`, branch `qa-fix/e2e-20261112`)
**Method:** read-only `git fetch --all` + branch/commit analysis; public HTTPS checks against production; cited prior operator-evidence docs where I lack authorized access.
**Nothing was pushed, merged, deployed, migrated, reset, or deleted.**

---

## 1. Repository state (verified)

| Item | Value |
|---|---|
| Remote | `github.com/woways/bispun` (origin) |
| **origin/main tip** | **`8dff6d1`** — "Merge PR #22 … help-dashboard-changes" (2026-11-12 09:55 +0530, AbhignaReddy2210) |
| Previous main (QA baseline) | `59a9908` — "Merge PR #21 … rc/consolidated-release" (2026-11-11 19:50) |
| This QA worktree HEAD | `3588725` (my QA test commit) on `qa-fix/e2e-20261112`, cut from `59a9908` |

> **Finding B-1:** main **advanced past the QA baseline**. The prior QA report's baseline `59a9908` is no longer main's tip; `origin/main` is now `8dff6d1` (adds **PR #22**: Help & Support drill-downs §12 + dashboard view renames §14.4–14.7, commit `b601421`). Re-verification of §12 and §14 must target `8dff6d1`, not `59a9908`.

## 2. Branch merge-status vs `origin/main` (verified)

| Branch | Tip | In main? | Unique commit(s) | Relevance |
|---|---|---|---|---|
| `feat/referrals-lifecycle` | `ebc94a5` | ✅ MERGED | 0 | §11 4-stage lifecycle backend+admin (commit `c714a7d` **is in main**) |
| `origin/feat/referrals-integration` | `844c352` | ✅ MERGED | 0 | referrals integration |
| `origin/feat/bispun-audit-fixes-mobile-completion` | `e5e05d6` | ✅ MERGED | 0 | audit fixes / mobile |
| `origin/feat/mobile-ui-optimization` | `213f21f` | ✅ MERGED | 0 | mobile UI |
| **`origin/feat/referral-signup-lifecycle`** | `fa0518f` | ❌ **NOT merged** | **1** (`fa0518f`) | **§11.3 signup ?ref capture + `src/lib/referralLink.js` — NOT in main** |
| `origin/finance-changes` | `53ccc29` | ❌ not merged (but see note) | 1 (`53ccc29`) | **No missing work** — branch is BEHIND main; its `Revenue.jsx` is byte-identical to main (`git diff` empty). §9 finance work is fully in main. |
| **`origin/feat/client-admin-password-reset`** | `0084f2d` | ❌ **NOT merged** | **1** (`0084f2d`) | Super-Admin→Client-Admin password reset (not a PDF item) |
| `qa-fix/e2e-20261112` | `3588725` | ❌ NOT merged | 1 | this QA session's test suite (intended to stay unmerged) |

> **Finding B-2 (unmerged developer work — do NOT lose):** after content verification, only **one** branch carries functionally-missing work relevant to the PDF:
> - **`origin/feat/referral-signup-lifecycle` (`fa0518f`): REAL missing work.** The **referral signup attribution** — auto `?ref` capture on `/signup` via `src/lib/referralLink.js` (`readRefFromSearch`/`buildReferralSignupUrl`) and the signup→Referred wiring. **Confirmed absent from main** (`git cat-file origin/main:src/lib/referralLink.js` → does not exist; present on this branch). Main's `SignupPage.jsx` has only a **manual "Enter referrer code" field**, not automatic link attribution. This is the piece that makes **§11.3** ("referred person appears under Referred when they sign up through the link") work end-to-end. **→ §11.3 is PARTIAL in main.**
> - `origin/finance-changes` (`53ccc29`): **NOT missing work.** The branch is **behind** main; its `Revenue.jsx` is byte-identical to main and the full §9 finance drill-down work (`d4d8a59`) is already merged. (Earlier draft of this report overstated this; corrected.)
> - `origin/feat/client-admin-password-reset` (`0084f2d`): admin password-reset endpoint + test — **outside the 21 PDF sections** (a dev convenience), not a release gap.
>
> No branch was deleted; any merge to main must be a deliberate, separately-authorized action.

## 3. Migrations (verified)

- There is **no `prisma/migrations/` directory** in `origin/main` → **no Prisma managed migration history**. All schema SQL lives in `prisma/pending-migrations/*.sql` as **manual** scripts.
- Present in `origin/main`: `0001`–`0009` (incl. `0005_add_stable_lead_number.sql`, `0005P_prod_stable_lead_number_nullable.sql`, `0007_add_referral_credit_audit.sql`, `0008_add_account_deletion_request.sql`, `0009_add_admission_folder_locked.sql`) + `APPLY_prod_reconciliation_20261111.sql`. `0007_DRAFT_add_calendar_event_visibility.sql` is a DRAFT/HOLD.
- **Schema sync mechanism = `prisma db push`** (`package.json: "prisma:push": "prisma db push"`), which the Render build runs on deploy (see §4). **`db push` applies columns/indexes from `schema.prisma` but NEVER the trigger/function/backfill in `0005*`** — those are not expressible in `schema.prisma`.

> **Finding B-3 (migration risk):** migration `0007` (referral credit audit) and `0005` (lead-number trigger) are **not part of any automated migration runner**. `0007`'s columns ARE in `schema.prisma` (so `db push` would add them), but the lead-number **trigger/function is not** — it must be applied by hand. See the Production Audit for prod state.

## 4. Deployment topology (verified where public; otherwise cited)

| Tier | Platform | Evidence |
|---|---|---|
| **Frontend** | **Vercel** | `bispun.com` → `HTTP 200`, `Server: Vercel`, `X-Vercel-Id: bom1::…` (Mumbai). Single bundle `/assets/index-CPawhHV9.js` + `/assets/index-CfDGa3Qo.css`. `vercel.json` in main (SPA rewrite). |
| **Backend** | **Render** `consulbuzz-api.onrender.com` | API base baked into the prod bundle; `/api/health` → `200 {"success":true,"database":"connected"}`. Per prior operator doc (`BISPUN-RENDER-DBPUSH-P0-…md`): service `bispun-api`, branch `main`, Auto-Deploy On Commit, **Build Command `npm install && npx prisma generate && npx prisma db push`**, Start `npm run server`. |
| **Database** | **Neon** `consulbuzz-production` / branch `production` / db `neondb` | Per prior operator-verified read-only SQL (cited; I have no prod DB access). |

> **Finding B-4 (frontend/backend VERSION MISMATCH):** independently verified — see the Production Audit §2. The deployed **backend** exposes the new feature routes (401, i.e. present); the deployed **frontend** bundle is **missing** the PDF UI strings (referral lifecycle, Smart Nurture, renamed labels…). The Vercel frontend is a **stale build predating the current main**, while Render auto-deploys main to the backend. This is a live production inconsistency.

## 5. Access scope of this verification

- **Available:** full local git; public HTTPS to `bispun.com` and `consulbuzz-api.onrender.com` (GET + route-existence probes only).
- **NOT available:** authenticated production login, Render/Vercel dashboards, Neon prod SQL. Items needing those are marked **BLOCKED / cited-prior-evidence** in the Production Audit — never asserted as my own verification.

## 6. Baseline conclusions

1. `origin/main = 8dff6d1` is the integration target; it is **ahead** of the QA baseline `59a9908`.
2. **Backend production = recent main** (routes present, health OK).
3. **Frontend production = stale** (missing current main's UI) → **mismatch**; a Vercel rebuild/redeploy from current main is required.
4. **Unmerged work** exists for §11 signup attribution and §9 finance drill-down centering — must be merged deliberately, not lost.
5. **Prod schema is behind** (0004→0005 gap) and the deploy mechanism (`db push`) cannot complete the stable-Lead-ID feature — see Production Audit + Phase 4.
