# Bispun CRM — Git & Branch Guide (for the team & management)

**Updated:** 2026-11-09 · Plain-English guide to how our code branches work and what each one is for.

---

## The short version
- **`main`** is the single source of truth — the integrated, reviewed code. Everything the product is built from lives here.
- Each new piece of work gets its **own short-lived branch**, goes through a **Pull Request (PR)** for review, and is **merged into `main`** when it passes checks and is approved.
- After a branch is merged, we **delete it** (once it's safe) so the list stays short and clear.
- **Pushing to `main` can trigger a Production deployment** (Vercel). So a merge to `main` is also a release decision — it needs deployment approval, not just code approval.

---

## Current branch status (one table — keep this current)

| Branch | Latest | What it is | Status |
|---|---|---|---|
| `main` | `c618261` | Integrated baseline (live) | ✅ Protected — never delete |
| `feat/bispun-audit-fixes-mobile-completion` | `7edee75` | Audit fixes (security, notifications, dashboard, Users&Roles migration) | 🔵 **PR #13 open — technically ready; release ON HOLD** (awaiting owner deploy approval) |
| `release/android-signing-prep` | `47396dd` | Android release signing config | 🟣 On hold (worktree) — needed for Android release |
| `feat/referrals-integration` | `844c352` | Referrals work (merged PR #6) | 🟣 In use (worktree) |
| `integration/mui-yc` | `70b8209` | Older integration work | 🟣 In use (worktree) |
| `feat/mobile-ui-optimization` | `32f58bc` | Mobile UI work | 🟡 On hold — has 1 local commit not yet pushed |
| `feat/client-admin-password-reset` | `0084f2d` | Admin password-reset (dev) | 🟡 On hold — unique local work |
| `hotfix/prod-login-coldstart` | `c55388f` | Login cold-start hotfix (merged PR #5) | 🟢 Retained for rollback |
| `feat/admissions-notifications-calendar` (remote) | — | Admissions/notifications/calendar (merged PR #9) | 🗑️ **Safe to delete** (awaiting confirmation) |
| `backup/main-pre-merge-20261107` + tag `backup/pre-main-merge-20261109` | — | Safety snapshots | 🔒 Backups — keep |

Legend: ✅ protected · 🔵 active/under review · 🟢 keep (rollback) · 🟡 keep (unique work) · 🟣 keep (worktree) · 🗑️ deletable after sign-off · 🔒 backup.

---

## What each thing means
- **main** — the finished, reviewed product code. Deployments come from here.
- **Active branch** — the work happening right now (currently the audit-fixes branch, in PR #13).
- **Feature under development** — audit fixes + Users & Roles migration (PR #13).
- **PR under review** — **#13** (https://github.com/woways/bispun/pull/13).
- **Ready to merge** — PR #13, *once* Production-deploy is approved and Android gates are accepted/separated.
- **On hold** — branches with work not finished or not yet needed (mobile-ui-optimization, client-admin-password-reset).
- **Deployed releases** — `main` = `c618261`. PR #13 is **not** deployed yet.

---

## How we work (the workflow)
1. **New request** → create a short branch off the latest `main` (e.g. `feat/<short-name>`).
2. **Build it** → small, focused commits.
3. **Test it** → `npm test` (all suites) + `npm run build` must pass.
4. **Open a PR** → into `main`; get a review.
5. **Merge when safe** → all checks pass, review approved, and (for `main`) deployment approved.
6. **Verify the deploy** → confirm Production is healthy.
7. **Delete the branch** → once merged and safe.
8. **Start the next feature** from the fresh `main`.

### Simple rules
- Keep branches **short-lived** — don't let one branch collect weeks of unrelated work.
- **Fetch `main` often** and merge it into your branch to avoid conflicts.
- **Never force-push** shared branches; never delete someone else's branch or a worktree branch.
- A **merge to `main` is a release** — treat deployment and database compatibility as part of the decision.
- If a branch has unique work or an open PR, **keep it**.

---

## When to delete a branch (safety checklist)
Delete only when **all** are true: fully merged into `main` · no unique commits · no open PR · not attached to a worktree · no one actively using it · not a needed backup/rollback/release branch. If any is uncertain → **keep it and ask**.

---

## 2026-11-10 consolidation (see BISPUN-FINAL-CONSOLIDATION-REPORT-20261110.md)
Release candidate: **`rc/consolidated-release-20261110`** (`3c8ed47`+docs) = `origin/main`
`29283ec` + PR#13 + fail-closed Android signing. Pushed to origin.
- **Main merge HELD** at the production-deployment gate (push to `main` auto-deploys Vercel +
  Render). `main` unchanged at `29283ec`.
- **Branch cleanup HELD** (gated on merge). No branch deleted. Recovery refs pushed:
  `backup/pre-consolidation/*-20261110` tags + `feat/client-admin-password-reset` (was local-only).
- Unique un-merged work preserved & flagged: `feat/client-admin-password-reset` (`0084f2d`,
  SuperAdmin password-reset, dev-only) — decision pending on inclusion.
