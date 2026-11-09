# Bispun CRM — Pending Features & Prioritized Gap Analysis

**Date:** 2026-11-09 · **Branch:** main @ `2aceef9`
**Companion to:** `BISPUN-IMPLEMENTATION-STATUS-2026-11-09.md`

This is the prioritized "what's left" list. Items are ordered **security & broken first, cosmetic last**, as requested. Each gap lists: missing functionality, root cause/evidence, files, Web/Mobile impact, security/data risk, work required, DB-migration need, dependencies, complexity (S/M/L), and recommended order.

Complexity key: **S** = <½ day, **M** = ~1–3 days, **L** = >3 days / cross-cutting.

---

## Status 2026-11-09 (later): RELEASE & CLEANUP ON HOLD
Per owner decision: **Production release ON HOLD** and **branch cleanup ON HOLD**. PR #13 stays open (MERGEABLE/CLEAN, Vercel preview green). No merge, no `main` push, no deploy, no branch/worktree deletion. Prod schema verified (designation/level + leadStoreColumnOrder present) — do **not** run `0002` in Prod. Only remaining Web/Backend gate is the owner's deploy approval; open item: confirm `DeviceToken` table in Prod. Mobile runtime remains BLOCKED (no emulator).

## Progress — 2026-11-09 (branch `feat/bispun-audit-fixes-mobile-completion`)

| # | Item | State |
|---|---|---|
| 1 | Apply designation/level migration | ✅ **DONE** — applied to Dev blue-mouse (transactional), Prisma Client regenerated, data layer + `/api/health` boot verified (status §8). E4 Users & Roles unblocked. Prod still gated. |
| 2 | Lead-notification deep link (web + mobile) | ✅ **DONE** — `parseNotificationTarget`, encoded `actionModule`, focus handoff; 6 tests |
| 3 | Calendar private-event protection | 🟡 **PARTIAL DONE** — edit/delete authz shipped (`canModifyCalendarEvent`, 6 tests); private-vs-shared **view** model still needs a schema column (migration-gated) |
| 4 | Telephony call-history scoping | ✅ **DONE** — `callHistoryWhere`, 3 tests |
| 5 | Lead-visibility hardening (name→id) | ✅ **DONE (code)** — bulk-assign writes authoritative `assignedToUserId` (fixes stale-id leak) **and** `leadVisibilityWhere` now matches names case-insensitively (consistent with `canViewLead`). +2 unit tests. Remaining: route-level integration tests (needs a DB test harness). |
| 5c | Notification a11y (desktop dropdown) | ✅ **DONE** — dynamic aria-label+count, haspopup/expanded, Escape-to-close + focus return, role=alert, aria-live list, focus rings, contrast (per a11y-lead review). Mobile untouched. |
| 3b | Calendar private/shared **view** model | 🟡 **MIGRATION DRAFTED (gate)** — `prisma/pending-migrations/0003_DRAFT_add_calendar_event_visibility.sql` (additive `visibility` TEXT default COMPANY + index) with schema + GET-filter plan. NOT applied; awaits approval. |
| 9 | Account deletion (Play compliance) | ✅ **IMPLEMENTED (v1 live; durable gated)** — public `/data-deletion` page + endpoints + in-app option + Super-Admin review; records requests only (no destruction). Durable `AccountDeletionRequest` model + migration `0004_DRAFT` prepared (additive CREATE TABLE); endpoints guarded so they return an honest failure (not false success) until applied. 86/86 tests. |
| 5b | CI test coverage | ✅ **DONE** — `npm test` now runs all 12 suites (was 4). |
| 6 | Google/Firebase config docs | ✅ **DONE** — `.env.example` documents Google OAuth + Firebase (+core/telephony) vars; `env.js` warns when unconfigured (non-fatal). Provisioning real creds still required for the live features. |
| 7 | Dashboard Leads-by-Source counting | ✅ **DONE** — `buildLeadsBySource` + `leadsBySourceTotal`, 5 tests |
| 8–23 | (UTM tracking, Meet durability, volume, Android signing, etc.) | ⬜ Not started |

New a11y follow-ups logged from the pre-edit review (desktop notification dropdown): add Escape-to-close + focus return to bell; dynamic `aria-label` with unread count; `aria-haspopup`/`aria-expanded`; `role="alert"` on desktop error; focus-visible rings. All **S**, non-blocking.

Suite: **75/75** passing. Build: passing. Nothing merged to `main`.

---

## P0 — Blockers & broken (do first)

