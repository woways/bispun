# Bispun — Desktop CRM Smoke Test (dev, read-only)

Date: 2026-11-01 · Browser pane @ **1440×900** (desktop, ≥lg) · frontend
`http://localhost:5173` → dev backend `http://localhost:4000` (**bispun-mobile-dev**),
logged in as **QA Admin** (CLIENT_ADMIN). **No records created/updated, no messages
sent, no files uploaded, no code/DB/Git changes.**

## Verdict: ALL DESKTOP MODULES PASS — mobile changes did not break the Desktop CRM

| # | Module | Result | Notes |
|---|---|---|---|
| 1 | **Dashboard** | ✅ PASS | Desktop **4-column** Business Pulse KPIs (not the mobile 2×2 → mobile changes are `lg`-gated), Revenue Trend + Leads-by-Source charts side by side, scrolls to Daily Priority/Action Center. |
| 2 | **Chat** | ✅ PASS | Desktop **two-pane** layout (conversation list + "Select a conversation" thread pane) inside the card — not the mobile single-pane. |
| 3 | **Calendar** | ✅ PASS | Desktop **week grid** (26 Oct–1 Nov, 7 day-columns + hour rows) with Day/Work week/Week toggle + ‹ › nav, plus mini-month/agenda side panel. The mobile agenda-only view is correctly `lg`-hidden. |
| 4 | **Lead Store** | ✅ PASS | Inventory header, actions (Import/Add/Smart Nurture), KPI cards, lead-type filter, data table + pagination. |
| 4 | **Admissions** | ✅ PASS | Expandable nav (Overall/Domestic/International); Domestic loaded: Walk-ins/Counselling/Admissions Done, Overview, stream breakdown. |
| 4 | **Revenue** | ✅ PASS | FINANCE / REVENUE MANAGEMENT loads (data via slow dev backend). |
| 5 | **Analytics** | ✅ PASS | Insights / Business Analytics; Overview + Year Comparison; KPI cards (Total Leads/Admissions/Conversion/Tracked Stages). |
| 5 | **Referrals** | ✅ PASS | Rewards; Home/My Referrals/Earnings; KPI cards; referrer card + referral code/share. |
| 5 | **Help & Support** | ✅ PASS | Service Desk; New Ticket; ticket KPIs (Total 1 / Open 1 / In Progress 0). |
| 6 | **Settings + role-based access** | ✅ PASS | Full config tabs (Company/Branding/Users & Roles/Lead Sources/Custom Fields/Notifications/Integrations/Activity Log); **QA Admin (CLIENT_ADMIN) sees all admin modules** → role-based access intact. Confirms the "Bispun Mobile QA / QA (dev test)" tenant. |
| 7 | **Navigation / sidebar / responsive** | ✅ PASS | Left sidebar + expandable groups navigate correctly; at **1440px** the desktop shell renders, at **~800px** it switched to the mobile bottom-nav layout → the `lg` breakpoint works as intended. |
| 8 | **Console errors / API auth failures** | ✅ PASS (clean) | Only **pre-login** `GET /auth/me → 401` entries in the console (expected before authentication). **All post-login API calls return 200** (analytics/dashboard, support, users/organization, calendar, etc.). No post-auth failures, no JS errors. |
| 9 | **Mobile changes didn't break Desktop** | ✅ PASS | Every desktop layout is intact (4-col dashboard, two-pane chat, week-grid calendar, multi-col module KPIs, sidebar). All Chat/Calendar/KPI mobile edits are `lg`-gated; `ClientPortal` main-padding fix verified desktop-unchanged (sidebar + content render correctly). |

## Environment used (verified read-only earlier)
`.env.development` → **bispun-mobile-dev** (`ep-blue-mouse-b4if0xzj`). The `:4000`
backend serves this DB (QA tenant + today's QA session present). The existing-CRM
DB (`.env` / `ep-weathered-credit`) was **not** used for this smoke.

## Not done (as instructed / environment)
- No record create/update/delete, no messages sent, no file uploads.
- Deeper functional flows (OTP onboarding, billing actions, push delivery, chat
  send/attachments) remain for their own authorized phases.

## Setup notes
- Temporary desktop Vite session is running at `localhost:5173` with an **inline**
  `VITE_API_URL=http://localhost:4000` (committed `.env` untouched; no `.env.local`
  written). Stop it when done; mobile builds still use `10.0.2.2:4000` from `.env`.

**STOP — desktop smoke complete, all PASS. No code/DB/Git/deploy changes.**
