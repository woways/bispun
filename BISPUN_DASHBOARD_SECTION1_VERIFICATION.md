# Bispun CRM — Dashboard Changes (PDF §1.1–1.7) Verification

**Date:** 2026-11-13 · **Branch:** `integration/bispun-final-pdf-review` (worktree `S:\Bispun-final-review`)
**Env:** isolated local `bispun_final` @ localhost:5432 · backend http://localhost:4200 · frontend http://localhost:5178 · Client Admin
**Method:** code trace + LIVE browser clicks + authenticated API tests. Test artifacts cleaned where deletable (see end).

## Status legend
**Live UI PASS** = verified by actual clicks in the browser · **API PASS** = verified by authenticated API/DB · **Code verified** = traced in source, not exercised end-to-end · **FAILED** · **Blocked** · **Not tested**

---

## 1.1 KPI cards clickable → drill to exact records — LIVE UI PASS (all 8)
Every Business Pulse card live-clicked. For each: value recorded, "View details"/card opens the right destination, correct filter/metric applies, value equals the contributing-record set (API-confirmed), back-to-Dashboard works, refresh keeps a valid module.

| KPI | Value | Live destination | Filter/records | Value = records? |
|---|---|---|---|---|
| Total Leads | 29 | Lead Store | "Showing Total Leads" banner | ✅ 29 = 29 |
| Qualified Leads | 10 | Lead Store | "Showing Qualified Leads" | ✅ 10 = 10 |
| New Leads | 19 | Lead Store | "Showing New Leads" | ✅ 19 = 19 |
| Admissions | 10 | Admissions module | "10 admissions shown" | ✅ 10 = 10 |
| Potential Revenue | ₹11,40,000 | Finance (drill) | "OPENED FROM DASHBOARD" + per-lead records, Total ₹11,40,000 | ✅ |
| Received Revenue | ₹4,70,000 | Finance (drill) | Total ₹4,70,000 | ✅ |
| Pending Revenue | ₹6,70,000 | Finance (drill) | Total ₹6,70,000 | ✅ |
| Current Profit | ₹4,70,000 | Finance (drill) | Received ₹4,70,000 − Expenses ₹0 − Incentives ₹0 = ₹4,70,000 | ✅ |

- Back navigation (sidebar Dashboard): **Live UI PASS**.
- Refresh on a drilled module (`/app/revenue`): **Live UI PASS** — stays on the module, authenticated; the transient "opened from dashboard" drill clears (not URL-persisted), which is expected.
- Revenue drill records each carry a Lead ID + "Open Lead". Backend `/analytics/dashboard/kpi/:key` returns the exact records; counts matched the KPI for all 8.

## 1.2 Action Center shows Lead ID — LIVE UI PASS
Payments pending modal shows a **Lead ID LDxxx** badge on every record (LD006, LD007, LD008…); records without a lead show "Admission record". (Only `pending-payments` has data in this seed.)

## 1.3 Action Center → exact lead — LIVE UI PASS
"Open in Lead Store" on LD006 opened **Lead Details for LD006** (same handler used by lead notifications).

## 1.4 Export above Action Center lists — LIVE UI PASS (button) + API PASS (content)
Export CSV button present above the list; click fired with no exception. Generated content (verified): 9 columns **[Lead ID, Name, Phone, Email, Owner, Status, Amount, Date, Notes]**, **10 rows = the count**, every row a valid LDxxx.

### Action Center — all 5 categories
| Category | Count | Result |
|---|---|---|
| Payments pending | 10 | Live UI PASS (Lead IDs, nav, CSV, filter) |
| Hot leads not contacted | 0 | Live UI PASS — clean "Nothing waiting here" empty state |
| Follow-ups overdue | 0 | API PASS (200, empty) — not opened live |
| WhatsApp replies waiting | 0 | API PASS (200, empty) — not opened live |
| Revenue at risk | 0 | API PASS (200, empty) — not opened live |
- **Permissions:** backend gate `dashboardSectionAllowed(..., "action-center")` exists (**Code verified**). Role scoping (Manager/Employee see only their leads) **Not tested** — needs other-role login.

