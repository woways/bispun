# Bispun CRM — F5 + P2 + P3 Results & Consolidated GO/NO-GO

**Date:** 2026-11-14 · **Branch:** `integration/bispun-final-pdf-review` (worktree `S:\Bispun-final-review`)
**Env:** isolated local `bispun_final` · backend :4200 · frontend :5178 (full stack restarted this session after the prior session ended). **No push / no merge-to-main / no deploy.** Synthetic data only; no external messaging/payment.
**Commits this round (local, isolated):** P2 `e38a9ea`, F5 `6723f36` (+ docs). Deep-link work stays separate & unmerged (`integration/notif-deeplinks-consolidated`).

## Priority 1 — F5 accessibility focus-trap — DONE ✅
- **Change:** added a Tab/Shift+Tab focus-trap to the shared hook `src/lib/useOverlayDismiss.js` (commit `6723f36`), mirroring the proven in-repo `useModalA11y` trap. Auto-covers CalendarModal (+ nested editor/connect), CallCenterModal, NurtureCenter, ChatPanel dialogs. No component edits (no Track B collision); no `inert`-on-shell / no ChatPanel portaling (risky refactor avoided).
- **accessibility-lead:** SAFE to commit, no fix needed. Correct wrap logic; nested overlays confirmed one-trap-at-a-time (existing mutual-exclusion gating); typing/Escape/focus-restore unaffected.
- **Verified live (NurtureCenter):** Tab wraps last→first ✅, Shift+Tab first→last ✅, focus pulled back in from the sidebar ✅. Unit **106/106**, build **green**.
- **Known gap (Track B's lane, NOT covered):** Help `TicketDetailsModal` uses neither hook → no trap/Escape. Flagged to Track B (bare-module-modal lane).

## Priority 2 — Lead Store modal overlap (~1024px) — DONE ✅
- **Change:** portaled the 3 Lead Store modals (Add Lead / Import / Edit) to `document.body` (commit `e38a9ea`). Root cause = transformed-ancestor containing block (not z-index). No className/z change.
- **accessibility-lead:** reviewed/approved the portal approach.
- **Verified live:** 1024px (the break) → modal now centers over the full viewport, backdrop covers the sidebar ✅; 390px mobile → full-width, correct ✅. (1440 = same viewport-centered behavior.) Unit + build green.

## Priority 3 — browser QA (isolated env, synthetic data)
| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | CSV import + duplicate detection | **PARTIAL** | Duplicate detection **API PASS** (manual create w/ existing phone → 409). CSV/XLSX **file upload NOT TESTED** (headless file-picker not feasible) → **manual**. |
| 2 | UTM link generation + persistence | **API PASS** | POST `/api/client/leads/utm/links` → 201; read-back persisted campaign + **Influencer Name "QA Influencer"** + medium Other + source. |
| 3 | Admissions Stream → College + custom stream | **NOT TESTED** | Overall view is read-only; needs the lead→admission convert/domestic form → **manual**. (Stream dropdown + "Other" present in code.) |
| 4 | Analytics Year Comparison | **LIVE PASS** | Year Comparison tab: 2026 vs selectable year (2025–2019); parameter table (Leads 31 / Admissions 10 / Conversion 32.3% / revenues) matches KPIs; monthly comparison charts. |
| 5 | Profile Light/Dark/System theme | **CODE VERIFIED** | Implemented in Settings.jsx/uiPreferences.js; live toggle **not exercised** → **manual**. |
| 6 | Billing Order History + receipt downloads | **BLOCKED** | Needs real billing/subscription records; none synthetic. Order-History-above-Current-Subscription = code-verified. |
| 7 | Help ticket create/update/resolve | **PARTIAL** | Create **API PASS** (earlier). Update/resolve need the admin portal → **manual**. |
| 8 | Manager & Employee permissions | **API PASS** | Lead-store visibility scoped by role (Client Admin 17, Manager 0, Employee 0 — all unassigned); server-side `getLeadVisibilityScope`. |

**Regression:** unit **106/106**, production build **green** after both fixes. No regressions observed.

## Consolidated GO / NO-GO
- **Web (this round):** F5 + P2 **GO** on the isolated integration line (verified, a11y-reviewed, tests+build green). **Not pushed.**
- **🔴 Release gate (standing policy):** pushing to `main` = **Vercel PRODUCTION deploy**; main is branch-protected → requires a **PR + explicit deploy authorization**. Also `main` is **19 commits ahead** of this integration branch → reconcile before integrating. **NO-GO to push without your authorization + reconciliation.**
- **🔴 Android:** entirely unverified (no device; FCM `AUTHENTICATION_FAILED`). **NO-GO for mobile.**
- **🟡 Notification deep-links:** F1/F2 fixed + verified on the separate consolidated branch; **not merged** (awaiting your merge/line-reconciliation decision).
- **🔵 Business decisions (§20):** IMDM, college dataset, course/source master lists, Lead-ID scope, profit formula, appearance system — still open.

## Remaining tasks required for release (prioritized)
1. **Authorize + execute the `main` integration** (PR + prod-deploy approval), reconciling the 19 commits `main` is ahead — fixes land in production.
2. **Apply pending prod migrations** (counselling `0010`, lead-number `0005P`) so §2/§7 work on production.
3. **Android pass** on a real device (fix FCM token first) for §1.7/§16/§19.10 + D-07.
4. **Resolve §20 business decisions** (unblocks §3.12 IMDM, §6 college, §9 profit).
5. **Finish the manual P3 items:** CSV file import, Stream→College, theme toggle, billing receipts, Help update/resolve.
6. **Broader bare-module-modal a11y** (Admissions/Settings/Help) — Track B's lane, pending their user's OK.
7. Merge the notification deep-links (consolidated branch) once you approve.

## Cross-track coordination (clean, no file overlap)
Track A (me): `useOverlayDismiss` Tab-trap (F5) + Lead Store modals. Track B: bare module modals (Admissions/Settings/Help) via `useModalA11y` + their deep-link candidate. F5 diff shared with Track B for composition with their PR #31. Nothing merged/pushed on either side.

## Synthetic test data left in `bispun_final` (disposable)
"QA UTM Campaign" link, "QA Persist Lead" (LD030) + earlier LD029, DL Verify event/ticket, and assorted QA notifications. Harmless; delete from the UI if desired.
