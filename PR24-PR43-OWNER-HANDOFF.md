# Owner handoff — PR #24 (mobile perf) & PR #43 (notifications)

**Baseline:** `origin/main` = `54044dc`. Both PRs are **draft + conflicted**. Conflicts below were computed with `git merge-tree` against current main (read‑only; nothing was merged). Use **merge (not rebase)** so no force‑push is needed on these shared branches. Do **not** apply migration 0011 to Pond.

---

## PR #24 — Mobile performance & accessibility
Branch: `integration/mobile-perf-a11y-20261112` · 3 commits · 8 files.
Unique work to preserve: lazy‑loaded charts (`ChartSkeleton.jsx`), SR‑accessible chart data tables, dashboard lazy‑loading, `vite.config` chunking, `mobileUi.jsx` + `index.css` perf tweaks.

**Exact conflict (only one):**
- `src/modules/client/Dashboard.jsx` — **CONFLICT (content)**
- (`src/components/mobileUi.jsx`, `src/index.css` auto‑merge **cleanly** — no action.)

**Why:** PR #31 (already on main) restructured the mobile Dashboard; #24's lazy‑load/chart changes touch the same regions.

**Resolution strategy:** keep main's merged #31 Dashboard structure/native‑isolation as the base, and **re‑apply #24's lazy‑load + accessible‑chart‑table additions on top** (don't revert #31's layout; don't duplicate chart components already on main — reuse the existing `ChartSkeleton`/`DashboardCharts`).

**Commands (owner):**
```
cd <your worktree for this branch>   # or: git worktree add ../pr24 integration/mobile-perf-a11y-20261112
git fetch origin
git checkout integration/mobile-perf-a11y-20261112
git merge origin/main
# resolve: src/modules/client/Dashboard.jsx
git add src/modules/client/Dashboard.jsx && git commit
```
**Tests:** `npm run build`, `npm test`, Capacitor sync + Android build, and a mobile smoke (Dashboard charts load, no horizontal overflow). Accessibility review for the changed Dashboard/chart UI.
**Gates → merge:** `gh pr ready 24` → required CI green (Vercel + conflict‑and‑syntax) → owner approval → `gh pr merge 24 --merge --delete-branch`.

---

## PR #43 — Notifications & deep‑links
Branch: `integration/notification-deeplinks-consolidated` · 9 commits · 22 files.
Unique work: notification deep‑links, calendar/Help & Support/coupon notifications, `mobilePush`, `notificationTarget`, backend notification routes; **migration 0011** (`PROD_DEPLOY_RUNBOOK_PR43.md`).

**Exact conflicts (4):**
- `src/ClientPortal.jsx`
- `src/modules/client/CalendarModal.jsx`
- `src/modules/client/Dashboard.jsx`
- `src/modules/client/Help.jsx`
- (overlaps on `mobileUi.jsx` / `ChartSkeleton.jsx` / `index.css` auto‑merge **cleanly**.)

**Why:** #31 (mobile shell/Dashboard) and #24 both touch these; reconcile notification deep‑link wiring with main's current `ClientPortal`/nav + Dashboard.

**Resolution strategy:** base on main's merged shell; layer #43's deep‑link + notification wiring. Preserve existing unread badges, sound behavior, permission filtering and Android push. **Coordinate with #24 first** (both edit `Dashboard.jsx`) — merge #24 before #43 to resolve that file once.

**Migration 0011 (production‑gated):**
- Do **not** apply 0011 to Pond or enable 0011‑dependent code without: (a) separate production authorization, (b) a read‑only Pond schema‑compatibility check, (c) an explicit rollout sequence (apply additive SQL → deploy backend → verify), mirroring the 0007/0008a/0010 pattern. The code must **degrade safely** if 0011 isn't yet applied (guarded), or the merge must be sequenced with the migration.

**Commands (owner):**
```
cd <your worktree for this branch>
git fetch origin
git checkout integration/notification-deeplinks-consolidated
git merge origin/main
# resolve: src/ClientPortal.jsx, src/modules/client/CalendarModal.jsx, src/modules/client/Dashboard.jsx, src/modules/client/Help.jsx
git add -A && git commit
```
**Tests:** `npm run build`, `npm test`, Android push/deep‑link/unread/sound checks, permission filtering, backend notification route tests. Accessibility review for changed notification UI. **Read‑only** 0011 schema compatibility check (no prod write).
**Gates → merge:** `gh pr ready 43` → CI green → owner approval → **0011 production authorization + rollout plan confirmed** → `gh pr merge 43 --merge --delete-branch`. Merge **only when the deployment is schema‑safe**.

---

## Post‑merge cleanup (after each merges)
`git fetch origin --prune`; confirm the unique work is on main; CI/regression green; the merged PR branch auto‑deletes with `--delete-branch`. Preserve active worktrees (`feat/referral-signup-lifecycle`, `mobile/stage0-6-deeplinks-a11y`, `fix/counselling-student-alt-phone`, etc.) until their owners retire them. No force‑push; no new branches.

## Preserve (unchanged by this work)
Bispun / Woways / Student Mentor / tenant branding; Settings/Permissions; **My Store hidden**; Referrals / Coupons / Meet / Counselling fixes; Web/Backend/Android functionality.