## 1.5 Reminder exactly 10 minutes before — API PASS (boundary-proven) + Live UI PASS (bell)
Rigorous boundary test (beyond the earlier 9-min eligibility check):
- Event **8 min** out (inside window) → reminder created ✅
- Event **15 min** out (outside window) → **no** reminder ✅ → proves the **10-minute threshold**.
- **Once-only:** polled twice, reminder count unchanged (marker dedup) ✅
- **Bell visibility:** reminder appears in the bell as "Calendar event in 10 minutes — … starts at hh:mm" ✅ (**Live UI PASS**)
- **Delivery semantics:** the reminder becomes eligible exactly at T−10min and is delivered on the **next poll** (frontend 15s / worker 20s), i.e. within ~15–20s of T−10:00 — threshold-exact, not a millisecond-scheduled fire. In this env the worker is OFF; the on-demand poll path is what was tested.

## 1.6 Audible bell / WhatsApp-like sound — CODE VERIFIED ONLY · PENDING human listening
`playNotificationSound()` (Web Audio 3-tone chime) fires on unread-count increment; `playChatSound()` is the WhatsApp-style chat chime. Not audible in a headless browser. **Requires a human to confirm the sound actually plays** (and note: browser autoplay needs one prior user interaction via `unlockUiSound`).

## 1.7 Same reminder + sound on mobile — PENDING device/emulator (Track B)
`src/lib/mobilePush.js` plays the sound on a `REMINDER` push; same 10-min backend. **Android FCM delivery + tap navigation not tested** — owned by the mobile-ui session.

---

## Notification-click navigation — investigated (your "clicking does nothing" report)
Mechanism: `parseNotificationTarget(actionModule, message)` → only **leads** carry a deep target (`lead-store#lead:<id>`). Everything else resolves to a module key at most; an unknown key renders blank (`default: return null`).

| Notification | actionModule | Click result | Opens exact record? | Status |
|---|---|---|---|---|
| Lead (follow-up / nurture) | `lead-store#lead:<id>` | opens exact lead (`openLeadDetail`) | ✅ Yes | **Code verified** (same handler proven live in §1.3; not literally clicked as a LEAD notification) |
| **Calendar reminder / event** | `dashboard` | goes to Dashboard; **does nothing when already there**; never opens the calendar or the event | ❌ No | **FAILED (Live UI confirmed)** |
| **Help & Support (ticket)** | `help` | opens Help & Support **module**, not the ticket | ❌ No | **FAILED (Code verified)** |
| **Chat** | — | no chat notification exists in the bell (chat uses a separate unread badge) | ❌ No | **Not implemented** |
| **Finance / billing** | `settings` | opens Settings, not a finance record | ❌ No | **FAILED (Code verified)** |
| Referral | `my-referrals` | opens Referrals module | ⚠️ module only | Code verified |

**Root cause of "clicking does nothing":** the calendar reminder (the notification most often clicked straight from the Dashboard bell) targets `dashboard` — a no-op when already on the Dashboard. Its label says "Open calendar" but no calendar/event opens. **Only lead notifications deep-link to the exact record.**

## Minor finding (non-blocking)
React dev warning "A props object containing a `key` prop is being spread into JSX" at `Dashboard.jsx:283` (MetricCard). Cosmetic, dev-mode only; no functional impact.

---

## Remaining manual tests for Dashboard (for the human)
1. **Sound (1.6):** with speakers on, interact once with the page, then trigger a new notification (or set an event ~10 min out) and confirm the chime actually plays; compare chat vs notification tones.
2. **Android (1.7):** on emulator/device, confirm the 10-min reminder arrives via FCM and tapping it navigates correctly.
3. **Action Center with live data:** seed hot-leads / overdue-followups / whatsapp-replies / revenue-risk, then re-run Lead-ID, record-navigation, CSV (columns + row count), and filter checks for each (only payments-pending had data here).
4. **Permissions/role scoping:** log in as Manager and Employee and confirm KPIs and Action Center show only the records each role may see; confirm an employee without dashboard access is blocked.
5. **Downloaded CSV file:** open the actual exported file and confirm the 10 rows + headers render in Excel/Sheets (content verified programmatically; the saved file not opened here).
6. **Notification navigation bugs (confirm + decide fix):** calendar reminder → exact event; Help ticket → exact ticket; Chat → conversation; Finance → record. These do **not** deep-link today — confirm against production expectation and prioritise.

**Not done here:** no push/merge/deploy; production unchanged; no external notifications sent. Test leads **LD029, LD030** remain in the disposable DB (CRM-create has no matching API delete). Earlier test events/notifications were deleted; bell reset to 0.
