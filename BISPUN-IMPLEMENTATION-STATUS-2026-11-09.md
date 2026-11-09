# Bispun CRM — Implementation Status Audit

**Date:** 2026-11-09
**Repository:** https://github.com/woways/bispun
**Local directory:** S:\Bispun
**Branch:** main
**HEAD at audit time:** `2aceef9` (Merge PR #11 — permissions phase 2 enforcement)
**Audit type:** Read-only. No code, database, migration, or GitHub changes were made during the audit. (One local fast-forward of `main` to `origin/main` was performed at the user's explicit request — see §1.)

> **How to read this report.** Implementation status and Test (verification) status are **separate dimensions**. "FULLY IMPLEMENTED" means the code to do the job exists and looks complete on static reading — it does **not** mean it was proven to work. Only rows with Test status **PASS** were exercised by a real automated test (named in Evidence). Most of the codebase has **no runtime/integration test**, so the honest default is **NOT TESTED**. Google-, Firebase-, and Android-dependent runtime behavior is **BLOCKED** (credentials / emulator unavailable).

---

## 1. Project state (Step 1)

| Check | Result |
|---|---|
| Current branch | `main` |
| Local HEAD before audit | `118a333` (PR #9 — admissions/notifications/calendar) |
| `origin/main` at audit time | `2aceef9` — **4 commits ahead of local** |
| The 4 remote commits | `2aceef9` merge PR #11, `72740a9` Enforce user permissions across CRM APIs, `2c5f19d` merge PR #10, `5dda691` Enhance users roles departments designations and levels |
| Action taken | **Fast-forward** of local `main` → `2aceef9` (user-requested "clone the last 2 days of changes"). No merge commit, no push. Untracked files and uncommitted work preserved. Reversible via `git reset --hard 118a333`. |
| Worktrees / uncommitted files | Preserved (the ~50 untracked `MOBILE-*.md`/`BISPUN-*.md` report files and `android/local.properties.bak`, `scripts/provisionQaTestCompany.js`, `docs/DEVELOPER_SETUP.md` are untouched). |
| Production build (`npm run build`) | ✅ **PASS** — `vite build` exit 0, `dist/` generated in ~29s. Only a chunk-size warning (charts bundle 726 kB). |
| Automated tests | ✅ **55/55 pass** across 9 test files (see §4). ⚠️ `npm test` runs only 4 of the 9 files. |
| Prisma schema | ✅ `prisma validate` → valid. |
| Backend live boot | **Not performed by design** — `server/index.js` auto-starts the nurture worker + calendar-reminder worker on boot (unless `DISABLE_BACKGROUND_WORKERS=true`), which can send real emails/notifications. A live HTTP health check (`GET /api/health` exists, line 153) was intentionally skipped to honor the "no external messages" rule. All key server files pass `node --check`. |

**Tech stack:** React 18 + Vite SPA, Express 5 + Prisma 7 (PostgreSQL / Neon) backend, Socket.IO for chat, Capacitor 8 wrapping the same SPA for Android/iOS. "Mobile" is the responsive web UI (`lg:hidden` components) plus native plugins — there is **no separate mobile code tree**. Package name is `consulbuzz`.

---

## 2. Database verification (Step 3)

Checked **read-only** against the Development DB (Neon **blue-mouse**, `ep-blue-mouse-...neondb`) via an `information_schema` query. Both `.env` and `.env.development` point to the **same** blue-mouse DB (no separate prod URL in these files — prod env is managed elsewhere, e.g. Vercel). 60 public tables.

| Column (`User` table) | In schema.prisma | In generated Prisma Client | In Dev DB (blue-mouse) | Status |
|---|---|---|---|---|
| `leadStoreColumnOrder` | ✅ (line 281, `String[] @default([])`) | ✅ (139 refs) | ✅ **EXISTS** (ARRAY, default `ARRAY[]::text[]`) | **OK — confirmed end-to-end** |
| `designationId` | ✅ (line 272) | ❌ **0 refs (stale client)** | ❌ **MISSING** | **BROKEN / NEEDS MIGRATION** |
| `levelId` | ✅ (line 273) | ❌ | ❌ **MISSING** | **BROKEN / NEEDS MIGRATION** |
| `levelName` | ✅ (line 274) | ❌ | ❌ **MISSING** | **BROKEN / NEEDS MIGRATION** |

### 🔴 Critical DB finding (three-way mismatch)
The just-merged PRs #10/#11 added `designationId`/`levelId`/`levelName` to the `User` model, **but**:
1. The **generated Prisma Client on disk is stale** — it predates these fields (0 references).
2. The **Dev DB is missing the columns** — the pending migration `prisma/pending-migrations/0002_add_user_designation_and_level.sql` has **not** been applied. (The project uses `prisma db push`; there is **no `prisma/migrations/` directory**, so the `pending-migrations/*.sql` files are **manual, out-of-band** scripts that `db push` does not run automatically.)
3. `server/routes/clientUsers.js` actively **reads and writes** these columns — e.g. create writes `designationId`/`levelId`/`levelName` (clientUsers.js:965), `updateMany({ where: { ..., designationId } })` (:600), `count({ where: { ...designationId } })` (:620), and the Users list uses the default projection (`findMany`, :728) which selects all scalar columns.

**Consequence:** in the current Dev environment, the entire **Users & Roles** page and user create/update **will throw** (`column "designationId" does not exist` after client regen, or "Unknown field" with the current stale client → HTTP 500). Login still works because `clientAuth.js` uses an **explicit column list** (:96–120) that omits these three columns — so you get a confusing *partial* failure (can log in, Users page broken).

**Fix required before any deploy:** apply `0002_add_user_designation_and_level.sql` (or `prisma db push`) to **every** environment, then run `prisma generate`. Same class of risk applies to `DeviceToken` (migration `0001`): push dispatch swallows a missing table (pushDispatch.js:89) but `clientDeviceTokens.js` register/unregister would 500.

---

## 3. Executive summary

**Total discrete requirements audited (areas A–H): 83** (plus the DB/infra findings in §2).

### Implementation status
| Status | Count |
|---|---|
| ✅ FULLY IMPLEMENTED | 57 |
| 🟡 PARTIALLY IMPLEMENTED | 17 |
| ⚪ NOT IMPLEMENTED | 3 |
| 🔴 BROKEN | 2 |
| ⚙️ NEEDS CONFIGURATION | 3 |
| ❓ CANNOT DETERMINE | 1 |
| **Total** | **83** |

### Verification (test) status — a separate dimension
| Status | Count | Meaning |
|---|---|---|
| ✅ PASS (real automated test) | 7 | Asserted by a named unit test |
| 🔴 FAIL (tested & failed) | 1 | E4 — verified against live Dev DB: columns missing → user mgmt errors |
| ⛔ BLOCKED (missing prerequisite) | 3 | A11 Google OAuth, D8 Firebase delivery, G13 Android device runtime (plus the larger Google/Android *runtime* behavior behind many FULLY rows) |
| ⚪ NOT TESTED | 72 | Code exists; no automated or runtime verification performed |

**Headline conclusions**
- **No existing module was lost.** All 17 CRM modules (Area H) are present, routed, and backed by a route + schema model. Two intentional "coming soon" sub-features only (My Store AI image gen; Settings SMS channel).
- **The newest work (designation/level/permissions) is code-complete but currently BROKEN in Dev** due to the unapplied migration + stale Prisma client (§2). This is the #1 fix.
- **One functional defect found by static reasoning (not just untested): lead-notification deep links don't open the specific lead** (the backend strips the id marker before sending) — web and mobile both fall back to the module landing (D5/D7).
- **Three security/correctness gaps worth prioritizing:** no private-event protection in Calendar (A5), telephony call-history not visibility-scoped (C10), and name-based lead visibility is fragile/case-inconsistent (C area risk).
- **Config gaps block external features:** Google OAuth env vars (A11), Firebase credentials (D8), and Android release signing/keystore (G12) are all undocumented/absent.
- **One counting bug:** dashboard donut center total ≠ sum of its slices when direct admissions exist (B1/B3).

---

## 4. Automated test inventory (what actually has PASS evidence)

All 9 files pass (`node --test`, 55 assertions). ⚠️ `package.json`'s `test` script runs only the first 4 — the 5 `src/lib/*.test.js` mobile/UI tests are **not in CI**.

| Test file | In `npm test`? | Asserts (summary) |
|---|---|---|
| `server/lib/leadVisibility.test.js` | ✅ | EMPLOYEE self-only, MANAGER+dept team, CLIENT_ADMIN all, `canViewLead`, employee `where` clauses. (No-dept-manager branch & async DB path NOT asserted.) |
| `server/lib/pageAccess.test.js` | ✅ | Section grants (dashboard/finance/insights), CLIENT_ADMIN bypass, `applyAdmissionScope`. (Pure helpers only — not the Express middleware.) |
| `server/lib/pushService.test.js` | ✅ | Token masking, sensitive-type generic payload (no PII), error classification, `buildPushMessage`. (No real FCM send.) |
| `server/lib/pushDispatch.test.js` | ✅ | Deliverable-token selection, rollback guard, no-userId early return. (Mock Prisma.) |
| `server/lib/listViewState.test.js` | ❌ | `resolveListView` error-vs-empty logic. (⚠️ not wired into LeadStore; used only in Help.jsx.) |
| `src/lib/backStack.test.js` | ❌ | Overlay back-handler LIFO order, unregister idempotency. |
| `src/lib/moduleBack.test.js` | ❌ | Single-slot module-back, StrictMode-safe unregister, true-only "handled". |
| `src/lib/logoutFlow.test.js` | ❌ | Concurrent push-unregister + logout, clears token once, bounded navigation on hang/401/network-fail. |
| `src/lib/mobilePush.pluginLoad.test.js` | ❌ | Capacitor proxy `.then` regression guard only (not permissions/token/tap). |

---

## 5. Full requirement matrix

Legend — **Impl:** FULLY / PARTIAL / NOT IMPL / BROKEN / NEEDS CONFIG / CANNOT DETERMINE. **Test:** PASS / FAIL / BLOCKED / NOT TESTED.

### A. Google Calendar & Meet

| ID | Feature | Requested behavior | Impl | Test | Evidence | Remaining work | Priority |
|---|---|---|---|---|---|---|---|
| A1 | Connect popup in Calendar | OAuth consent popup launched from inside Calendar | FULLY | NOT TESTED | `CalendarModal.jsx:546-573,2261-2323`; `clientGoogle.js:68` `/connect` | Handle blocked-popup (`window.open`→null) | Low |
| A2 | Connect button (unlinked users) | Show Connect when no Google account linked | FULLY | NOT TESTED | `CalendarModal.jsx:784-792,2304-2319`; `clientGoogle.js:38` `/status` | Add a standalone Connect affordance (currently only on save/401) | Low |
| A3 | Employee personal Google w/o Settings | Any user connects from Calendar, no Settings access | FULLY | NOT TESTED | `CalendarModal.jsx:376-383`; `clientGoogle.js:68` guarded only by `requireClientUser` | Fix error copy that says "Settings → Integrations" | Low |
| A4 | Company-shared meetings | Meetings visible to the company | PARTIAL | NOT TESTED | `clientCalendar.js` GET filters `{companyId}` | No attendee model beyond single `assignedToUserId`; "shared"="whole company" | Medium |
| A5 | Private event access protection | Restrict who can see/edit an event | **NOT IMPL** | NOT TESTED | `clientCalendar.js` GET/PATCH/DELETE scope by `companyId` only | **Any company user can read/edit/delete every event + open its Meet link.** Add owner/private visibility | **High (security)** |
| A6 | Organizer identification | Show who organized | FULLY | NOT TESTED | `CalendarModal.jsx:1408-1416`; `clientCalendar.js` formatEvent | Label conflates assignee/organizer | Low |
| A7 | Prevent unexpected meetings | Don't push events into others' calendars unexpectedly | PARTIAL | NOT TESTED | `google.js:118-136` — no `sendUpdates` (no invite emails) | Attendees still attached to Google event (google.js:128); unverified | Medium |
| A8 | Meet link generation (sync/async) | Create Meet link immediately or async | FULLY | NOT TESTED | `CalendarModal.jsx:803-835`; `google.js:112-172` (poll ≤5×800ms, 202 pending) | ~4s poll may expire; no background reconcile | Medium |
| A9 | Pending/failed Meet states | Represent pending & failed link states | PARTIAL | NOT TESTED | `CalendarModal.jsx:821-835,1135-1145`; `google.js:163` | **Not persisted** — no Meet-status column on `CalendarEvent`; pending link lost on save | Medium |
| A10 | Calendar crash fix | Connect dialog no longer crashes FragmentRow | FULLY | NOT TESTED | Dialog now in `CalendarModal.jsx:2261-2323`, not FragmentRow (commit `32f58bc`) | Add regression test | Low |
| A11 | Google OAuth configuration | OAuth client id/secret/redirect set | NEEDS CONFIG | BLOCKED | `google.js:5-9` reads `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`; **absent from `.env.example`, not validated in `env.js`** | Add + validate env vars; `GOOGLE_REDIRECT_URI` silently defaults to localhost | **High** |

### B. Dashboard

| ID | Feature | Requested behavior | Impl | Test | Evidence | Remaining work | Priority |
|---|---|---|---|---|---|---|---|
| B1 | Leads by Source total accuracy | Totals match | PARTIAL | NOT TESTED | `Dashboard.jsx:1483-1486`; `clientAnalytics.js:535,623-649` | **Counting bug:** donut center (`totalLeads`=leads.length, excludes direct admissions) ≠ legend sum (includes Direct Admission bucket) | Medium |
| B2 | Unspecified source handling | Blank source → "Unspecified" | FULLY | NOT TESTED | `clientAnalytics.js:625-636` | Shares B1 reconciliation | Low |
| B3 | Direct Admission source counts | Count direct-entry admissions | PARTIAL | NOT TESTED | `clientAnalytics.js:493-531,642-644` | Correctly computed but excluded from Total Leads (→B1) | Medium |
| B4 | Action Center clickable leads | Rows open the lead | FULLY | NOT TESTED | `Dashboard.jsx:1594-1618,2460-2466`; `clientAnalytics.js:1349-1705` carry `leadId` | Items without leadId fall back to module nav (OK) | Low |
| B5 | Exact Lead Details navigation | Open the exact lead | FULLY | NOT TESTED | `Dashboard.jsx:518-523`→`ClientPortal.jsx:600-605`→`LeadStore.jsx:3284-3328` | Confirm `/lead-store/manual` fetch enforces visibility | Low |
| B6 | Dashboard widget permissions | Role-gated widgets | FULLY | PASS* | Backend strips sections `clientAnalytics.js:1020-1041`, 403 gates `:1062,1351`; `pageAccess.test.js` | *Helper tested; route gating untested | Low |
| B7 | KPI values / filter / responsive | Accurate, filterable, responsive | PARTIAL | NOT TESTED | `Dashboard.jsx:1276-1301,2523-2650`; year scope `clientAnalytics.js:325-328,1102-1105` | Responsiveness needs visual QA | Low |

### C. Lead Store

| ID | Feature | Requested behavior | Impl | Test | Evidence | Remaining work | Priority |
|---|---|---|---|---|---|---|---|
| C1 | Employee assigned-only | Employee sees only own leads | FULLY | **PASS** | `leadVisibility.js:67-68`; `clientLeadStore.js:2730-2758`; `leadVisibility.test.js` | Name-match fragility (see risks) | Medium |
| C2 | Manager dept/team access | Manager sees team | FULLY | **PASS** | `leadVisibility.js:45-65`; test:32-37,96-100 | No-department-manager branch untested | Medium |
| C3 | Client Admin company-wide | Admin sees all | FULLY | **PASS** | `leadVisibility.js:41-43,155`; test:39-51,90-94 | — | Low |
| C4 | Cross-company security | No cross-tenant leakage | FULLY | NOT TESTED | Every query carries `companyId` (`clientLeadStore.js:2264,2720,3081`; `clientLeads.js:504-537`) | No integration test proving isolation | **High (verify)** |
| C5 | Lead Details + Lead ID | Show details & a Lead ID | FULLY | NOT TESTED | `LeadStore.jsx:336-340,1007`; `clientLeadStore.js:2777-2801` | Lead ID is **derived sequential** (recomputed per fetch), not persisted → not stable | Medium |
| C6 | Search, filters, views | Search/filter + saved views | PARTIAL | NOT TESTED | `LeadStore.jsx:3545-3576`; `clientLeadStore.js:2760-2773` | `resolveListView` tested but NOT wired into LeadStore; "saved views"=column order only | Low |
| C7 | Course / Interest dropdown | Choose course/interest | FULLY | NOT TESTED | `LeadStore.jsx:1184-1210` `<datalist>` | Free-text + autocomplete (not a constrained enum) | Low |
| C8 | Lead creation & editing | Create/edit leads | FULLY | NOT TESTED | `LeadStore.jsx:663-976`; `clientLeadStore.js:4373-5258,3365-3761` | Blocks primary-phone change by design; no test | Low |
| C9 | Smart Nurture | Automated nurture sequences | FULLY | NOT TESTED | `nurtureEngine.js` (full); `clientNurture.js:240-253` enforces visibility | Needs Gmail/WhatsApp connections; no engine test | Medium |
| C10 | Dial & Track | Log calls, track dialing | PARTIAL | NOT TESTED | `clientTelephony.js`; `CallRecord` schema:1936 | **`GET /history` (:136-158) scoped by companyId only, NOT visibility** → employee can read others' call history | **High (security)** |
| C11 | Import & Export | Import + export leads | PARTIAL | NOT TESTED | Import CSV+XLSX `clientLeadStore.js:1247-1662,5270,5520`; export `LeadStore.jsx:3998-4050` | **Export is CSV-only, client-side** (no server/xlsx export) | Low |
| C12 | Saved table column ordering | Persist column order | FULLY | NOT TESTED | `GET/PATCH /column-preferences clientLeadStore.js:265-341`; `User.leadStoreColumnOrder` (**DB col confirmed present**) | Per-user; only ADMIN/MANAGER may reorder (by design) | Low |
| C13 | Notes/Remarks & Activity | Remarks + activity history | FULLY | NOT TESTED | `clientLeadStore.js:4144-4359`; `LeadRemark`/`LeadCommunication` schema | All mutations run `ensureLeadInScope` | Low |

### D. Notifications

| ID | Feature | Requested behavior | Impl | Test | Evidence | Remaining work | Priority |
|---|---|---|---|---|---|---|---|
| D1 | Notification list | Show notifications | FULLY | NOT TESTED | `ClientPortal.jsx:1740,4630`; `clientNotifications.js:552` | Add test | Low |
| D2 | Correct unread counts | Accurate unread badge | FULLY | NOT TESTED | `ClientPortal.jsx:1764,4486`; `clientNotifications.js:577,609` | 15s poll; shares `where` with list | Low |
| D3 | Notification sound volume | User volume/mute control | **NOT IMPL** | NOT TESTED | `sound.js:12,67-74` gains **hardcoded**; no `volume`/preference anywhere | Build + persist volume/mute control | Low |
| D4 | Preference controls | Toggle notification prefs | FULLY | NOT TESTED | `Settings.jsx:617`; `clientNotifications.js:438-477`; `UserNotificationPreference` schema:1187 | Not all producers consult prefs | Low |
| D5 | Lead notif → exact-page nav | Click lead notif → open that lead | **BROKEN** | NOT TESTED | UI parses `LEAD_FOLLOWUP:<id>` from message (`ClientPortal.jsx:1831`) but backend **`stripMarkers` removes it before sending** (`clientNotifications.js:547,590`); `actionModule` only `"lead-store"` | Carry lead id in an un-stripped field | **High** |
| D6 | Other module deep links | Notifications route to modules | PARTIAL | NOT TESTED | `ClientPortal.jsx:1843`; producers set `actionModule` | Module-level only; no record-level targets | Low |
| D7 | Mobile notification navigation | Tap → correct screen | PARTIAL | NOT TESTED | `mobilePush.js:88-95`; `pushService.js:60` data block | Same gap as D5 — data block has no record id | Medium |
| D8 | Firebase push delivery | Deliver FCM push | NEEDS CONFIG | BLOCKED | `firebase-admin` installed; `pushService.js:102,137` lazy-init from `FIREBASE_SERVICE_ACCOUNT`/`GOOGLE_APPLICATION_CREDENTIALS` — **neither in `.env.example` nor validated**; silent no-op until set | Provision + document creds | **High** |

### E. Users & Departments

| ID | Feature | Requested behavior | Impl | Test | Evidence | Remaining work | Priority |
|---|---|---|---|---|---|---|---|
| E1 | Department dropdown | Pick department | FULLY | NOT TESTED | `Settings.jsx:4656-4681`; `clientUsers.js:403` | (Blocked at runtime by designation/level DB issue — see E4) | Low |
| E2 | Company-specific dept loading | Load company's departments | FULLY | NOT TESTED | `Settings.jsx:1193`; `clientUsers.js:81,177` (defaults + per-company, companyId-scoped) | — | Low |
| E3 | Loading / Retry / empty states | Robust states | PARTIAL | NOT TESTED | Dept dropdown has loading/empty/**Retry** `Settings.jsx:4668-4697`; users-list failure = banner only, **no Retry** `:3068-3075` | Add Retry for users/org load failure | Low |
| E4 | Add/Edit User workflows | Create/edit users | **BROKEN** | **FAIL** | Code complete `clientUsers.js:769,1044`, but **writes/reads `designationId/levelId/levelName`** (`:965,600,620,728`) which are **missing from Dev DB** (verified §2) → create/edit/Users-list 500 | Apply migration `0002` + `prisma generate` | **Critical** |
| E5 | Role permissions (Emp/Mgr/Admin) | Enforce per-role access | FULLY | PASS* | Middleware `clientAuth.js:355,415`; `clientUsers.js:347,55,23`; `pageAccess.test.js` | *Helpers tested; Express guards not integration-tested | Medium |
| E6 | Super Admin behavior | SA excluded from client portal | FULLY | NOT TESTED | `clientAuth.js:72,182`; `clientUsers.js:732/1060/1423` `role:{not:SUPER_ADMIN}` | Add test | Low |

### F. UTM Leads

| ID | Feature | Requested behavior | Impl | Test | Evidence | Remaining work | Priority |
|---|---|---|---|---|---|---|---|
| F1 | UTM link creation | Create UTM links | FULLY | NOT TESTED | `UTMLeads.jsx:1704-1800`; `clientLeads.js:2051-2250` | — | Low |
| F2 | UTM tracking (clicks) | Track clicks | **NOT IMPL** | NOT TESTED | `clicks/registrations/...` on `UtmLink` are **only read, never incremented**; no public redirect/tracking endpoint | Build tracked redirect endpoint, or remove Clicks UI | Medium |
| F3 | Import modal attribution dropdown | Attribute imports to a link | FULLY | NOT TESTED | `UTMLeads.jsx:528-655`; `clientLeads.js:1582-1700` (validates link∈company) | Shows inactive links too (minor) | Low |
| F4 | UTM link validation | Validate inputs/URL | FULLY | NOT TESTED | `UTMLeads.jsx:1705-1774`; `clientLeads.js:2094-2186` | — | Low |
| F5 | Lead attribution persistence | Persist link on lead | PARTIAL | NOT TESTED | create/import persist `Lead.utmLinkId` (`clientLeads.js:746-766,1690`) | **PATCH doesn't update `utmLinkId`** → can't correct attribution after create | Low |
| F6 | UTM Analytics accuracy | Accurate per-campaign metrics | PARTIAL | NOT TESTED | `clientLeads.js:2488-2765` | **Not role-scoped** (company-wide totals regardless of assignee); clicks fabricated (→F2) | Medium |
| F7 | Cross-company attribution protection | No cross-tenant attribution | FULLY | NOT TESTED | Every UTM query filters `companyId` (`clientLeads.js:1760,2500,2264,2443`) | No cross-tenant integration test | **High (verify)** |

### G. Mobile CRM

| ID | Feature | Requested behavior | Impl | Test | Evidence | Remaining work | Priority |
|---|---|---|---|---|---|---|---|
| G1 | Login / session restoration | Restore session on cold start | FULLY | NOT TESTED (device BLOCKED) | `App.jsx:387-453`; token in localStorage `api.js:26-45`; bounded retry vs 401 | On-device verification | Medium |
| G2 | Bottom navigation | Mobile tab bar | FULLY | NOT TESTED | `mobileUi.jsx:312-359`; `ClientPortal.jsx:1498-1516,4509-4515` | Device QA | Low |
| G3 | More menu | Overflow menu | FULLY | NOT TESTED | `ClientPortal.jsx:1028,4653-4790` | Device QA | Low |
| G4 | Logout | Reliable logout | FULLY | **PASS** | `logoutFlow.js:29-85`; `logoutFlow.test.js` (8 tests) | True server-side revocation needs backend support (noted in code) | Low |
| G5 | Fast nav & state preservation | Fast switching, keep state | PARTIAL | NOT TESTED | `ClientPortal.jsx:800-830` state-based nav | Whether modules unmount/lose state unverified | Medium |
| G6 | KPI responsiveness (mobile) | Responsive KPI grids | FULLY | NOT TESTED | `Dashboard.jsx:1240,1290,1593,2236` responsive grids | Visual QA | Low |
| G7 | Mobile UI readability | Legible, tappable | FULLY | NOT TESTED | `mobileUi.jsx` (≥44-48px targets, safe-area) | No automated a11y test | Low |
| G8 | Android back button | Hardware back handling | FULLY | **PASS** | `BackButtonHandler.jsx:32-60`; `backStack.test.js`+`moduleBack.test.js` (14 tests) | Native `exitApp` path + device runtime untested | Medium |
| G9 | Native phone/SMS/WhatsApp | Native dial/SMS/WhatsApp | PARTIAL | NOT TESTED | `nativeActions.js:36-57`; `LeadStore.jsx:58,465,476` | `openDialer` is **dead code**; dialing via raw `<a href="tel:">` w/o sanitization | Low |
| G10 | Firebase notifications (mobile) | Receive push on device | FULLY | BLOCKED | `mobilePush.js` (full); `google-services.json` present (`bispun-crm`); `mobilePush.pluginLoad.test.js` | Delivery/permission/tap routing untested on device | Medium |
| G11 | Splash screen | Native splash | FULLY | NOT TESTED | `styles.xml:19-21`, core-splashscreen dep; native Android 12 SplashScreen (not the Capacitor plugin) | No JS control of hide timing | Low |
| G12 | Capacitor Android build | Build release APK/AAB | NEEDS CONFIG | NOT TESTED | `android/app/build.gradle:19-25` release block has **no `signingConfig`**; no keystore/`.jks` in repo; versionCode 1, minify off | Add signing config + keystore (keep out of VCS) | **High (release blocker)** |
| G13 | Android emulator/device runtime | Runs on device | CANNOT DETERMINE | BLOCKED | Only the default Capacitor instrumentation stub exists; no emulator available | Manual on-device QA | Medium |

### H. Existing CRM modules (regression — no functionality lost)

All routed via `ClientPortal.jsx`'s switch/view model; all 29 client routes mounted in `server/index.js:199-232` with `requireClientUser`.

| ID | Module | Front (file) | Back (route) | Routed | Complete | Notes |
|---|---|---|---|---|---|---|
| H1 | Dashboard | Dashboard.jsx | clientLeads/clientAnalytics | ✅ | FULLY | — |
| H2 | Lead Store | LeadStore.jsx | clientLeadStore/clientLeads | ✅ | FULLY | Largest module |
| H3 | UTM Leads | UTMLeads.jsx | clientLeadSources/clientLeads | ✅ | FULLY | See Area F gaps |
| H4 | Admissions | Admissions.jsx | clientAdmissions.js | ✅ | FULLY | Recently changed; full guards present |
| H5 | Revenue | Revenue.jsx | clientRevenue/clientRevenueSlabs | ✅ | FULLY | — |
| H6 | Finance | (in Revenue.jsx) | clientRevenue `/expenses`,`/incentives` | ✅ | FULLY | Finance = Revenue section (expenses+incentives) |
| H7 | Walk-ins | Walkins.jsx | clientWalkins.js | ✅ | FULLY | — |
| H8 | Counselling | Counselling.jsx | clientCounselling.js | ✅ | FULLY | — |
| H9 | Analytics | Analytics.jsx | clientAnalytics.js | ✅ | FULLY | — |
| H10 | Chats | ChatPanel.jsx | clientChat.js + socket.js | ✅ | FULLY | Real-time wired (Socket.IO) |
| H11 | Goals & Targets | GoalsAndTargets(.All).jsx | clientTargets.js | ✅ | FULLY | — |
| H12 | My Store | MyStore.jsx | clientStore.js | ✅ | PARTIAL | "Live AI image generation coming soon" (intentional) |
| H13 | My Referrals | Referrals/MyReferrals/ReferralHome.jsx | clientReferrals.js | ✅ | FULLY | — |
| H14 | Settings | Settings.jsx | clientSettings/clientUsers/... | ✅ | FULLY | Recently changed; "SMS — Coming Soon" sub-feature |
| H15 | Help & Support | Help.jsx | clientSupport.js | ✅ | FULLY | — |
| H16 | Subscription/Billing | admin/Billing + Settings | clientBilling/adminBilling/razorpayWebhook | ✅ | FULLY | Razorpay lifecycle |
| H17 | Super Admin | SuperAdmin.jsx + modules/admin/* | 17 admin*.js routes | ✅ | FULLY | `stub()` is only the unknown-key fallback |
| H18 | Roles & tenant isolation | — | clientAuth.js + pageAccess.js | ✅ | FULLY | JWT companyId checks; role + pageAccess layers |

**Regression verdict:** 17/17 modules present and wired; **no module removed, broken, or stubbed**. Two deliberate "coming soon" flags only. Note: `src/components/client/SettingsView.jsx` contains a `PlaceholderPanel` (line 149) that looks like a legacy/duplicate of the routed `Settings.jsx` — worth confirming it is not dead code (does not affect the live path).

---

## 6. Dev-vs-Production risk register

| Item | Dev state | Production risk |
|---|---|---|
| `designationId/levelId/levelName` columns | Missing in Dev DB; stale Prisma client | **Users page + user create/edit will 500 in any env where migration `0002` isn't applied.** Login still works (confusing partial outage). |
| `DeviceToken` table (migration `0001`) | Status unverified | If missing, device-token register/unregister 500 (push dispatch itself is guarded). |
| Google OAuth env vars | Undocumented, defaults to localhost redirect | Calendar/Meet OAuth fails in prod with a generic error. |
| Firebase credentials | Undocumented, unvalidated | Push silently disabled in prod until creds set. |
| Android release signing | No keystore/signing config | Cannot produce a Play-ready signed build. |
| `google-services.json` | Committed to repo | Contains a Firebase Android API key — confirm it is SHA/package-restricted. |
| Mobile tests not in CI | Pass locally | Regressions in back-button/logout/push-load won't be caught by `npm test`. |

---

*Evidence basis: direct git/build/test/Prisma/DB checks run during this audit, plus static code review across all areas. Line numbers reference HEAD `2aceef9`. No feature was marked PASS without a named automated test; no runtime behavior requiring Google/Firebase/Android was claimed as verified.*

---

## 7. Implementation update — 2026-11-09 (branch `feat/bispun-audit-fixes-mobile-completion`)

Safe, un-gated fixes implemented and committed on the integration branch (base `2aceef9`). All changes TDD'd; full suite now **75/75** (was 55 — +20 new assertions across 4 new test files). Production build passes. No schema/DB change; nothing merged to `main`.

| ID | Requirement | Previous status | Current implementation | Verification | Files changed | Remaining |
|---|---|---|---|---|---|---|
| C10 | Dial & Track — call history | PARTIAL (history not scoped) | **FULLY** — `GET /history` now restricted to own calls + calls on visible leads via new tested `callHistoryWhere()` | **PASS** (3 unit tests) `leadVisibility.test.js` | `server/lib/leadVisibility.js`, `server/routes/clientTelephony.js` | Integration test w/ seeded multi-role data |
| A5 | Calendar event authorization | NOT IMPL | **PARTIAL** — edit/delete now restricted to creator/assignee/admin (`canModifyCalendarEvent()`); viewing still company-wide | **PASS** (6 unit tests) `calendarAccess.test.js` | `server/lib/calendarAccess.js`, `server/routes/clientCalendar.js` | Private-vs-shared **view** model needs a `visibility` column → migration-gated (see §8) |
| D5 | Lead notification → exact lead (web) | BROKEN | **FULLY** — id carried on `actionModule` as `lead-store#lead:<id>`, parsed by shared `parseNotificationTarget()` + focus handoff | **PASS** (6 unit tests) `notificationTarget.test.js` | `server/routes/clientNotifications.js`, `server/lib/nurtureEngine.js`, `src/ClientPortal.jsx`, `src/lib/notificationTarget.js` | On-device confirm (mobile); admission/calendar record deep-links still module-level |
| D7 | Mobile notification navigation | PARTIAL | **FULLY (code)** — mobile tap handler resolves `#lead:<id>` and routes to the lead | BLOCKED (no device) | `src/lib/mobilePush.js`, `src/ClientPortal.jsx` | Device verification |
| B1 | Leads by Source total accuracy | PARTIAL (counting bug) | **FULLY** — authoritative `leadsBySourceTotal` (sum of slices) drives donut center + sr-only total | **PASS** (5 unit tests) `leadsBySource.test.js` | `server/lib/leadsBySource.js`, `server/routes/clientAnalytics.js`, `src/modules/client/Dashboard.jsx` | — |
| B3 | Direct Admission source counts | PARTIAL | **FULLY** — reconciled by the same fix (direct admissions counted in donut total) | **PASS** (same) | (same as B1) | — |

**New tested helpers (all pure, unit-tested):** `callHistoryWhere` (telephony scope), `canModifyCalendarEvent` (calendar authz), `parseNotificationTarget` (deep-link id), `buildLeadsBySource` (donut counting incl. direct admissions / unspecified / zero-data cases).

**Accessibility:** the two UI files (`ClientPortal.jsx`, `Dashboard.jsx`) were reviewed by the accessibility-lead before editing. Honored must-preserve items: focus handoff to main content after notification navigation; donut visible total and sr-only total kept in lockstep. Pre-existing a11y gaps on the desktop notification dropdown (Escape-to-close, dynamic aria-label with unread count, focus-visible rings) were flagged and are logged as follow-ups in the roadmap.

### Still outstanding (not yet implemented)
- **E4 / designation-level (Users & Roles):** 🔴 still BROKEN in Dev — **blocked on the migration approval gate (§8).** No code change yet; applying the migration + `prisma generate` is the fix.
- **Lead-visibility hardening** (name→id based assignment, case consistency): not started — partly intersects designation data; recommend after the migration.
- **Calendar private/shared view model** (A5 remainder): needs a schema `visibility` column → include in migration package if approved.
- **Config gaps** (A11 Google OAuth, D8 Firebase, G12 Android signing): documentation/provisioning — see roadmap P1/P3.
- **Mobile stages 0–4:** see `BISPUN-MOBILE-STAGE-STATUS.md`.

---

## 8. 🔴 APPROVAL GATE — Dev database migration package

**Status: PREPARED, NOT APPLIED.** Awaiting explicit approval (per your rules: no migrations without separate approval). This unblocks E4 (Users & Roles).

**Target (Dev only):** Neon **blue-mouse** / `neondb` (`ep-blue-mouse-...`). **Never** Production.

**Migration:** `prisma/pending-migrations/0002_add_user_designation_and_level.sql`

```sql
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "designationId" TEXT,
  ADD COLUMN IF NOT EXISTS "levelId" TEXT,
  ADD COLUMN IF NOT EXISTS "levelName" TEXT;
CREATE INDEX IF NOT EXISTS "User_companyId_designationId_idx" ON "User"("companyId", "designationId");
CREATE INDEX IF NOT EXISTS "User_companyId_levelId_idx" ON "User"("companyId", "levelId");
```

**Impact assessment (read-only review):**
- **Non-destructive & idempotent:** `ADD COLUMN IF NOT EXISTS` (nullable TEXT, no defaults) + `CREATE INDEX IF NOT EXISTS`. Safe to re-run.
- **No data modified or removed.** Existing `jobTitle`/`department` untouched. New columns default to NULL for all existing users — compatible with the code (`user.designationId ?? null`).
- **No new FK constraints** (designation/level ids are app-managed strings in `CompanySettings.organizationConfig`, not relational FKs). No cascade risk.
- **Indexes** match `schema.prisma:345-346`.
- **Order:** single statement block; no dependencies on other pending migrations. (`0001_add_device_token.sql` is independent; verify `DeviceToken` table exists separately.)

**On approval, I will (Dev only):** apply the SQL → `prisma generate` → restart Dev backend → verify the 3 columns exist → smoke-test Users & Roles (list, add, edit, designation/level assignment) → run the suite. **Production application requires a separate, explicit Production authorization and is out of scope here.**

### Execution log — 2026-11-09 (approved)
- ✅ Target re-verified: `ep-blue-mouse-...neondb` (blue-mouse Dev, **not** pond).
- ✅ SQL re-scanned: only additive `ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`; no destructive statements.
- ⛔ **BLOCKED — Dev DB unreachable.** Connection attempts to Neon blue-mouse (pooler **and** direct endpoint, 45s timeout, IPv4-first per the Part B note) all returned `ETIMEDOUT`; a raw TCP probe to `:5432` also timed out. The compute almost certainly auto-suspended since the earlier successful read, or there is a network/allowlist block from this environment. **The migration was NOT applied** (correct per the STOP rule — cannot verify against an unreachable DB).
- **To complete:** ensure the Neon blue-mouse compute is awake and reachable from the run environment (open it in the Neon console once, or confirm network/IP access), then re-run the approved apply (target + SQL already verified). Then `prisma generate` + the verification steps above.
