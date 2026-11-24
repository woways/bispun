# Bispun CRM — Combined Integration Runtime QA (read-only)

Date: 2026-11-02 · Branch **`integration/mui-yc` @ `9730561`** · frontend
**http://localhost:5174** → dev API **http://localhost:4000** → DB **bispun-mobile-dev
(`ep-blue-mouse`)**. Logged in as **QA Admin** (tenant "Bispun Mobile QA / QA (DEV
TEST)", ADVANCED PLAN). **Read-only: no leads created, no sequences started, no calls
placed, no messages sent, no records modified. Nothing pushed/merged/deployed.**

> The dev DB is essentially empty (0 leads, 0 admissions, 1 support ticket), so most
> lists show empty states. That verifies rendering, API wiring and layout — not
> data-populated behaviour.

## Results — PASS / FAIL / NOT TESTED

### 1. Lead Store rewrite, Lead IDs, KPI cards, filters — ✅ PASS
- APIs 200: `/lead-store`, `/lead-store/manual`, `/lead-store/meta/assignees`,
  `/lead-store/status-options`.
- Table columns: **LEAD ID · NAME · PHONE · ALTERNATIVE PHONE · EMAIL · COURSE ·
  ASSIGNED TO · LEAD TYPE · STATUS · ACTIONS** — Lead ID column present; the
  **`alternatePhone`** column renders (the migration is live — the query returns 200,
  not 500).
- KPI cards: Datasets / Imported Leads / Converted / Duplicates Skipped (rewrite set).
- Filters: Lead Type dropdown (All / Individual / External Data / Offline LeadGen /
  Purchased / Uploaded / Assigned), search ("lead ID, name, phone, email or course"),
  Filter / View / Export CSV, pagination (Rows 10/25/50/100).

### 2. Smart Nurture — button, modal, permissions/eligibility UI — ✅ PASS
- **Smart Nurture** button visible in the header toolbar (between Refresh and Add Lead),
  desktop and mobile.
- Modal opens: "Smart Nurture & Re-engagement / Automated follow-up sequences", the
  eligibility/flow line **"WhatsApp template → Email → Follow-up task → Manager alert if
  there is still no reply."**, **"0 leads selected in Lead Store"** audience, **Process
  due now** + **New sequence**, a Sequences panel ("0 total") and Recent nurture activity.
- APIs 200: `/nurture/sequences`, `/nurture/enrollments`.
- **Escape closes the modal and returns focus to the Smart Nurture button** (restored
  `useOverlayDismiss`). No sequence started.

### 3. Dial & Track — button, modal, form layout — ⚠️ NOT TESTED (blocked; needs a DB write)
- The **Dial & Track** entry lives in a lead row's **phone-action menu**, and the dev DB
  has **0 leads**, so there is no row to open it from. Opening it requires creating a
  lead (a database write), which is out of the read-only scope.
- Verified indirectly: `CallCenterModal.jsx` is bundled and loaded (200); the telephony
  routes are mounted; the code wiring (`onDial → setCallLead → <CallCenterModal>`) is in
  place from the restoration.
- **To test the modal/form I need approval to create one disposable test lead** in
  bispun-mobile-dev (and I would still **not** place a real call — only open the modal and
  read its layout; optionally remove the lead afterward). **Stopped for your approval.**

### 4. Revenue / Help / Analytics / My Store / Counselling / UTM Leads / Walk-ins — ✅ PASS
| Module | API | Result |
|---|---|---|
| **Revenue** (Finance) | `/revenue?year=2026` 200 | 9 KPI cards (3-col desktop grid), tabs (Overview/Expenses/Incentives/College Revenue/Staff Incentives), Monthly Revenue chart, Breakdown — no clipping |
| **Help & Support** | tickets 200 | KPIs (Total 1 / Open 1 / In Progress 0 / Completed 0), action cards, status/type/priority filters, ticket list (1 record) |
| **Analytics** (Insights) | `/analytics/dashboard`, `/analytics?compareYear`, `/leads/utm/analytics` 200 | KPIs, Source-wise Conversion + Lead Stage Distribution, Overview/Year Comparison tabs |
| **My Store** | `/store/occasions`, `/store/usage`, `/store/templates/*` 200 | Occasion tabs, design generator, ready designs, promo + message |
| **Counselling** (Admissions → Domestic) | 200 | Sessions Today/This Week/Conversion/Pending KPIs, Schedule Session, status filter |
| **UTM Leads** | — | UTM Generator (platform/medium), Manually Add UTM Link, Saved Influencer Links with filters/export |
| **Walk-ins** (Admissions → Domestic) | 200 | Walk-ins/Converted/In Progress/Lost KPIs, Log Walk-in, status filter |

### 5. Desktop navigation, scrolling, responsive layout — ✅ PASS
- All sidebar groups expand (Admissions, Finance, Insights) and every module opens; sub-tabs
  (Domestic → Walk-ins / Counselling / Admissions Done) switch correctly.
- Content scrolls; multi-column desktop grids intact; no overflow/clipping at 1440×900.

### 6. API authentication, console errors, backend health — ✅ PASS
- **Auth:** `/api/client/auth/me → 200` on load; every module data call returned **200**.
- **Backend health:** `/api/health → { success:true, database:"connected" }`, bound to
  **bispun-mobile-dev**, background workers disabled.
- **Console errors:** the **only** errors are **22 stale CORS failures** (`auth/me`,
  `/health`, `auth/login`) — all `No 'Access-Control-Allow-Origin'` from the brief setup
  window **before origin `:5174` was added to the backend's allowlist** (the backend first
  came up allowing `:5173` only; Vite had fallen back to `:5174`). After the fix, **zero**
  new console errors occurred across the entire sweep. A fresh session now starts clean.

### 7. Existing mobile UI changes intact in the combined code — ✅ PASS
- **2-column KPI grids on mobile:** Dashboard (Total Leads | Qualified Leads …) and **Lead
  Store** (Datasets | Imported Leads / Converted | Duplicates Skipped).
- **Module header clears the fixed top bar** (Issue A fix intact) — not hidden behind it.
- Horizontally-scrollable sub-tabs, full-width primary buttons, stacked cards; responsive
  down to 375px with no horizontal overflow. Smart Nurture button and the ALTERNATIVE PHONE
  column also present on mobile.

## Scorecard
| # | Area | Verdict |
|---|---|---|
| 1 | Lead Store (rewrite, Lead IDs, KPIs, filters) | ✅ PASS |
| 2 | Smart Nurture (button, modal, eligibility UI) | ✅ PASS |
| 3 | Dial & Track (button, modal, form) | ⚠️ NOT TESTED — needs a test lead (DB write); stopped for approval |
| 4 | Revenue/Help/Analytics/My Store/Counselling/UTM/Walk-ins | ✅ PASS (all) |
| 5 | Desktop nav / scroll / responsive | ✅ PASS |
| 6 | API auth / console / backend health | ✅ PASS (console errors are stale pre-fix CORS only) |
| 7 | Mobile UI changes intact | ✅ PASS |

## Needs approval (database write) — to finish item 3
To exercise **Dial & Track** (and, if you want, populated **Lead Store / Smart Nurture**
behaviour), I need approval to **create one disposable test lead** in bispun-mobile-dev. I
would open the Dial & Track modal to verify layout only — **no real call, SMS, WhatsApp or
nurture send** — and can delete the test lead afterward. Say the word and I'll proceed; until
then it stays NOT TESTED.

**STOP — read-only QA complete. 6 of 7 areas PASS; Dial & Track pending a test-lead
write for your approval. Nothing committed, pushed, merged or deployed.**
