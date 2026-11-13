# Bispun CRM — Notification Click-Navigation: Phase 1 Root-Cause Audit (READ-ONLY)

**Date:** 2026-11-13 · **Branch audited:** `integration/bispun-final-pdf-review` (worktree `S:\Bispun-final-review`, clean)
**Scope:** why notification clicks don't open the exact record. No code changed in this phase.

## Single shared root cause
`src/lib/notificationTarget.js` → `parseNotificationTarget(actionModule, message)` decodes **only** a lead target (`"<module>#lead:<id>"`, plus a legacy `LEAD_FOLLOWUP:<id>:` message fallback). Every other notification type stores `actionModule` as a **bare module key with no record id**, so a click resolves to the module at best — and to a **no-op** when you are already on that module.

Both entry points share this one resolver:
- **Web:** `ClientPortal.jsx` `markNotificationRead()` → `if (leadId) openLeadDetail(leadId); else if (moduleKey) setModule(moduleKey)`.
- **Mobile FCM:** `src/lib/mobilePush.js` `handleTapAction()` → same parser; only the lead suffix is forwarded; `moduleKey` is checked against an `ALLOWED_MODULES` allowlist.

The `Notification` Prisma model has only `actionModule`/`actionLabel` (no target-id column) — so any id must be encoded in `actionModule`. **No DB migration is required** (reuses the existing `#...:<id>` convention).

## Per-type findings
| # | Type | `actionModule` today | Record id available at creation? | Target module can open the record? | Verdict |
|---|---|---|---|---|---|
| 1 | Calendar reminder (`REMINDER`) | `dashboard` | **Yes** — eventId is in the message marker `CALENDAR_REMINDER:<id>` (`server/lib/calendarReminders.js:43`) | Calendar modal exists (Dashboard `fullCalendarOpen`); **no event-focus entry point yet** | **Broken, fixable** |
| 1b | Calendar event assigned (`INFO`) | `dashboard` | eventId in scope (`server/routes/clientCalendar.js:1259`) | same | Broken, fixable |
| 2 | Support ticket (`SUPPORT`) | `help` | **Yes** — `ticket.id` at call site (`clientSupport.js:87`, `adminSupport.js`), but not encoded (`server/lib/notifications.js:85,109`) | `Help.jsx` has `TicketDetailsModal`; **but `Help` takes only `{plan,tenant,user}` — no focus prop** | **Broken, fixable (moderate)** |
| 3 | Lead follow-up / nurture (`LEAD`) | `lead-store#lead:<id>` | Yes | Lead Store opens exact lead (`openLeadDetail`) | **Works — needs live confirmation** |
| 4 | Chat | — | — | — | **Not implemented — no CHAT notification type exists anywhere.** Chat uses a separate socket/unread badge. Deep-link = NEW FEATURE (product decision). |
| 5 | Finance / payment record | — | — | — | **Not implemented — no FINANCE/PAYMENT/REVENUE notification type exists.** Only `BILLING` (subscription renewal) → `settings`, which is correct. A finance-record notification = NEW FEATURE (product decision). |
| — | Billing/subscription (`BILLING`) | `settings` | n/a (subscription, not a record) | Settings opens | Working as intended |
| — | Referral (`REFERRAL`) | `my-referrals` | n/a | Referrals module opens | Working as intended |

## Tenant isolation / permissions
Navigation is safe to extend: opening by id does **not** bypass security. The frontend only sets a module + focus id; the actual data is fetched by **company-scoped** endpoints (leads, calendar, support all filter by `companyId`/user). A fix must still (a) show a safe fallback when the record is missing/deleted/unauthorized, and (b) keep the mobile `ALLOWED_MODULES` allowlist authoritative.

## Tests / affected modules
- Unit: `src/lib/notificationTarget.test.js` (covers lead parsing only), `server/lib/pushService.test.js`.
- Integration: `server/__tests__/api.integration.test.js`, `gapClosure.integration.test.js`.
- A fix would touch: `notificationTarget.js` (+ its test), `ClientPortal.jsx` (web handler + prop wiring), `Dashboard.jsx` (calendar focus), `Help.jsx` (ticket focus), `mobilePush.js` (FCM + allowlist), and backend creators (`calendarReminders.js`, `clientCalendar.js`, `notifications.js`).

## ⚠️ Cross-session overlap (must resolve before coding)
A sibling worktree **`S:\Bispun-mobile` is on branch `feat/notification-deep-links`** (the active **mobile-ui** session). Its current diff does **not** yet contain the deep-link logic, but it **heavily rewrites `src/modules/client/Dashboard.jsx` (~294 lines) and `src/ClientPortal.jsx` (+165)** — the exact files a web fix must edit. Editing them on a separate branch risks duplicate/conflicting work and hard merges. Ownership of the notification-deep-link feature (and especially the mobile/FCM side) needs to be settled first.

## Recommended Phase 2 scope (pending your decision)
- **Do now (pure bug-fix, existing notifications → existing records/modals):** (1) calendar reminder/event → open calendar focused on the event; (2) support ticket → open the ticket details; (3) confirm lead nav live. Centralize in `parseNotificationTarget` so web + FCM both benefit.
- **Stop for product decision (new features — per your instruction):** (4) chat deep-link, (5) finance-record deep-link — no such notifications exist today.
- **Coordinate:** align with the mobile-ui session on file ownership (Dashboard.jsx/ClientPortal.jsx/mobilePush.js) before editing.
