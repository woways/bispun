# Bispun CRM — Notification Deep-Link Accessibility Findings (NO-SHIP)

**Date:** 2026-11-13 · **Source commit reviewed:** `af5c254` as consolidated at `aa278d1` (branch `integration/notif-deeplinks-consolidated`).
**Reviewer:** Track B's independent `accessibility-lead` pass (read-only). **F2 independently re-confirmed by Track A** in the consolidated source.
**VERDICT: NO-SHIP** until the 2 MAJOR findings are fixed. These apply to the consolidated source on BOTH integration lines — **do not merge the deep-links anywhere until fixed.**

## MAJOR — ship-blockers
### F2 — CalendarModal stale "no longer available" error persists (CONFIRMED by Track A)
`src/modules/client/CalendarModal.jsx`: `focusNotice` (state :401) is set to "That calendar event is no longer available." on a 404/error (:661, :665) and only cleared when a valid event loads (:645). The deep-link effect (:629-676) early-returns when `open` is false and does **not** reset `focusNotice`; the modal is **always-mounted** (ClientPortal :6325). 
**Repro:** deep-link a deleted/unauthorized event → the safe notice shows (correct) → close → reopen the calendar normally → the stale `role=alert` error is shown at the top of the dialog for everyone.
**Fix (Track B's):** clear `setFocusNotice("")` in an effect keyed on `open` → false (and/or in `onFocusConsumed`). Low risk, single component.

### F1 — Support-ticket deep-link loses focus during lazy-load (reported by Track B)
`src/ClientPortal.jsx` `openSupportTicket` (:712-715, dispatched from `navigateNotification` :729) calls `setModule("help")`, but `Help` is `lazy()` (:114). During the chunk fetch + `loadTickets()` gap the bell dropdown has already closed, so focus sits on `<body>` → screen-reader / keyboard users hear nothing until the modal mounts. (The calendar path is fine — always-mounted overlay.)
**Fix (Track B's):** hand focus to `<main>` / a loading region during the Suspense gap on the ticket branch.

## MINOR — follow-ups (not ship-blockers)
- **F4** role=alert node is also focused → double-announce (CalendarModal :621-623/:1132; Help :1479-1481/:1638). Use `role=status` or alert-without-focus. (Track B will fix this one too — trivial.)
- **F3** nested `aria-modal=true` (calendar + event editor coexist) — consider `inert`/toggle while the editor is open. Touches modal nesting → wider blast radius; decide at user level.
- **F5** `useOverlayDismiss.js` (:22-56) moves/restores focus but does **not** Tab-trap; comments in Help (:1129) and ClientPortal (:720) overstate "traps focus" — a sighted keyboard user can Tab into the background shell (`aria-modal` limits SR impact). Fix: `inert`/`aria-hidden` background or a focusable boundary, or soften the comments. Touches the shared hook → decide at user level.

## Verified CORRECT (no action)
Overlay navigation skips `<main>`; lead/module nav focuses `<main>`; dialog labeling; Escape + Android-back close; focus restoration on close; role=alert focusable+announced for the primary flow. Parser 9/9 (Track B) and deep-link unit tests 43/43 pass; web build green.

## Status / next (needs user decision)
- **Deep-links are NOT merge-ready** on either line until F1 + F2 land.
- Track B will fix F1 + F2 + F4 on their mobile candidate and re-run their a11y gate; they offered the verified fix diff to mirror onto the consolidated source.
- Track A is holding `aa278d1` frozen and will **not** apply UI fixes without the user's authorization (UI change; af5c254 intent/provenance still unconfirmed by the user). F3/F5 are user-level decisions (shared hook / modal nesting).
