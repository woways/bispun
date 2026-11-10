# Bispun CRM — Regression Testing Checklist

**Date:** 2026-11-09 · **Branch:** main @ `2aceef9`
**Companion to:** `BISPUN-IMPLEMENTATION-STATUS-2026-11-09.md`, `BISPUN-PENDING-FEATURES-ROADMAP.md`

Use this before any merge/deploy. It mixes **automated gates** (run now) with **manual checks** (need Dev login / Google / Firebase / Android device). Boxes are unchecked — this audit did **not** perform the manual runtime checks (they require authorized test sessions and credentials). Mark `PASS` / `FAIL` / `BLOCKED` as you go.

---

## Session-2 fix verification (branch `feat/bispun-audit-fixes-mobile-completion`)

Automated (run now): `node --test $(find server src -name "*.test.js")` → expect **75/75**.
- [ ] `callHistoryWhere` (3) — telephony scope
- [ ] `canModifyCalendarEvent` (6) — calendar edit/delete authz
- [ ] `parseNotificationTarget` (6) — notification deep-link id
- [ ] `buildLeadsBySource` (5) — donut counting (direct admissions / unspecified / zero data)

Manual (need Dev login):
- [ ] Employee cannot load a colleague's lead call history via `GET /telephony/history?leadId=` / `?phone=` (only own + visible-lead calls).
- [ ] Non-creator/non-assignee employee gets 403 on PATCH/DELETE of another user's calendar event; admin still can.
- [ ] Clicking a lead follow-up notification opens the **exact lead** (web); focus lands in main content.
- [ ] Dashboard "Leads by Source": donut center number **equals** the sum of the legend slices, including a Direct Admission bucket when present.

## Mobile emulator — manual QA result (USER-REPORTED, 2026-11-09)

> **USER-REPORTED PASS — 19 / 19 (0 FAIL, 0 BLOCKED).** The project owner personally tested the Android app on the **Pixel_6 emulator** using the authorized Development **CLIENT_ADMIN** account and reported all items passing: Dashboard KPIs+refresh; Lead Store (list/search/details/filters/Remarks/Activity History/Follow-up/Smart Nurture); Admissions; Finance; Bottom nav + More sheet; Chats + unread badges; Calendar; Notifications + exact-lead navigation; Android hardware Back; Session restoration; Backend-unavailable/retry; CLIENT_ADMIN module visibility; native phone/SMS/WhatsApp; Request Account Deletion option visibility; Logout. Observations: none.
> **This is a user-reported result on Development** (debug build against the local dev backend); it was **not** independently reproduced by the agent, and it is **not** a Production/release-build QA sign-off (see §release-build QA below).

## Mobile emulator — manual QA checklist (human-run, 2026-11-09)

Environment ready now: Pixel_6 emulator (`emulator-5554`) with the fresh debug APK installed; dev backend on host `:4000` (workers disabled, DB connected); app points at `http://10.0.2.2:4000`. Log in as `bispun.qa.admin@example.com` (set the password first — see the safe procedure in `BISPUN-MOBILE-STAGE-STATUS.md`). Mark each PASS / FAIL / BLOCKED and note any bug.

| # | Test | Expected | Result |
|---|------|----------|--------|
| 1 | Login (valid creds) | Lands on Dashboard | ☐ |
| 2 | Login (wrong password) | Clear inline error, no crash | ☐ |
| 3 | Session restoration (kill + reopen app) | Returns to Dashboard, no re-login | ☐ |
| 4 | Background → foreground (Home, reopen) | State preserved, no blank screen | ☐ |
| 5 | Dashboard | KPIs + Leads-by-Source render; donut center = legend sum | ☐ |
| 6 | Lead Store | List loads; open a lead; search/filter work | ☐ |
| 7 | Admissions | List loads; open a record | ☐ |
| 8 | Finance / Revenue | Loads; figures render | ☐ |
| 9 | Calendar | Renders; open an event; create/edit only if authorized | ☐ |
| 10 | Notifications | List + unread badge; tapping a lead notification opens the exact lead | ☐ |
| 11 | More menu | Opens; only permitted modules shown | ☐ |
| 12 | Bottom navigation | Switches modules fast; active state correct | ☐ |
| 13 | Native actions | Phone dial / SMS / WhatsApp open from a lead | ☐ |
| 14 | Android hardware back | Closes overlays first, then module back, exits only at root | ☐ |
| 15 | Role/permission visibility | Employee sees only permitted modules/leads | ☐ |
| 16 | Tenant isolation | No data from another company visible | ☐ |
| 17 | Network failure/retry | Graceful "Can't reach the server" + Try again (stop backend to test) | ☐ |
| 18 | Logout | Returns to Login; token cleared; re-login works | ☐ |

Already verified by the agent (no need to re-test): install, launch, splash branding, splash→login routing, login-screen render, backend reachability, graceful offline state, no crash on launch.

## 0. Pre-flight (automated — safe to run anytime)

