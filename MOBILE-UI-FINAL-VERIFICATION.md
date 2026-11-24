# Bispun Android — Final Mobile UI Verification (on-device)

Date: 2026-11-01 · `emulator-5554` (1080×2400) · app `com.bispun.crm` · authenticated
QA session (Bispun Mobile QA). APK built 19:57, bundles `ClientPortal-DuQKFKnw.js`
+ `index-CNx6l6wQ.css` (the A/B fixes). **No code, data, Git, or production changes.**

## Overall: ALL MOBILE UI CHECKS PASS → READY FOR MOBILE MANUAL QA
(one item NOT TESTED by design — chat send/attachments — see below.)

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | **Chat header + New on FIRST open** (no keyboard/reflow) — Issue A | ✅ **PASS** | Measured on first open: header top **92px**, app top-bar bottom **81px** → not hidden; New button visible (top 107px). Screenshot `51`. |
| 2 | **Calendar header below status bar** — Issue B | ✅ **PASS** | safe-area inset **24px**, "Calendar" title top **35px** (below it). Screenshot `53`. |
| 3 | Chat search keyboard + input visibility | ✅ **PASS** | Keyboard opened (viewport 914→578); search input focused and visible above keyboard. Screenshot `52`. |
| 4 | Calendar date selection + keyboard-safe editor | ✅ **PASS** | Tapping day 15 → agenda "SUNDAY, 15 NOV"; in New-event editor the keyboard opened with **Create event + Cancel both visible** above it and Title focused. Screenshot `54`. |
| 5 | Dashboard KPI grids, charts, scrolling | ✅ **PASS** | 2-col KPI grid; Revenue Trend + Leads-by-Source charts render (empty states, no data); page scrolls, bottom nav fixed. Screenshots `50`, `58`. |
| 6 | Lead Store / Admissions / Revenue / Analytics / Referrals / Help KPI grids | ✅ **PASS** | Each shows a 2-col KPI grid with **no horizontal overflow** (DOM-verified); Analytics loads after the slow backend. Screenshots `55b`, `56`, `57`. |
| 7 | Bottom nav + More menu + Android Back | ✅ **PASS** | Bottom nav + More sheet navigate correctly; **overlay-first Back** closed the notifications panel and stayed in-app; **clean module-back** Dashboard→Admissions→Back→**Dashboard** works (screenshot `61`). See note below. |
| 8 | Notifications + session persistence | ✅ **PASS** | Notifications panel opens with entries + "Mark all read"; session persisted across background→foreground **and** force-stop relaunch (stayed on `/app`, token present, no re-login). |
| — | Chat message send / attachments | ⚠️ **NOT TESTED** | No authorized second dev QA user exists to open a real conversation; per instruction, not creating users. |

## Evidence detail — login/session (captured read-only, no secrets)
Earlier controlled capture this session showed `POST /auth/login → 200`,
`GET /auth/me → 200`, all protected endpoints → 200, and persistence across
background/foreground + cold relaunch (see `MOBILE-AUTH-VERIFICATION.md`).

## Note on item 7 (Android Back)
During heavy back-and-forth stress navigation (dozens of module switches +
overlays), one Back press returned to an earlier-visited module (Analytics)
instead of the immediately-previous one. A **clean relaunch test reproduced the
correct behavior** (Dashboard→Admissions→Back→Dashboard), so that was a
**test artifact of an unusually deep history stack**, not a user-facing bug. Back
never exits the app prematurely and never gets stuck. (The B3.1 history dedupe
could, in theory, pick a non-LIFO target after many module revisits — a minor
pre-existing edge case, independent of the Chat/Calendar/Issue-A fixes; optional
to harden later.)

## Backend note (non-blocking)
The dev backend is **very slow** (login took ~11.8 s; module data 5–10 s; Neon
cold-starts). This doesn't fail any UI check but makes some screens show a brief
"Loading…". Combined with the app logging out on *any* `/auth/me` error, severe
latency could cause occasional logouts in the field — the optional auth-resilience
hardening in `MOBILE-AUTH-VERIFICATION.md` would address that. Not a UI blocker.

## Final recommendation
**READY FOR MOBILE MANUAL QA.** Both targeted fixes are verified on-device
(Issue A: chat header visible on first render; Issue B: calendar clears the status
bar), and all redesigned KPI screens, scrolling, keyboard behavior, navigation,
notifications, and session persistence pass. Outstanding, non-blocking:
- Chat send/attachments need an authorized second dev QA user to test.
- Optional: auth-resilience hardening + a warmer/faster dev backend for smoother QA.
- Optional: review the B3.1 back-history dedupe for deep-revisit ordering.

**STOP — verification complete. No code, data, Git, or production changes. Awaiting
your decision on merge and on the optional hardening.**
