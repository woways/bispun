# Bispun CRM — Old-vs-New Regression Audit

**Branch:** `fix/bispun-web-mobile-stabilization` (reconciled with `main` at `2be6ca3`)
**Baselines compared:** historical approved **`0e9fa2c`** (Revenue-at-Risk-era Finance) and `1286759` (Lead Store actions) → current `origin/main` (`2be6ca3`) → this stabilization branch.
**Dev DB:** blue-mouse (production `pond` never touched).

## FINAL RECONCILED STATE (supersedes the in-progress notes below)

- **Finance baseline corrected:** the approved target is the **Revenue-at-Risk era `0e9fa2c`** (not `d39829a`, which predates the feature). `Revenue.jsx` was re-baselined on `0e9fa2c` (commit `cf3a04b`) + accessibility PASS (`befc5fe`); the earlier `d39829a`-based `fa48e84` is superseded (kept in history). "Revenue at Risk" == "Leakage Radar" (same component, renamed); backend still returns `leakageRadar`.
- **Login hotfix merged to main** as PR #5 (`a495abf`, `c55388f` → merge `2be6ca3`); the stabilization branch now contains it (merge `818701a`), reconciled with no duplication.
- **Change surface over `main` (regression scope), code only — 13 files:** `Revenue.jsx` (Finance restore+a11y), `LeadStore.jsx` (Call/Send Message), `App.jsx`+`api.js` (login resilience), `ClientPortal.jsx` (React.lazy code-split + URL nav), `index.css`+`ui.jsx`+`mobileUi.jsx` (motion system), `invoicePdf.js` (deferred jsPDF), `CalendarModal.jsx`/`ChatPanel.jsx`/`Dashboard.jsx` (minor mobile UI), `clientAuth.js` (login-query perf). **All INTENTIONAL, previously-approved changes.**
- **Unrelated modules NOT in the diff → no regression:** Admissions, Analytics, UTM Leads, Settings, Notifications, Walk-ins, Counselling, My Store, My Referrals, Goals & Targets, Support, Google/Communications — unchanged vs `main`.
- **Revenue calculations verified** (blue-mouse fixtures, read-only cross-check + live API): approved/paid status filtering and profit formula correct; backend calc code is byte-identical to deployed `main`.

**Status:** Finance, Lead Store, login and calculation sections confirmed. Classification table below retained for detail.

## Classification legend

- **CONFIRMED REGRESSION** — functionality present in an approved historical build, unintentionally removed/broken since, now restored or flagged.
- **INTENTIONAL CHANGE** — deliberate, approved change (not a bug).
- **PERMISSION/SUBSCRIPTION DIFFERENCE** — difference explained by role or plan gating.
- **RESPONSIVE DIFFERENCE** — difference explained by viewport/layout, not loss.
- **UNVERIFIED** — not yet confirmed.

## Findings

| Module | Feature | Old behavior | Current behavior (pre-fix) | Responsible commit | Restoration action | Test result |
|---|---|---|---|---|---|---|
| Finance / Revenue | Overall visual design | `d39829a` approved look | Restyled look (KPI grid, tabs, richer modals) | earlier mobile/UI commits `0e9fa2c`/`197b656`/`5bb2d77`/`f3cc084` (NOT the merge `2219749`, which did not touch `Revenue.jsx`) | Reverted `Revenue.jsx` to `d39829a` look, then re-applied a11y | CONFIRMED REGRESSION → restored (commit `fa48e84`) |
| Finance | Expense receipt/proof upload | Upload JPG/PNG/WEBP/PDF proof (`/expenses/proof-upload`) | Removed by the full visual revert | visual revert (local, uncommitted) | Re-ported into old look with validation + a11y | CONFIRMED (revert side-effect) → restored |
| Finance | Edit existing expense | PATCH `/expenses/:id`, prefilled | Removed by revert (create-only) | visual revert | Re-ported (edit mode in ExpenseModal) | restored |
| Finance | Expense details drill-in | `ExpenseDetails` panel w/ proof | Removed by revert | visual revert | Re-ported as accessible slide-in dialog | restored |
| Finance | Search / filter / export | Search + status/category filter + CSV export | Removed by revert | visual revert | Re-ported toolbar + CSV export | restored |
| Finance | Incentive employee picker | `/chat/users` company-scoped select | Removed by revert (free text) | visual revert | Re-ported select w/ free-text fallback | restored |
| Finance | RevenueSlabs (College Revenue + Staff Incentives) | Two tabs rendering `RevenueSlabs` | Import removed by revert | visual revert | Re-added import + two tabs | restored |
| Finance | Year filter on revenue | `selectedYear` applied to `/api/client/revenue` | `d39829a` ignored `selectedYear` (loaded all years) | historical `d39829a` | Restored year-aware load (`?year=`) | CONFIRMED (historical limitation) → fixed |
| Lead Store | Row **Call** action | Visible emerald Call button in the row Actions column (`1286759`) | Removed; call only reachable by opening the phone-number dropdown | between `1286759` and `2219749` (PhoneAction consolidation, `055ebcc` + later) | Restored a direct **Call** (`tel:`) row action | CONFIRMED REGRESSION → restored |
| Lead Store | Row **Send Message** action | Message/Email composer button per row | Present as a `Mail`/"Email" button (less discoverable) | — | Relabeled to explicit **Send Message** (opens existing composer) | PARTIAL (present, clarified) |
| Lead Store | Dial & Track | Call-center modal (`CallCenterModal`) | Present (phone-number dropdown → `setCallLead`) | — | Preserved (not changed) | INTENTIONAL CHANGE (kept in menu) |
| Lead Store | Smart Nurture | Present | Present | — | Preserved | no regression |
| Lead Store | Lead ID / alt phone / follow-up / Import / assignment / status | Present | Present | — | Preserved (unchanged by restoration) | no regression |

### Notes on Lead Store contact actions
- Direct native actions (dial `tel:`, SMS, WhatsApp) remain available in the phone-number dropdown (`PhoneAction`); the restoration surfaces **Call** (direct `tel:`) and **Send Message** (composer) as explicit right-side row actions again, kept distinct from **Dial & Track** (`CallCenterModal`, still in the phone menu) and **Smart Nurture**.
- "Lead remarks" are stored/displayed under the **notes** field in the current schema.

## Modules still under audit (P0-D)
Dashboard · Admissions · Analytics · UTM Leads · Chat · Calendar · Walk-ins · Counselling · My Store · My Referrals · Goals & Targets · Notifications · Settings · Help & Support · Desktop sidebar · Mobile bottom navigation.

_Each will be classified using the legend above with the responsible commit and evidence._