```bash
git fetch origin && git status
```
- [ ] Local `main` not behind `origin/main` (was 4 behind at audit start; fast-forwarded to `2aceef9`).

```bash
node --test $(find server src -name "*.test.js")
```
- [ ] All 9 test files pass (expect **55/55**). ⚠️ `npm test` alone only runs 4 of them.

```bash
npm run build
```
- [ ] `vite build` exits 0, `dist/` generated.

```bash
npx prisma validate
```
- [ ] Schema valid.

**Prisma client freshness (catches the designation/level trap):**
```bash
grep -c "designationId" node_modules/.prisma/client/index.d.ts
```
- [ ] Returns **> 0** after you run `prisma generate`. (At audit time it was **0** = stale.)

---

## 1. 🔴 Critical DB gate (run before trusting Users/Roles)

> **Status 2026-11-09:** ✅ Migration `0002` **APPLIED** to Dev blue-mouse; Prisma Client regenerated; columns + indexes + data-layer queries + `/api/health` verified. The boxes below are confirmed in Dev **except** the interactive Add/Edit-User UI workflow (still to do manually with a login session). `npm test` now runs all 12 suites.

- [ ] Dev DB `User` table has `designationId`, `levelId`, `levelName` (at audit time: **MISSING**). Verify via Neon SQL editor or an `information_schema` read.
- [ ] Prisma client regenerated after schema change (see §0).
- [ ] `User.leadStoreColumnOrder` exists (confirmed EXISTS at audit — ARRAY default `ARRAY[]::text[]`).
- [ ] `DeviceToken` table exists (migration `0001`) — else device-token register/unregister 500.
- [ ] After migration: open **Settings → Users & Roles** → list loads, create user, edit user, assign designation + level → all succeed (no 500).

---

## 2. Authentication, roles & tenant isolation (highest priority)

- [ ] Login as **Employee**, **Manager**, **Client Admin**, and confirm **Super Admin is rejected** from the client portal (`clientAuth.js:72,182`).
- [ ] **Lead Store visibility:** Employee sees only own/assigned leads; Manager sees team (and their no-department case); Admin sees all.
- [ ] **Cross-company isolation:** with two companies seeded, user A (company 1) cannot see/fetch company 2's leads, UTM links, admissions, calendar events, chats, users (try direct id in URL/API).
- [ ] **Dashboard widget permissions:** restricted role does not receive gated sections (payload omits them; KPI/action-center detail routes 403).
- [ ] **Users management scope:** Manager can only edit EMPLOYEEs in their subtree, cannot change roles or grant perms beyond their own.
- [ ] 🟠 **Telephony `GET /history`:** confirm whether an employee can read another user's lead call history (current code: **not visibility-scoped** — expected FAIL until fixed).
- [ ] 🟠 **Calendar private events:** confirm whether a non-organizer can read/edit/delete another user's event + open its Meet link (current code: **no protection** — expected FAIL until fixed).

---

## 3. Dashboard