### 1. Apply the designation/level migration + regenerate Prisma Client  🔴 CRITICAL / BROKEN
- **Missing:** `User.designationId`, `User.levelId`, `User.levelName` columns do not exist in the Dev DB, and the generated Prisma Client is stale (0 references).
- **Evidence:** Live Dev DB (`blue-mouse`) `information_schema` check → **MISSING**. `node_modules/.prisma/client/index.d.ts` → 0 refs. Pending script `prisma/pending-migrations/0002_add_user_designation_and_level.sql` not applied (no `prisma/migrations/` dir; project uses `db push`). Code uses the fields: `clientUsers.js:600,620,728,965`.
- **Files:** `prisma/schema.prisma:272-274`, `prisma/pending-migrations/0002_add_user_designation_and_level.sql`, `server/routes/clientUsers.js`.
- **Impact:** **Web** (Users & Roles page, user create/edit → HTTP 500). Mobile indirectly (same API). Login unaffected.
- **Risk:** Operational outage of user management; **worse if deployed to prod without the migration**.
- **Work:** Apply `0002` SQL (or `prisma db push`) to **Dev and every other env**; run `prisma generate`; smoke-test Users page + user create/edit. **Do not run this as part of the audit — it is a DB write and needs your go-ahead.**
- **DB migration:** **Yes.** **Deps:** DB access per env. **Complexity:** S (but must hit every environment). **Order: 1.**

### 2. Lead-notification deep link opens the module, not the lead  🔴 BROKEN
- **Missing:** Clicking a lead follow-up notification should open that exact lead; it opens the Lead Store landing instead.
- **Root cause:** Backend `stripMarkers` removes the `LEAD_FOLLOWUP:<id>:...` marker before sending (`clientNotifications.js:547,590`), and `actionModule` is only `"lead-store"` — so the UI's id parser (`ClientPortal.jsx:1831`) always gets null and falls through to `setModule("lead-store")` (`:1844`). Mobile has the same gap (FCM data block carries no record id, `pushService.js:60`).
- **Files:** `server/routes/clientNotifications.js`, `src/ClientPortal.jsx`, `src/lib/mobilePush.js`, `server/lib/pushService.js`.
- **Impact:** **Web + Mobile.** **Risk:** UX/functional only.
- **Work:** Carry the lead id in an un-stripped field (e.g. a dedicated `actionTargetId`/`leadId` column, or set `actionModule:"lead-store#lead:<id>"` which the UI already supports at `:1837`), include it in the FCM data block, route it on tap. Add a test.
- **DB migration:** Possibly (if adding a column). **Deps:** none. **Complexity:** S–M. **Order: 2.**

---

## P1 — Security & tenant/role correctness

### 3. Calendar: no private-event protection  🟠 SECURITY (NOT IMPLEMENTED)
- **Missing:** Any user in a company can list/read/edit/delete **every** company calendar event and open its Google Meet link.
- **Evidence:** `clientCalendar.js` GET/PATCH/DELETE scope by `companyId` only — no owner/assignee/private filter.
- **Files:** `server/routes/clientCalendar.js`, `prisma/schema.prisma` (`CalendarEvent`), `src/modules/client/CalendarModal.jsx`.
- **Impact:** Web + Mobile. **Risk:** Confidential meetings/Meet links exposed across a tenant's users.
- **Work:** Add a visibility model (owner/assignee/private flag or attendee list) and enforce it on GET/PATCH/DELETE.
- **DB migration:** Yes (visibility field). **Deps:** none. **Complexity:** M. **Order: 3.**

### 4. Telephony call history not visibility-scoped  🟠 SECURITY
- **Missing:** `GET /telephony/history` is scoped by `companyId` + caller-supplied `leadId`/`phone` only — an employee can read colleagues' / out-of-scope leads' call history.
- **Evidence:** `clientTelephony.js:136-158` (vs `POST /calls` which correctly enforces `canViewLead` at `:168-188`).
- **Files:** `server/routes/clientTelephony.js`.
- **Impact:** Web + Mobile. **Risk:** Intra-company data leak (tenant isolation holds; role visibility leaks).
- **Work:** Apply `leadVisibilityScope`/`canViewLead` to `GET /history`. **DB:** No. **Complexity:** S. **Order: 4.**

