# Bispun CRM — Android Mobile UI & Functionality Audit

**Branch:** `feat/mobile-ui-optimization` · **Scope:** client portal (the CRM a client/agency user signs into)
**Method:** read-only code audit of every client module + shell, cross-checked against the Clienter reference frames.
**Rule applied throughout:** desktop (≥ `lg` / 1024px) stays byte-for-byte unchanged; all fixes are mobile-only (`<lg`), using the shared primitives in `src/components/mobileUi.jsx` (`BottomSheet`, `MobileRecordCard`, `MobileActionMenu`, `MobileFilterSheet`, `MobileBottomNav`) and the proven pattern already live in `Dashboard.jsx` (desktop `hidden lg:block` table **+** parallel `lg:hidden` card list).

> Live-on-device results (emulator/APK) are **not** included here — this is a code audit. Phase 6/7 testing happens after each batch, on the running dev backend.

---

## 1. Executive summary

The shell (Stage 1 + B1) and the Dashboard (B2) are in good shape. The rest of the CRM was **never mobile-adapted**: outside Dashboard, Help, and the referral screens, **no module uses the shared mobile components**, and **every data table falls back only to horizontal scroll** — so on a phone, amounts and row actions sit off-screen. There are also **two genuine functionality bugs** (not just cosmetics): some Admissions sub-screens can't be reached on mobile, and the Chat composer hides behind the keyboard.

**Severity tally**
- 🔴 **Functionality/parity bugs (fix first):** Admissions sub-screens unreachable on mobile; Chat composer behind keyboard; top safe-area (status bar) overlap.
- 🟠 **High (tables with no card fallback):** Lead Store, UTM Leads (×3), Walk-ins, Admissions (×2), Revenue (×2), Settings (×4), Analytics (×2), Goals (×2), Revenue Slabs (×2).
- 🟡 **Medium:** a few modals still centered instead of bottom-sheet; tab bars that overflow; CalendarModal week grid squashed.
- 🟢 **Low / already good:** Login, Counselling, My Store, My Referrals, Referral Home, Notifications, Help ticket list.

---

## 2. What already works (do not redo)

| Area | State |
|---|---|
| **Shell / nav (Stage 1, B1)** | Mobile top bar (brand + Bell + profile), 5-item bottom nav (Dashboard / Leads / Admissions / Finance / More), grouped More sheet (Work / Insights / Grow / Account), Android back-stack + Escape, `env(safe-area-inset-bottom)` on nav + main. Z-index stack consistent. |
| **Dashboard (B2)** | Compact 2-col KPI cards, responsive My Work / Business Pulse grids, scaled greeting, Recent Admissions table→card split, bottom-sheet action/event modals. Charts all `ResponsiveContainer` (no overflow). |
| **Login** | Fully responsive 320–412px; brand panel `hidden lg:flex`; fluid inputs; clean error block. No change needed. |
| **Counselling** | Native card list, responsive, bottom-sheet modal. No table. |
| **My Store / My Referrals / Referral Home** | Card-first, responsive grids, bottom-sheet modal. No change needed. |
| **Notifications** | Desktop dropdown **and** a mobile `BottomSheet` already wired to the same handlers. |
| **Help – ticket list** | The correct reference pattern already: desktop `<Table>` + `sm:hidden` card list with 44px targets, loading/error/empty states. |

---

## 3. 🔴 Functionality / parity bugs

1. **Admissions sub-screens unreachable on mobile.** `domestic-walkins`, `domestic-counselling`, `domestic-admissions`, `international-*` are only entered through the **desktop sidebar** (hidden `<lg`). Bottom-nav "Admissions" opens the overview only; the market tab strip appears *after* you're already inside one of those modules. On mobile these depend entirely on in-page links inside the Admissions overview — if those links aren't there, the screens are dead. *(Shell — `ClientPortal.jsx`.)*
2. **Chat composer behind the keyboard.** `ChatPanel.jsx:1317` sizes the panel with static `h-[calc(100vh-104px)]` and has **no `visualViewport` listener and no `env(safe-area-inset-*)`**. When the Android keyboard opens, `100vh` doesn't shrink, so the input is pushed below the fold / behind the keyboard, and the `104px` magic offset doesn't match the real mobile header+nav, risking overlap with the bottom nav.
3. **Top safe-area not padded.** Mobile top bar (`ClientPortal.jsx:4034`, `fixed top-0 h-14`) has no `env(safe-area-inset-top)`; under edge-to-edge Android/notch, brand + Bell + profile can sit under the status bar. (Bottom inset is already handled.)
4. **Dead mobile-drawer code.** `mobileSidebarOpen` state + its back-interceptor exist, but the `<aside>` is `hidden lg:block`, so the drawer never renders on mobile. Harmless but should be removed for clarity.

