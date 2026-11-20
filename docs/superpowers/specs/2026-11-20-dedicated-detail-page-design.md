# Dedicated Detail Page for All Drill-Downs — Design

Date: 2026-11-20
Status: Approved (design); implementation pending
Area: `src/` client portal (React 18 + react-router + Tailwind, Capacitor mobile)

## Problem

Clicking a metric / KPI / dataset card today drills down through **four
inconsistent UI patterns**, which looks unpolished (especially on mobile):

1. **Inline panel** on the same page with a "Close" button — Lead Store
   (`metricPanel`), UTM Leads (`AnalysisDetailPanel`).
2. **Modal dialog** — Revenue (`DrilldownModal`), Dashboard Action Center.
3. **In-place "replace page" view** — Admissions (stream / partner / branch /
   all-admissions).
4. **Cross-module jump + filter banner** — Dashboard Business-Pulse KPIs and
   Analytics (`openDashboardKpi`).

There are ~25–30 of these record views and six near-duplicate clickable-card
components (`MetricCard` ×2, `StoreMetric`, `RevenueMetric`, `AnalyticsMetric`,
`WalkinMetric`, `CounsellingMetric`).

## Goal

Clicking any card opens **one consistent dedicated page** that shows **only that
card's content** (its records), with a neat UI and a Back control. Works
identically on mobile and desktop.

### Confirmed decisions

- **One reusable pattern everywhere** — convert all ~25–30 drill-downs in one pass.
- **The detail page shows ONLY the records for that card** — a neat page with an
  eyebrow (breadcrumb), title, optional one-line subtitle, Back, and the records
  table. **No KPI / summary stat cards on the detail page.**
- **Back** returns to the exact card grid the user came from; the shell Back
  button (added earlier) continues to work too.
- **No backend changes** — reuse each module's already-loaded data / existing
  endpoints.

## Component: `DetailPage` (`src/components/DetailPage.jsx`)

A single presentational component used by every drill-down.

Props:
- `eyebrow` — breadcrumb string, e.g. `"Lead Store / Datasets"`.
- `title` — page heading, e.g. `"Import Batches"`.
- `subtitle` — optional one-line description.
- `onBack` — handler; `backLabel` — e.g. `"Lead Store"` (Back aria-label becomes
  `"Back to {backLabel}"`).
- `loading`, `error` — optional, for views that fetch on open (e.g. Dashboard
  Action Center). Uses the existing `resolveListView` precedence
  (loading > error > empty > content).
- `children` — the records table / content (the "particular content").

Layout (top → bottom): Back button → eyebrow → `<h1>` title → subtitle →
`children`. No summary/stat cards.

Accessibility (per accessibility-lead requirements, to be re-reviewed before
coding):
- `<h1>` receives focus on open (tabindex -1) so keyboard/SR users land in the
  page, reusing the shell's focus-to-main mechanism; the existing
  `moduleAnnouncement` live region stays the single announcer (no new live region).
- Back is a `<button>`, visible "Back" text + `aria-label="Back to {backLabel}"`
  (Label-in-Name safe), decorative icon `aria-hidden`.
- Records table uses the shared `<Table>` (`src/components/ui.jsx`) with its empty
  state; table has an accessible caption/name.
- Focus ring `focus-visible:ring-indigo-500` (≥3:1), 44px touch targets on mobile.

## Integration model

Data stays in the module that already loads it; the detail page is rendered by
that module (or, for cross-module KPIs, by the module that owns the records).

- **Within-module drill-downs** — each module keeps a local `detailView`
  descriptor state `{ key, title, eyebrow, subtitle, columns, rows }` (or a
  render function). When set, the module renders `<DetailPage>` **instead of** its
  card grid; `onBack` clears it. This replaces the module's inline panel / modal /
  view-swap.
- **Cross-module KPIs (Dashboard, Analytics)** — the card routes to the owning
  module and opens that module's `detailView` for the matching dataset (e.g.
  Dashboard "Qualified Leads" → Lead Store detail of qualified leads; "Received
  Revenue" → Revenue detail of received admissions; "Admissions" → Admissions
  detail). The shell Back returns to Dashboard. This replaces the
  filter-banner approach.

## Per-module conversion (all in one pass)

| Module | Cards → dedicated page | Current pattern replaced | Records source |
|---|---|---|---|
| Lead Store | Import Batches, Duplicates Skipped, Imported, Converted | inline panel / filter | `datasets`, `individualLeads` |
| Dashboard | 8 Business-Pulse KPIs; Action Center items | cross-module jump / modal | owning module data; `/analytics/action-center/{key}` |
| Revenue | 9 overview KPIs + 4 at-risk categories | `DrilldownModal` | arrays derived from `data` |
| Admissions | all-admissions, stream, partner, branch | in-place view swap | `admissions`, `streams`, `partners`, `branches` |
| Analytics | overview (Total Leads, Admissions) + year-comparison cells | cross-module jump | owning module data |
| UTM Leads | links, registrations, leads, admissions, revenue | `AnalysisDetailPanel` | `links`, `utmLeads` |
| Walk-ins | month, converted, in-progress, lost | in-page filter | `walkIns` |
| Counselling | today, week, converted, follow-ups | in-page filter | `sessions` |

Display-only stat cards (non-clickable today) stay non-clickable.

Dead code to remove: Dashboard's unused `kpiDetailOpen` modal (`openKpiDetail` no
longer opens it).

Optional consolidation (keep scope tight): the six duplicate clickable-card
components can later collapse into one shared `MetricCard`. Not required for this
change; do only if it reduces risk.

## Testing

- Keep existing tests green (150 currently).
- `DetailPage` view-state logic already covered by `resolveListView`
  (`loading > error > empty > list`); add unit coverage for any new pure helper
  (e.g. a descriptor builder) following the `src/lib/*.test.js` convention and the
  `package.json` `test` script.
- Build (`npm run build`) must pass.
- Browser verify on the running dev stack (frontend 5173 + backend 4000 → Dev DB
  ep-blue-mouse, never Pond): click a representative card in each module, confirm
  the dedicated page shows only that content, Back returns correctly, on both a
  mobile-width and desktop-width viewport.

## Out of scope

- Backend / API changes.
- New data columns beyond what each current drill-down already shows.
- Desktop/mobile nav structure changes (the shell Back button already shipped).
