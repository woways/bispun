# Bispun CRM — Mobile Performance Phase 1: WIP Checkpoint & Handover

**Status: PAUSED at a safe checkpoint. Phase 1 is NOT complete and NOT verified. Do not merge.**
Prepared so another developer can work sequentially without Git conflicts or feature loss.

## Checkpoint facts
- **Branch:** `feat/mobile-ui-optimization`
- **Commit:** `f5d235de4143e01db3725c2c4cb5f22a894e491a` (`f5d235d`) — `wip(mobile-perf): Phase 1 bounded module keep-alive — CHECKPOINT, not complete`
- **Parent (unchanged base):** `f201742` (= `origin/main`)
- **Remote push:** ✅ **succeeded** — created `origin/feat/mobile-ui-optimization` at `f5d235d` (new branch; no prior remote existed, so no divergence; **not** a force-push).
- **Build:** ✅ **PASS** (`vite build` green; only the pre-existing `charts` chunk-size warning).
- **Modified files (committed):** `src/ClientPortal.jsx` only (+208 / −24). No other tracked files changed.
- **Not staged / preserved in working tree:** 50 untracked files (all the `MOBILE-*.md` reports incl. `MOBILE-UX-PERFORMANCE-MASTER-AUDIT.md`, `android/local.properties.bak`, `docs/DEVELOPER_SETUP.md`, `scripts/provisionQaTestCompany.js`). None were staged or committed.
- **No** API / DB / Prisma schema / desktop-layout changes. **No** secrets or `.env` files staged. Developer 2's branches/worktrees untouched.

## What Phase 1 work is COMPLETE (written + builds)
All in `src/ClientPortal.jsx`:
1. Module renderer parameterized: `renderModule()` → `renderModuleContent(moduleKey)`.
2. **Bounded keep-alive** (LRU, max 5) for collision-safe modules — `dashboard, lead-store, revenue, admissions, analytics, walkins, counselling`. Only the active module is visible; inactive kept modules use the `hidden` attribute (inert: out of layout, tab order, a11y tree).
3. **No refetch on quick revisit** + preserved in-module state (filters/pagination/inputs) and page scroll (per-module scroll save/restore).
4. **TTL background revalidation** (90s): returning after idle remounts that module for fresh data.
5. Per-module **ErrorBoundary + Suspense**; shell-level **aria-live** module announcement; **focus-loss recovery**; **identity-scoped reset** (clears kept modules if user/company changes → no cross-user/role cache leak).
6. Forms-heavy / id-bearing / transient modules (`settings, help, chats, utm-leads, my-store, my-referrals, goals-and-targets, profile`) deliberately keep single-mount behaviour.

## What REMAINS incomplete (do NOT mark Phase 1 done)
- **Functional verification not done:** runtime click-through of all modules, forms/state preservation, Android hardware-back, session/expiry behaviour.
- **Accessibility review of the implementation not done** (guidance was gathered; the post-implementation review was not run).
- **Role testing not done:** Client Admin / Manager / Employee.
- **Before/after measurement not re-run** on the finished change.
- **Baseline already captured (for comparison later):** on mobile, revisiting Lead Store re-fetched **all 6 of its datasets** every time (spinner). Target after Phase 1: ~0 refetch on quick revisit.
- Keep-alive currently excludes the Admissions market variants (`domestic-*`/`international-*`) and `utm-leads` (has one static id `saved-utm-links` to migrate to `useId` before it can be kept alive).

## Resume commands (after the other developer finishes)
```bash
# 1. Get back on the branch and sync
cd /s/Bispun
git checkout feat/mobile-ui-optimization
git fetch origin
git status            # confirm clean / your WIP commit f5d235d present

# 2. If main advanced meanwhile, bring it in WITHOUT losing features (merge, don't rebase shared history)
git merge origin/main   # resolve conflicts preserving all features; or: git log origin/main..HEAD

# 3. Reinstall deps only if package-lock changed upstream
npm install

# 4. Start dev servers to resume verification
#    (backend :4000, vite :5173)
#    backend:
DISABLE_BACKGROUND_WORKERS=true npm run server:prod
#    frontend (separate shell):
npm run dev

# 5. Continue Phase 1: run build + tests + accessibility review, then
#    verify all modules/roles/back-nav, then re-measure before/after.
npm run build
npm test
```

## Guardrails for whoever continues
Do not merge to main, deploy, open a PR for this incomplete work, force-push, or reset/overwrite files. Keep every existing CRM feature (role permissions, Lead Store, Smart Nurture, Dial & Track, Admissions, Finance, Referrals, notifications, OTP verification, Analytics). Desktop appearance/functionality unchanged.