---

## 4. 🟠 Tables with no mobile card fallback (the dominant issue)

The shared `Table` (`src/components/ui.jsx:381`) is `overflow-x-auto` + `<table>` only — **no card fallback** — so every screen that uses it inherits horizontal scroll on mobile. The fix is **per-usage** (wrap existing table in `hidden lg:block`, add a `lg:hidden` `MobileRecordCard` list) — **not** editing shared `Table`, which would change desktop.

| Module | Table(s) | Cols | Notes |
|---|---|---|---|
| **Lead Store** (worst) | main leads grid + "Imported batches" | ~12 / 10 | Sticky columns + `w-max`, designed for desktop scroll. Also 2 centered modals (not bottom-sheet) + a 4-button header row with no wrap. |
| **UTM Leads** | Campaign perf / Internal leads / UTM details | 10 / 9 / 9 | Three stacked wide tables. Modals already bottom-sheet. |
| **Admissions** | main admissions (via shared `Table`) + Overall | 13 / 6 | Amounts + row actions scroll off-screen. Modals already bottom-sheet. |
| **Revenue** | Expense Claims + Incentives | 8 / 6 | Financial tables. Tab bar overflows; `IncentiveModal` centered not bottom-sheet. |
| **Settings** | Users / Lead Sources / Custom Fields / Activity Log | up to 6 | Zero shared-component use; tab bar wraps to 3–4 rows. |
| **Analytics** | Comparison (`min-w-[600px]`) + Top Campaigns | — | Charts fine; tables + `h-8` tabs are the gap. |
| **Goals & Targets** | editable month×week matrix (+ company-wide matrix in `GoalsAndTargetsAll`) | very wide | Tiny `text-[11px]`, `w-10/w-12` editable inputs. Hardest to card-ify — may keep scroll but improve ergonomics. |
| **Revenue Slabs** | College Revenue (10) + Employee Incentives (6) | 10 / 6 | Edit modal centered not bottom-sheet. |
| **Walk-ins** | walk-ins (via shared `Table`) | 9 | Modal already bottom-sheet. |

**Financial-calculation sites flagged DO-NOT-TOUCH** (layout only): `money()`/`axisMoney()` formatters; `expenseStats` aggregation (Revenue); amount coercion in admission/expense/incentive submits; referral redemption rule (`amount ≤ availableToRedeem`); conversion-rate math; slab rates. We change presentation around these, never the math.

---

## 5. 🟡 Medium

- **Modals still centered (not mobile bottom-sheet):** Lead Store `IndividualLeadModal` + `UploadDatasetModal`; Revenue `IncentiveModal`; Revenue Slabs `EditSlabsModal`; Help `NewTicketModal` (also switches at `sm`, not `lg`).
- **Tab bars that overflow / eat vertical space:** Revenue 5-tab `inline-flex` (overflows); Settings 8 tabs wrap to 3–4 rows (no single-row scroller); Analytics `h-8` tabs.
- **CalendarModal week grid** squashes `48px repeat(7,1fr)` with no mobile day-mode and no horizontal scroll — ~47px/day at 375px. Agenda + event editor are fine; the time grid needs a phone mode (e.g. force "day", or make it scrollable).
- **Breakpoint inconsistency:** some fallbacks switch at `sm` (640px), others at `lg` (1024px). The brief defines mobile as `<lg`; the 640–1023px tablet band currently gets desktop tables in some places. We should standardize on `lg`.

---

## 6. 🟢 Cross-cutting accessibility

