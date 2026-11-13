# Bispun CRM — Dashboard Changes (PDF §1.1–1.7) Verification

**Date:** 2026-11-13 · **Branch:** `integration/bispun-final-pdf-review` (worktree `S:\Bispun-final-review`)
**Env:** isolated local `bispun_final` @ localhost:5432 · backend http://localhost:4200 · frontend http://localhost:5178
**Method:** code trace + LIVE browser test (Client Admin) + authenticated API test. Test artifacts created were deleted; unread count reset to 0.

## Verdict: ALL 7 IMPLEMENTED AND WORKING

| # | Requirement | Status | How verified |
|---|---|---|---|
| 1.1 | Every KPI card clickable → drills to the exact records | ✅ WORKING | LIVE: clicked **Total Leads (28)** → navigated to **Lead Store** with banner **"DASHBOARD FILTER — Showing Total Leads"** (+ "Show all leads" reset). All 8 Business Pulse cards have a "View details" action. |
| 1.2 | Payments Pending shows Lead ID per record | ✅ WORKING | LIVE: Action Center → Payments pending modal shows **Lead ID LD006 / LD007 / LD008** badges on each record. |
| 1.3 | Clicking a lead in Action Center opens that exact lead | ✅ WORKING | LIVE: "Open in Lead Store" on LD006 → **Lead Details for LD006** (Finance Student, phone 9466024869). Not a disconnected summary. |
| 1.4 | Export option above Action Center result lists | ✅ WORKING | LIVE: **Export CSV** button present above the list (Items 10). CSV columns: Lead ID, Name, Phone, Email, Owner, Status, Amount, Date, Notes — i.e. the underlying records. |
| 1.5 | Reminder exactly 10 min before the event | ✅ WORKING | API TEST: created an event 9 min out → polling notifications generated **1 REMINDER**: *"Calendar event in 10 minutes — … starts at 01:23 pm."* `CALENDAR_REMINDER_MINUTES = 10`. |
| 1.6 | Audible bell / WhatsApp-like alert sound | ✅ CODE-VERIFIED | `playNotificationSound()` (Web Audio 3-tone rising chime) fires when the unread-notification count increments (15s poll). Separate WhatsApp-style chat chime also present. Not audible in headless test. |
| 1.7 | Same 10-min reminder + sound on mobile | ✅ CODE-VERIFIED | `src/lib/mobilePush.js`: push of type `REMINDER` → `playNotificationSound()`. Same backend 10-min logic feeds mobile. Device-level test owned by the mobile track. |

## Implementation map
- **KPI drill-down:** `Dashboard.jsx` cards → `onOpenKpi(key)` → `ClientPortal.openDashboardKpi` routes leads→Lead Store (filtered), admissions→Admissions, revenue→Revenue (per-metric drill). Backend `GET /api/client/analytics/dashboard/kpi/:key` returns the actual records for each KPI.
- **Action Center:** card → `openActionDetail` → `GET /api/client/analytics/action-center/:key`; modal renders Lead ID badge, Export CSV (`downloadCsv`), and "Open in Lead Store" (`onOpenLead(leadId)`) / "Open in Admissions|Counselling" for non-lead records.
- **Reminders:** `server/lib/calendarReminders.js` (`CALENDAR_REMINDER_MINUTES=10`, window `startAt > now && <= now+10min`). Two trigger paths: (a) 20s background worker, (b) on-demand via `ensureCalendarRemindersForUser`, called by `GET /notifications` and `GET /notifications/unread-count` (frontend polls unread-count every 15s). Sound: `src/lib/sound.js`.

## Honest caveats
- **1.6 / 1.7 are code-verified, not sensory/device-verified** (headless browser can't play audio; mobile device testing is the mobile track's scope).
- **Browser autoplay policy:** the reminder sound needs one prior user interaction in the tab to unlock audio (`unlockUiSound`) — standard browser behaviour, not a defect.
- **This manual env has the background worker OFF** (`DISABLE_BACKGROUND_WORKERS=true`). The reminder still works via the on-demand path (what was tested). In production the 20s worker is the primary path — ensure it is enabled there.