- [ ] KPI tiles render with correct values for the selected year; drill-down modals reconcile with tiles.
- [ ] 🟡 **Leads by Source:** donut center total **equals** the sum of the legend slices (expected mismatch when direct admissions exist — see roadmap #7).
- [ ] "Unspecified" and "Direct Admission" buckets appear correctly.
- [ ] Action Center rows: "Open lead" opens the **exact** lead detail (not just the module).
- [ ] Responsive layout on mobile widths (manual/visual).

---

## 4. Lead Store

- [ ] Create / edit lead (name + phone validation; primary-phone change blocked by design).
- [ ] Search + filters (type/year/temperature/status); Course/Interest autocomplete.
- [ ] Lead Details open; Lead ID displayed (note: derived sequential, may shift).
- [ ] **Saved column ordering:** reorder columns as Admin/Manager → reload → order persists (GET/PATCH `/column-preferences`). Employees get fixed default (by design).
- [ ] Notes/Remarks CRUD; Activity history shows calls/emails/whatsapp.
- [ ] Import CSV **and** XLSX (dedup, caps 5000 rows/5MB); Export (CSV only currently).
- [ ] Smart Nurture: enroll a lead (respects visibility), steps schedule; reply/terminal-status stop. (Needs Gmail/WhatsApp connection.)
- [ ] Dial & Track: log a call; verify it syncs to activity.

---

## 5. Notifications

- [ ] Notification list loads; unread badge correct; decrements on read.
- [ ] 🔴 **Lead notification → click opens the exact lead** (current code: **BROKEN** — opens module only; expected FAIL until roadmap #2).
- [ ] Other module notifications route to the right module.
- [ ] Notification preferences toggle and are respected by producers.
- [ ] (No volume control exists yet — N/A.)

---

## 6. Users & Departments

- [ ] Department dropdown loads company-specific departments (defaults + custom).
- [ ] Designation/Level dropdowns populate and save (blocked until §1 migration).
- [ ] Loading / empty / **Retry** states on the department dropdown; note users-list failure currently has no Retry.
- [ ] Add/Edit/Reset-password workflows; self-demote / self-deactivate blocked.

---

## 7. UTM Leads

- [ ] Create UTM link (generate + manual modes); URL validation rejects bad input.
- [ ] Import modal attribution dropdown stamps `utmLinkId` on imported leads.
- [ ] Lead attribution persists on create/import (note: PATCH can't change it later).
- [ ] UTM Analytics figures reconcile with leads/admissions (note: **not role-scoped**; "Clicks" always 0 — tracking not implemented).
- [ ] Cross-company: cannot attribute to or view another company's UTM link.

---

## 8. Google Calendar & Meet  (⛔ needs Google OAuth creds — BLOCKED without them)

- [ ] `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` + `CLIENT_URL` configured.
- [ ] Connect popup launches from inside Calendar; status polls to "connected".
- [ ] Employee (no Settings access) can connect their own Google.
- [ ] Create event with Meet → link appears (or clean "pending" state); reopen behavior.
- [ ] Calendar opens without crashing (the FragmentRow crash fix, commit `32f58bc`).
- [ ] Verify no unexpected invite emails are sent (no `sendUpdates`).

---

## 9. Mobile CRM (Android)  (⛔ needs device/emulator + Firebase — BLOCKED without them)

- [ ] Debug build installs and launches (native splash shows).
- [ ] Login persists across cold start (session restoration).
- [ ] Bottom nav + More menu; all authorized modules reachable; Logout works from mobile.
- [ ] Android hardware back: overlays close first → module back → exit at root (no accidental exit).
- [ ] Native actions: WhatsApp / SMS / phone dial from a lead.
- [ ] Firebase push: receive a notification; tap routes to the right module (note: record-level deep link currently missing).
- [ ] KPI/grids readable; tap targets ≥44px.
- [ ] **Release build:** currently **blocked** — no signing config/keystore (roadmap #12).

---

## 10. Existing-module regression sweep (no functionality lost)

Quick "opens + loads data + core action works" pass for each:
- [ ] Dashboard  [ ] Lead Store  [ ] UTM Leads  [ ] Admissions  [ ] Revenue  [ ] Finance (expenses/incentives in Revenue)  [ ] Walk-ins  [ ] Counselling  [ ] Analytics  [ ] Chats (real-time send/receive)  [ ] Goals & Targets  [ ] My Store (templates; AI gen "coming soon")  [ ] My Referrals  [ ] Settings (SMS "coming soon")  [ ] Help & Support  [ ] Subscription/Billing (Razorpay)  [ ] Super Admin
- [ ] Confirm no console errors / 500s on module open.

---

> **HOLD 2026-11-09:** Production release and branch cleanup are ON HOLD by owner decision. The deploy gate below is prepared for a future approved release — do not execute it now.

## 11. Deploy gate (prod parity) — updated 2026-11-09

**Production schema verification (PR #13 dependency): ✅ PASS.** Confirmed by the operator via the Neon SQL Editor on `consulbuzz-production` / branch `production` / `neondb`: `User.designationId`, `User.levelId`, `User.levelName` all exist (text). → **Do NOT apply migration `0002` to Production** (already present). PR #13 itself changes **no** schema/migration files, so it introduces **no new Production schema requirement**.

Controlled main-merge + Production deployment checklist (for PR #13):
- [x] Prod has designation/level columns (operator-verified) — PASS
- [x] PR #13 adds no new migration/schema dependency (verified: `git diff` shows no schema files)
- [x] PR #13 mergeable & CLEAN; Vercel **preview** build SUCCESS; `npm test` 75/75; local build OK
- [ ] **(pending) Operator confirms `DeviceToken` table exists in Production** (migration `0001`, a pre-existing push dependency — NOT added by PR #13; without it, device-token register/unregister 500s but push dispatch is guarded).
- [ ] **(pending human approval) Authorize the `main` push → Vercel Production deploy.** A merge to `main` deploys the web app to Production.
- [ ] After deploy: verify Production `/api/health`, login/session, Users & Roles page loads, Leads-by-Source donut total, a lead notification opens the exact lead.
- [ ] Prod env vars for the dormant features when wanted: `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` (+ `CLIENT_URL`), `FIREBASE_SERVICE_ACCOUNT`/`GOOGLE_APPLICATION_CREDENTIALS` (these are NOT required for PR #13's fixes to work).

**Web/Backend vs Android (release separation):** merging PR #13 → `main` deploys the **web app** via Vercel only. The **Android (Capacitor)** app is a **separate build/signing/Play-Store release** and is NOT shipped by the `main` push. Therefore the Android device-test / signing gates (§9 #12–#13) **do not block this Web/Backend release** — they gate a future Android release only.

---

*Items flagged 🔴/🟠/🟡 correspond to known defects/gaps in the roadmap; they are expected to FAIL until fixed. Everything else is "verify no regression." This checklist was authored from static review + automated checks; the manual sections were not executed during the audit.*