- **Touch targets:** per-row icon buttons are **32px (`h-8 w-8`)** almost everywhere; many tabs/selects are `h-9` (36px). Target ≥ 44px on mobile (the mobileUi pattern already uses `h-11` / `min-h-[48px]`). Bundle this into each batch rather than a separate pass.
- **Chat bubble contrast:** `mine` (indigo-50) vs others (neutral-100) are both very light with identical dark text — distinguishable mainly by alignment/tail. Worth a stronger cue.
- Every batch gets an **accessibility-lead review before code is written** (project rule) and after.

---

## 7. Proposed implementation batches (each: a11y review → code → tests + prod build → responsive check at 360/390/768/1280 → **stop for approval before commit**)

| # | Batch | Why here | Risk |
|---|---|---|---|
| **B3** | **Shell parity + safe-area** — make Admissions sub-screens reachable on mobile (More sheet / in-page nav), add `env(safe-area-inset-top)`, remove dead drawer code | Fixes real parity bug #1,#3; small; unblocks Admissions testing | Low |
| **B4** | **Lead Store** — table→card, row actions → `MobileActionMenu`, 2 modals → bottom-sheet, header wrap, filters → `MobileFilterSheet` | Highest-traffic screen, worst offender | Med (big file) |
| **B5** | **UTM Leads + Walk-ins** — 3+1 tables → cards (Counselling already done) | Rest of leads cluster | Med |
| **B6** | **Admissions** — 13-col + Overall tables → cards, row actions | Core module; needs B3 first | Med |
| **B7** | **Finance (Revenue + Revenue Slabs)** — tables → cards, tab bar, modals → bottom-sheet (math untouched) | Finance parity | Med |
| **B8** | **Insights (Analytics + Goals + Goals-All)** — tables, tab targets; Goals matrix ergonomics | Analytics parity | Med |
| **B9** | **Settings** — 4 tables → cards, tab scroller | Admin-heavy, lower daily use | Low–Med |
| **B10** | **Chat composer** — `visualViewport` keyboard inset + height/nav fix + bubble contrast | Real bug #2; isolated but delicate | Med |
| **B11** | **CalendarModal** — mobile day-mode / scrollable week grid | Last; self-contained | Med |

Dashboard (B2) is essentially complete; remaining Dashboard nits (Team Performance stat cramping, 32px calendar cells) fold into B8/B6 polish.

---

## 8. Git / deployment safety (unchanged)

Work stays on `feat/mobile-ui-optimization`; uncommitted B2 `Dashboard.jsx` and `android/local.properties.bak` preserved; no commits/pushes/merges/deploys without explicit approval; no auth/schema/backend-logic/financial-math/production-config changes; Marketing Website and Developer 2's branch untouched.

---

## 9. B3 — DONE (code), on-device verification pending