### 5. Name-based lead visibility is fragile & case-inconsistent  🟠 CORRECTNESS/SECURITY
- **Missing:** Robust assignee matching. List query matches `assignedToName` with raw **case-sensitive** `in` (`leadVisibility.js:158-170`), while single-record `canViewLead` uses case-insensitive `normalizeName` (`:192`). Bulk-assign sets name only (`clientLeadStore.js:3289-3296`), and names aren't unique — same-named users across departments collapse together.
- **Files:** `server/lib/leadVisibility.js`, `server/routes/clientLeadStore.js`.
- **Impact:** Web + Mobile. **Risk:** Leads visible/invisible inconsistently; cross-team visibility via name collision.
- **Work:** Prefer id-based assignment (store `assignedToUserId` on bulk-assign); make list & record matching consistent (normalize both). Consolidate the duplicated dashboard copy (`clientAnalytics.js:144-252`) with `leadVisibility.js`.
- **DB migration:** No (data backfill advisable). **Complexity:** M. **Order: 5.**

### 6. Config: Google OAuth, Firebase creds  ⚙️ NEEDS CONFIGURATION
- **Missing:** `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `CLIENT_URL`, and `FIREBASE_SERVICE_ACCOUNT`/`GOOGLE_APPLICATION_CREDENTIALS` are not documented in `.env.example` nor validated in `server/lib/env.js`. Google redirect silently defaults to localhost; push silently no-ops.
- **Files:** `.env.example`, `server/lib/env.js`, `server/lib/google.js:5-9`, `server/lib/pushService.js:102,137`.
- **Impact:** Web (Calendar/Meet) + Mobile (push). **Risk:** Features silently dead in prod.
- **Work:** Document all required env vars in `.env.example`; add boot-time validation/health warning. Confirm the committed `google-services.json` API key is SHA/package-restricted.
- **DB migration:** No. **Deps:** Google Cloud + Firebase project. **Complexity:** S. **Order: 6.**

---

## P2 — Functional gaps / accuracy

### 7. Dashboard "Leads by Source" counting mismatch  🟡 BUG
- **Missing:** Donut center total (`totalLeads` = leads.length, excludes direct admissions) ≠ sum of legend slices (includes the Direct Admission bucket) when direct admissions exist.
- **Evidence:** `clientAnalytics.js:535,638-644` (comment and code disagree); `Dashboard.jsx:1483-1486`.
- **Files:** `server/routes/clientAnalytics.js`, `src/modules/client/Dashboard.jsx`.
- **Impact:** Web (+ mobile dashboard). **Risk:** Misleading metric. **Work:** Decide whether direct admissions count in Total Leads; make center and legend share one base. **DB:** No. **Complexity:** S. **Order: 7.**

### 8. UTM click tracking absent  🟡 NOT IMPLEMENTED
- **Missing:** No endpoint increments `UtmLink.clicks`; no public redirect/tracking route. "Clicks" is always 0; "Registrations" is derived from lead counts, not tracked events.
- **Evidence:** `clientLeads.js:2578-2582` fallback; no UTM public route in `index.js`.
- **Files:** `server/routes/clientLeads.js`, `server/index.js`, `prisma/schema.prisma` (`UtmLink`).
- **Impact:** Web. **Risk:** None (just inaccurate funnel). **Work:** Add a tracked redirect endpoint that increments clicks (and ideally dedups), or remove the Clicks UI. **DB:** No. **Complexity:** M. **Order: 8.**

### 9. UTM analytics not role-scoped; attribution not editable  🟡 PARTIAL
- **Missing:** UTM Analytics counts all company leads on a link regardless of assignee (inconsistent with dashboard's per-user scoping); lead PATCH can't change `utmLinkId` after create.
- **Evidence:** `clientLeads.js:2488-2765` (no visibility scope); `clientLeads.js:954` (PATCH updates `campaign` not `utmLinkId`).
- **Files:** `server/routes/clientLeads.js`, `src/modules/client/UTMLeads.jsx`.
- **Impact:** Web. **Risk:** Over-broad metrics for restricted roles. **Work:** Decide scoping policy; allow attribution correction. **DB:** No. **Complexity:** S–M. **Order: 9.**

### 10. Calendar: pending/failed Meet state not durable  🟡 PARTIAL
- **Missing:** A Meet link still provisioning when the ~4s poll expires is never persisted or reconciled; `CalendarEvent` has no Meet-status column.
- **Evidence:** `google.js:112-172`, `CalendarModal.jsx:821-835`; schema `CalendarEvent` (no status field).
- **Files:** `server/lib/google.js`, `prisma/schema.prisma`, `src/modules/client/CalendarModal.jsx`.
- **Impact:** Web + Mobile. **Risk:** Lost Meet links. **Work:** Persist a `meetStatus`/`meetLink` with a background reconcile job. **DB:** Yes. **Complexity:** M. **Order: 10.**

### 11. Notification sound volume control  ⚪ NOT IMPLEMENTED
- **Missing:** User-facing volume/mute; gains are hardcoded (`sound.js:67-74`).
- **Files:** `src/lib/sound.js`, `src/modules/client/Settings.jsx`, `prisma/schema.prisma` (preference), `server/routes/clientNotifications.js`.
- **Impact:** Web + Mobile. **Risk:** None. **Work:** Add + persist a volume/mute preference. **DB:** Yes (preference field). **Complexity:** S. **Order: 11.**

---

## P3 — Mobile / release readiness

### 12. Android release signing / keystore missing  🟠 RELEASE BLOCKER
- **Missing:** `android/app/build.gradle:19-25` release block has no `signingConfig`; no keystore/`.jks` in repo; `local.properties` has only `sdk.dir`.
- **Impact:** Mobile. **Risk:** Cannot produce a signed Play-ready AAB/APK (debug builds OK). **Work:** Add `signingConfigs.release` + a keystore kept out of VCS; define a versionCode strategy; decide on minify/proguard. **DB:** No. **Deps:** keystore + signing secrets (stored securely). **Complexity:** M. **Order: 12.**

### 13. Mobile unit tests not in CI; thin push coverage  🟡
- **Missing:** `package.json` `test` runs only 4 of 9 test files; `mobilePush.pluginLoad.test.js` covers only the plugin-load wrapper.
- **Files:** `package.json:17`.
- **Impact:** Mobile + Web (test safety net). **Work:** Add all `src/lib/*.test.js` to the `test` script; broaden push tests (permissions/token/tap). **Complexity:** S. **Order: 13.**

### 14. `openDialer` dead code; `tel:` anchors unsanitized  🟡
- **Missing:** `nativeActions.openDialer` has no callers; dialing uses raw `<a href="tel:${phone}">` (`LeadStore.jsx:439,5288`; `UTMLeads.jsx:1514`; `WebsiteLeads.jsx:172`).
- **Work:** Centralize dialing through `nativeActions` with normalization/sanitization, or remove the dead function. **Complexity:** S. **Order: 14.**

### 15. On-device / runtime verification (BLOCKED)  ⛔
- **Missing (verification, not code):** No emulator/device available; push delivery, hardware back, splash timing, native actions, and cold-start session restore are all unverified.
- **Work:** Manual on-device QA pass (see regression checklist). Needs an Android device/emulator + a valid Firebase setup. **Order: ongoing.**

---

## P4 — Smaller functional/UX items

| # | Gap | Files | Complexity |
|---|---|---|---|
| 16 | Lead Store export is CSV-only client-side (no server/XLSX export) | `LeadStore.jsx:3998-4050` | S |
| 17 | Users/org load failure has no Retry (banner only) | `Settings.jsx:3068-3075` | S |
| 18 | `resolveListView` tested but not wired into Lead Store | `LeadStore.jsx`, `listViewState.js` | S |
| 19 | Lead ID is a derived sequential number (not persisted/stable) | `clientLeadStore.js:2777-2801` | M |
| 20 | Import attribution dropdown shows inactive links | `UTMLeads.jsx:646-651` | S |
| 21 | Confirm `SettingsView.jsx` `PlaceholderPanel` is not dead code | `src/components/client/SettingsView.jsx:149` | S |
| 22 | Course/Interest is free-text (no constrained taxonomy) — if a fixed list is wanted | `LeadStore.jsx:1184-1210` | M |
| 23 | Company-wide (`userId=null`) notifications get no mobile push (by design) | `pushDispatch.js:44` | M |

---

## Recommended implementation order (summary)

1. **Apply migration `0002` + `prisma generate`** (unblocks Users/Roles) — P0, needs your go-ahead (DB write).
2. Fix lead-notification deep link (web + mobile) — P0.
3. Calendar private-event protection — P1 security.
4. Telephony `GET /history` visibility scope — P1 security.
5. Consolidate & harden lead visibility (id-based assign, case consistency) — P1.
6. Document + validate Google/Firebase env vars — P1 config.
7. Dashboard Leads-by-Source counting fix — P2.
8. UTM click tracking (or remove Clicks UI) — P2.
9. UTM analytics scoping + editable attribution — P2.
10. Durable Meet pending/failed state — P2.
11. Notification volume control — P2.
12. Android release signing/keystore — P3 (release blocker).
13. Wire mobile tests into CI — P3.
14. Native dialing cleanup — P3.
15. On-device QA — P3 (ongoing).
16+. P4 polish.

> **Nothing above has been implemented** — this task was audit-only. Awaiting your review before any code or DB change.