**B2 note:** Dashboard vertical scrolling was verified working on the live emulator (scrolls over cards, empty areas, and charts; bottom nav doesn't cover content). No scroll bug in current code — no fix applied.

**B3 changes (mobile-only; desktop unchanged by construction):**
- **Admissions nav parity** — `ClientPortal.jsx`: added an "Admissions" group to the mobile More sheet with **Domestic** (→ `domestic-admissions`) and **International** (→ `international-admissions`), mirroring the desktop sidebar; the existing in-page tab strip (already mobile-usable) reaches Walk-ins/Counselling/Admissions Done. Permission-gated by `hasModulePermission` (canManageAdmissions); no new routes. a11y: each button carries `aria-label` "Domestic admissions"/"International admissions" (WCAG 2.4.6 / 2.5.3); group placed after Work so initial focus is unchanged.
- **Android safe-area** — `index.html` viewport gains `viewport-fit=cover` (no zoom disabled); mobile top bar gets `paddingTop: env(safe-area-inset-top)` with a fixed 56px inner row; `<main>` top offset → `calc(56px + env(safe-area-inset-top))` and min-height adjusted to match. Bottom inset already handled. Top-bar Bell/profile bumped to 44px (ergonomics).
- **Dead-drawer removal** — removed the permanently-false `mobileSidebarOpen` state, its two effects, four dead call sites; `sidebarCompact` simplified to `sidebarCollapsed` (logic-equivalent → desktop unchanged).

**Verified:** 22 frontend + 11 server tests pass; `vite build` clean; `cap sync` done.
**Blocked:** debug APK build fails locally with `java.io.IOException: Unable to establish loopback connection` (host firewall/AV blocks the Gradle JVM's localhost socket; persists with `--no-daemon`; not the sandbox, not code). On-device emulator verification needs the APK built in **Android Studio** (that path works — it produced today's 11:21 build); then it can be installed and driven for verification.

---

## 10. Consolidated UI-consistency plan (incorporating the full mobile-review requirements)

**Card system (applies to every module from B4 on):**
- **Two-column grids** only for short KPI/summary cards (Dashboard already does this; apply to Lead Store / Admissions / Revenue / UTM summary tiles).
- **Full-width cards** for detailed records (leads, students, admissions, financial rows) — never force records into 2 columns.
- Consistent width, margins, padding, typography, spacing; no awkward right-side gaps; no clipped amounts/names/labels/actions.
- Reuse `MobileRecordCard` / `MobileActionMenu` / `MobileFilterSheet` / `BottomSheet`; desktop tables stay via `hidden lg:block`, cards via `lg:hidden`.

**Complete feature visibility (every batch):** audit each screen for missing data, hidden controls, horizontal overflow, off-screen actions, unreadable tables, broken scrolling, inaccessible sub-screens, inconsistent nav — while preserving permissions, calculations, workflows.

**Revised batch order (Chat prioritized next, per your instruction):**

| # | Batch | Focus |
|---|---|---|
| **B4** | **Chat** (moved up) | WhatsApp-style thread; fix composer/keyboard overlap (`visualViewport` + safe-area), message scrolling, unread indicators, attachments, timestamp/bubble contrast. Preserve messaging + notification logic. |
| B5 | **Lead Store** | Summary tiles (2-col) + full-width lead record cards (name/phone/college/status/follow-up/amount/actions); keep filters/export/actions; modals → bottom-sheet. |
| B6 | **Admissions** | 13-col + Overall tables → full-width record cards; row actions → `MobileActionMenu`. |
| B7 | **UTM Leads + Walk-ins** | 3+1 tables → cards. |
| B8 | **Finance** (Revenue + Revenue Slabs) | Tables → cards, tab-bar overflow, `IncentiveModal`/`EditSlabsModal` → bottom-sheet. Math untouched. |
| B9 | **Analytics + Goals** | Tables + chart readability (legends, axis labels, dates, values); tab touch targets. |
| B10 | **Settings** | 4 tables → cards; tab scroller; keyboard-safe dialogs. |
| B11 | **Calendar** | Mobile month overview + selected-day agenda; stop squeezing the 7-column week grid. |

**Forms/filters/settings (cross-cutting):** mobile filter sheets, readable forms, accessible action menus, keyboard-safe dialogs; search/sort/edit/save/validation stay functional.

**Architecture:** keep the shared React + Vite + Capacitor app (no separate mobile app/repo); reuse existing mobile components; desktop appearance/behavior unchanged. Each batch: accessibility-lead review → implement → tests + build → responsive check (360/390/768/1280) → emulator verification → stop for approval before commit.

---

## 11. B3 — EMULATOR VERIFICATION RESULTS (verified on `emulator-5554`)

APK built in Android Studio (12:24), installed with `adb install -r` (data preserved, login persisted), package `com.bispun.crm`, `lastUpdateTime` 12:38. Build contains B3 (synced `index.html` has `viewport-fit=cover`).

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Dashboard vertical scrolling | ✅ PASS — scrolls top→bottom (KPIs → Revenue Trend → Leads by Source → Action Center → Admissions-by-Month → Team Performance) | live swipe |
| 2 | More sheet → Admissions group | ✅ PASS — new "ADMISSIONS" group shows **Domestic** + **International** | screenshot |
| 3 | Domestic navigation | ✅ PASS — opens "Admissions / Domestic" manager | screenshot |
| 4 | International navigation | ✅ PASS — opens "Admissions / International" manager | screenshot |
| 5 | Walk-ins tab | ✅ PASS — switches to "Domestic Walk-ins" (Log Walk-in + metrics) | screenshot |
| 6 | Counselling tab | ✅ PASS — switches to "International Counselling" (Schedule Session + metrics) | screenshot |
| 7 | Status-bar safe area | ✅ PASS — top bar sits below the status bar, no overlap, no excess gap (inset small on this AVD; `viewport-fit=cover` + `env()` now guarantees correctness on notched/edge-to-edge devices) | screenshots |
| 8 | 44px header controls | ✅ PASS — Bell + profile visibly enlarged to 44px | screenshots |
| 9 | Bottom navigation | ✅ PASS — items + active states correct (Admissions highlights for domestic-/international-) | screenshots |
| 10 | Android Back — close overlay | ✅ PASS — Back closes an open More sheet and stays in the app (B1 behavior intact; not regressed by the drawer-code removal) | adb foreground check |
| 11 | Android Back — from a module | ⚠️ PRE-EXISTING ISSUE — with no overlay open, Back **exits to launcher** instead of returning to the previous module. Cause: module switches are React state, not browser-history entries. **Not a B3 regression** (B3 only removed the never-firing drawer interceptor). Candidate for a later fix (push history per module). | adb foreground check |
| 12 | Desktop regression | ⚠️ NOT LIVE-TESTED (desktop is login-gated here) — but unaffected **by construction**: every B3 change is `lg:hidden`/mobile-gated or logic-equivalent (`sidebarCompact` term was always true). | code review |

**Net:** B3 passes all intended checks. One pre-existing Back-exits-from-module behavior surfaced (not caused by B3) — flagged for a later batch.

---

## 12. KPI-grid decisions per module (deliverable — readability-justified)

Rule: **2 columns** for normal KPI/summary cards; **3 columns only** for very short count+label metrics that stay readable at 360px; **full-width** for detailed records, charts, forms; adapt down at 320–360px.

| Module | Current | Decision | Justification |
|---|---|---|---|
| Dashboard | 2-col (B2) | **Keep 2-col** | Already compact and readable; verified on device. |
| Revenue (4 summary) | tall stacked | **2×2** | Total Admissions / Potential / In-Bucket / Buffer carry ₹ values — need width; 2×2 reads cleanly at 360px, 3-col would clip ₹. |
| Lead Store (Datasets/Imported/Converted/Duplicates) | tall stacked | **2×2** | Four short counts; balanced grid, no right-side waste. |
| Overall Admissions (3 metrics) | 3 stacked | **3-col if pure counts fit, else 2+1** | Short counts may fit 3-col at ≥360px; if any carries ₹/long label, use 2+1 to avoid clipping. Decide at build with a 360px check. |
| Analytics (4: Leads/Admissions/Conv%/Stages) | stacked | **2×2** | Mixed counts + % ; 2×2 keeps values legible; charts stay full-width. |
| Referrals (3 oversized) | 3 big cards | **3-col if readable, else 2+1** | Short reward/earnings counts; test 3-col at 360px, fall back to 2+1. |
| Help & Support (Total/Open/In-Progress/Completed) | 4 stacked | **2×2** | Four short ticket counts; 2×2 frees the first screen for the ticket list + New Ticket. |
| Walk-ins / Counselling (within Admissions) | stacked full-width metric cards | **2×2** (noted during B3 nav testing) | Short counts (visitors, converted, sessions) waste vertical space stacked; 2×2 compacts them. |

Detailed records everywhere (leads, students, admissions, expenses, tickets) stay **full-width cards** (never forced multi-column).

---

## 13. Mobile scrolling verification matrix (honest status)

| Module | Top→bottom | Swipe on chart | Modal scroll | Keyboard/composer | Bottom-nav clearance | Status |
|---|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ (chart doesn't capture) | ✅ (bottom-sheet modals) | n/a | ✅ | **Verified** |
| Admissions (Domestic/Intl/Walk-ins/Counselling) | ✅ (content scrolls) | n/a | — | — | ✅ | **Verified (basic)** |
| Lead Store | — | — | — | — | — | Pending (B5) |
| UTM Leads | — | — | — | — | — | Pending (B7) |
| Revenue | — | — | — | — | — | Pending (B8) |
| Analytics | — | — | — | — | — | Pending (B9) |
| Chat | — | — | — | ⚠️ known composer/keyboard gap | — | Pending (B4) |
| Calendar | — | — | — | — | — | Pending (B11) |
| Settings | — | — | — | — | — | Pending (B10) |
| Referrals / Help | — | — | — | — | — | Pending |

Each pending row is tested live on the emulator during its batch (per-module swipe, chart-start swipe, modal scroll, keyboard, bottom-nav clearance) — not assumed from Dashboard.
