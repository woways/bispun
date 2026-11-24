# Bispun CRM — Complete End-to-End Regression Audit

**Date:** 2026-11-07
**Auditor:** Claude Code (automated, read-only except where noted)
**Local dir:** `S:\Bispun`
**Branch:** `main` (local) @ `32f58bc` — working tree clean
**Previously reported commit:** `213f21f` (present; see Phase 1)
**Dev database:** Neon `ep-blue-mouse-…` → `neondb` (confirmed, NOT production `pond`)

> **Method:** Real checks were run wherever the environment safely permits — live HTTP against the running backend with an authenticated Client Admin session, direct read-only SQL against Neon dev, the real test suite, and a real production build. No database writes, migrations, merges, pushes, deployments, or messages were performed. Items that need prerequisites I don't have (employee passwords, a connected Google account, an Android emulator) are marked **BLOCKED**, never PASS.

---

## Status legend
- **PASS** — actually tested and working.
- **FAIL** — actually tested and broken.
- **BLOCKED** — cannot test; missing prerequisite.
- **NOT TESTED** — not exercised this run (e.g., would require a write, or out of session scope).
- **CODE-OK** — implementation verified in source/diff but not exercised live.

---

## 0. Executive summary

- **Stack is up and healthy.** Frontend (5173) 200, backend (4000) healthy, Prisma→Neon dev connected, `SELECT 1` OK, pond not used.
- **Automated gate green:** 23/23 unit tests pass; production build succeeds (exit 0); no secrets in the committed branch diff.
- **1 confirmed FAIL (High):** **Saved Lead Store column order is broken for Client Admin / Manager** — `GET /api/client/lead-store/column-preferences` → **HTTP 500** because the `User.leadStoreColumnOrder` column exists in `schema.prisma` and backend code but **was never pushed to the Neon dev DB**. Fix = a DB schema push → **gated, awaiting your approval** (no migration performed).
- **GitHub `main` does NOT yet contain the Web/Mobile feature work.** It's on `origin/feat/mobile-ui-optimization` (`213f21f`) plus a local-only commit (`32f58bc`). No merge/push done (per your rules).
- **Large areas are BLOCKED** honestly: live Google Meet creation (no connected Google account), per-employee lead-isolation logins (no employee passwords), and all Android native runtime (no emulator/device).

**Production-readiness verdict:** **NOT READY as-is.** Blockers: (1) `leadStoreColumnOrder` DB column missing (feature broken for admins/managers), (2) feature work not on `main`, (3) mobile runtime / Google Meet / multi-user isolation unverified. Conditional-GO after (1) is fixed via `prisma db push` and the BLOCKED items are validated.

---

## 1. GitHub / branch comparison — Phase 1

| Item | Result | Status |
|---|---|---|
| Current branch / HEAD | `main` @ `32f58bc`, working tree **clean** | PASS |
| `origin/main` | `78ef822` — **does NOT contain feature work** | NOTE |
| HEAD vs `origin/main` | **13 commits ahead**, 0 behind | NOTE |
| `origin/feat/mobile-ui-optimization` | `213f21f` (previously reported) — **present & reachable** | PASS |
| `213f21f` present locally | Yes (reachable from `main` and `feat`) | PASS |
| Local beyond `213f21f` | 1 unpushed commit: `32f58bc fix(calendar): move Connect-Google dialog into CalendarModal (was crashing FragmentRow)` | NOTE |
| Uncommitted tracked changes | None | PASS |
| Worktrees preserved | 4: `Bispun`(main), `Bispun-integ`(integration/mui-yc), `Bispun-release`(release/android-signing-prep), `Bispun-stab`(feat/referrals-integration) — untouched | PASS |
| Secret scan of `origin/main..HEAD` | Clean (only a markdown false-positive about a 401 response) | PASS |
| `wip` content in branch | `f5d235d wip(mobile-perf) … CHECKPOINT, not complete` is among the 13 commits | NOTE |

**Verdict:** GitHub `main` (`78ef822`) does **not** contain the audited Web/Mobile changes. They exist on `origin/feat/mobile-ui-optimization` (`213f21f`) and local `main` (`32f58bc`, 1 commit unpushed). No merge/push performed.

---

## 2. Frontend + Backend + Database — Phase 2

| Check | Result | Status |
|---|---|---|
| Frontend `http://localhost:5173` | HTTP 200 | PASS |
| Backend `http://localhost:4000` (no port conflict) | Running (reused existing process) | PASS |
| `/api/health` | 200 `{database:"connected"}` | PASS |
| Prisma → Neon dev | Connected | PASS |
| `SELECT 1` | `=> 1` | PASS |
| `current_database()` | `neondb` | PASS |
| DB host | `ep-blue-mouse-…neon.tech` (dev) | PASS |
| Production `pond` not used | Confirmed (pond only in a comment) | PASS |
| Web `VITE_API_URL` | `http://localhost:4000` | PASS |
| Background workers disabled | `DISABLE_BACKGROUND_WORKERS=true` | PASS |
| DB reset/migrate | None performed | PASS |

Minor: `.env` has a **duplicate `CLIENT_URL=` line** (second value wins; harmless) — Low, optional cleanup.

---

## 3. Google Calendar & Meet — Phase 3

Server Google state: `configured=true`, **`connected=false`** (current admin has not linked a Google account).

| Requirement | Result | Status |
|---|---|---|
| Calendar module loads | Week view renders, events load (200) | PASS |
| "Add video meeting" (Meet) option in event form | Present | PASS |
| In-place "Connect your Google account" dialog | Wired in `CalendarModal` (`connectDialogOpen`, `startGoogleConnect`); `32f58bc` moved it in-component to fix a FragmentRow crash | CODE-OK |
| No need to visit Settings → Integrations | Connect flow is in Calendar | CODE-OK |
| Employees can self-connect | Dialog is in Calendar (no Settings access needed) | CODE-OK |
| Meet link creation / generation | Requires a connected Google account | **BLOCKED** |
| Event organizer displayed correctly | `sr-only "Organizer:"` + organizer rendering present; not verified with real multi-user events | CODE-OK |
| Shared vs private event visibility | Not verifiable without real Google events/accounts | **BLOCKED** |
| "Not my meeting" misattribution | Depends on organizer data from real events | **BLOCKED** |
| Google API failure messaging | Dialog shows "Google isn't set up…" / waiting states | CODE-OK |

> Per your rule, all live Google/Meet behaviors are **BLOCKED**, not PASS, because no Google account is connected and I cannot complete a real OAuth sign-in.

---

## 4. Dashboard & Analytics — Phase 4

| Check | Result | Status |
|---|---|---|
| Dashboard loads | Yes | PASS |
| KPI values | Total Leads 1 / New 1 / Admissions 0 / Revenue ₹0 — consistent with 1 seeded lead | PASS |
| Leads by Source totals | API `leadsBySource=[{"Lead Store":1}]`; UI donut centre total "1 Leads" | PASS |
| Source counts add up / unspecified sources | Explainer "total includes direct admissions and leads with no recorded source" present | PASS |
| Action Center | Renders priority signals (all 0 in dev data) | PASS |
| Click lead → exact Lead Details | `openLeadDetail`/deep-link resolver present; no actionable lead in dev data to click | CODE-OK / NOT TESTED |
| Refresh + period filter | Controls present and functional (year selector 200) | PASS |
| Widget permissions | `pageAccess.dashboard.sections` honored | PASS |
| Desktop responsiveness | Desktop OK | PASS |
| Mobile responsiveness | Not exercised at mobile viewport this run | NOT TESTED |

---

## 5. Lead Store — Phase 5

| Check | Result | Status |
|---|---|---|
| Lead Store loads (no API errors) | `/lead-store` 200 (datasets) | PASS |
| Add Lead form | Opens with full field set (not submitted) | PASS |
| Import modal | Opens | PASS |
| Lead search incl. course | Search placeholder "…or course" | PASS |
| Course **filter dropdown** | Present in Filter panel ("All courses") | PASS |
| Course **column** | Present with drag-to-reorder UI | PASS |
| `interest` DB column | **Absent** (as required — none auto-created) | PASS |
| **Saved column order persists** | `GET /lead-store/column-preferences` → **HTTP 500** for admin/manager | **FAIL** |
| `User.leadStoreColumnOrder` in DB | **Missing** (schema+code have it; DB does not) | **FAIL** |
| Lead create/edit/details/export/Smart Nurture/Dial&Track/notes | Endpoints mounted; not individually exercised live | NOT TESTED |
| Cross-tenant lead access | List scoped to session `companyId`; returns only own company's lead; no client-controllable company param | PASS (API) |
| Employee-vs-employee isolation | `leadVisibility.js` (`assignedToUserId`) + unit tests pass; live per-employee login needs passwords | CODE-OK / **BLOCKED** |

**FAIL detail (column order):** `clientLeadStore.js:284` selects `leadStoreColumnOrder`; the column is not in Neon dev (`information_schema` returns 0 rows), so Prisma throws → route returns 500. The drag UI renders client-side, but load/save of saved order is broken for Client Admin & Manager. Employees are unaffected (route early-returns defaults before touching the column).

---

## 6. Notifications — Phase 6

| Check | Result | Status |
|---|---|---|
| List loads | `/notifications` 200, 7 items | PASS |
| Unread count correct | `/unread-count` 200; 5 unread badge = 5 unread items | PASS |
| Click **lead** notification → exact lead | No lead-type notifications exist in dev data; clicking any writes read-state (read-only run) | CODE-OK / **BLOCKED** |
| Other types → correct module | `actionModule` present (settings/dashboard); not clicked (write) | CODE-OK |
| Notification sound | `sound.js` gains increased (e.g. 0.20→0.34, 0.18→0.30) per `023d5bd` | CODE-OK |
| Sound audible / no clipping | Cannot verify audio from automation | NOT TESTED |
| Preferences respected | `/notifications/preferences` present | CODE-OK |
| Unauthorized record via deep link | Deep link resolves within session scope; not live-tested | CODE-OK |
| Mobile notification nav | Requires device/emulator | **BLOCKED** |

---

## 7. Users, Roles & Departments — Phase 7

| Check | Result | Status |
|---|---|---|
| Users list | `/users` 200 (4 users: 1 Client Admin + 3 Employees) | PASS |
| **Department dropdown loads company departments** | `/users/organization` 200 → departments + roles; Add User form has dept select | PASS |
| Add User / Edit User | Create route present (`clientUsers.js`), form renders | CODE-OK |
| Employee/Manager assignment respects permissions | Manager-scoping + permission clamping in route | CODE-OK |
| Client Admin permissions | `/me` shows full permissions | PASS |
| Super Admin permissions | No super-admin login available | **BLOCKED** |
| Restricted features via direct URL | Not exercised | NOT TESTED |

---

## 8. UTM Leads & Import — Phase 8

| Check | Result | Status |
|---|---|---|
| Module loads | Yes; UTM generator present | PASS |
| UTM links list / analytics | `/leads/utm/links` 200 (0 links), `/leads/utm/analytics` 200 | PASS |
| Import modal shows **optional UTM link attribution dropdown** | "Attribute to UTM link (optional)" + explainer present | PASS |
| Selected UTM link validated | Backend validates `utmLinkId` belongs to company (`5e22aae`) | CODE-OK |
| Imported leads get attribution / shown in analytics | No links/import run (would be a write) | NOT TESTED |
| Cross-company attribution blocked | Link validated against session company | CODE-OK |
| Existing UTM workflows intact | Generator + saved-links UI render | PASS |

---

## 9. Full CRM regression (API reachability) — Phase 9

All GET with authenticated Client Admin session:

| Module | Endpoint | Status |
|---|---|---|
| Auth/session | `/auth/me` 200; session survived reload | PASS |
| Dashboard/Analytics | `/analytics/dashboard` 200 | PASS |
| Lead Store | `/lead-store` 200 | PASS |
| Leads | `/leads` 200 | PASS |
| UTM | `/leads/utm/links`,`/utm/analytics` 200 | PASS |
| Admissions | `/admissions` 200 | PASS |
| Revenue/Finance | `/revenue` 200 | PASS |
| Walk-ins | `/walkins` 200 | PASS |
| Counselling | `/counselling` 200 | PASS |
| Calendar | `/calendar` 200 | PASS |
| Notifications | `/notifications` 200 | PASS |
| Users/Settings | `/users` 200, `/settings` 200 | PASS |
| Support | `/support` 200 | PASS |
| Google | `/google/status` 200 | PASS |
| Goals/Targets, My Referrals, My Store, Chats | Root-path probes 404 (routers define sub-paths; modules **are** mounted in `server/index.js`); not individually exercised | NOT TESTED |
| Logout | Not triggered (ends session) | NOT TESTED |
| Super Admin / Subscription Plans / Role Permissions (admin UI) | No super-admin login | **BLOCKED** |

---

## 10. Mobile CRM (Android/Capacitor) — Phase 10

| Check | Result | Status |
|---|---|---|
| Capacitor config | `com.bispun.crm`, `webDir: dist` | PASS |
| Web build (feeds Capacitor) | `dist/` produced; `npm run build` exit 0 | PASS |
| Android project structure | `gradlew`, `build.gradle`, `app/build.gradle`, `local.properties` (SDK path) present | PASS |
| Capacitor plugins | android, app, core, push-notifications installed | PASS |
| Emulator API base | `VITE_API_URL=http://10.0.2.2:4000` documented for emulator | PASS |
| Gradle APK build | Not run this session | NOT TESTED |
| Login / session restore / logout / nav / back / native links / FCM push / notification tap | Require emulator or device | **BLOCKED** |
| Desktop unchanged by mobile work | Desktop verified working (above) | PASS |

> Per your rule, native runtime is **BLOCKED** — no emulator/device in this session. I can run `./gradlew assembleDebug` on request (slow; may surface the gradle issues noted in prior handover docs).

---

## 11. Database & Backend security — Phase 11

| Check | Result | Status |
|---|---|---|
| Prisma connects to dev | Yes | PASS |
| `SELECT 1` | OK | PASS |
| Schema ↔ DB compatibility | **MISMATCH**: `leadStoreColumnOrder` in schema/code, **missing in DB** | **FAIL** |
| `interest` column | Absent (as required) | PASS |
| Lead columns | `companyId`, `assignedToUserId`, `utmLinkId`, `course` present | PASS |
| Tenant isolation | Queries scoped to session `companyId`; no client company param | PASS |
| Employee lead-assignment enforcement | `leadVisibility.js` + unit tests | CODE-OK / **BLOCKED** (live) |
| Role-based API auth | `requireClientUser` / `requireUserManager`; column-pref PATCH admin/manager-only (403 else) | CODE-OK |
| No production connection | Confirmed blue-mouse only | PASS |
| No DB changes made | Confirmed read-only | PASS |

---

## 12. Automated regression — Phase 12

| Check | Result | Status |
|---|---|---|
| Unit tests (`npm test`) | **23/23 pass** (`pushService`, `pushDispatch`, `leadVisibility`) | PASS |
| Full coverage? | **No** — only 3 test files execute; not comprehensive | NOTE |
| Integration / mobile regression suites | None present in repo | NOT AVAILABLE |
| Production build (`npm run build`) | **Success (exit 0)** | PASS |
| Secret scanning (branch diff) | Clean | PASS |
| Git diff checks | Done (Phase 1) | PASS |

> Previously reported "23/23 + build" is **re-confirmed** on current source. There is no larger suite to run — do not read 23 tests as full regression coverage.

---

## 13. Problems found & proposed fixes — Phase 13

### P1 — Saved Lead Store column order broken (High)
- **Module:** Lead Store → column preferences (Client Admin / Manager).
- **Expected:** `GET /api/client/lead-store/column-preferences` returns saved order; PATCH saves it; order persists after refresh.
- **Actual:** GET returns **HTTP 500 "Unable to load column arrangement"**; save would also 500.
- **Root cause:** `User.leadStoreColumnOrder` (`schema.prisma:278`, used in `clientLeadStore.js:284,326`) was never applied to the Neon dev DB (`information_schema` confirms the column is absent).
- **Severity:** High (feature regression for admins/managers; 500 on every Lead Store load for them).
- **Proposed minimal fix:** `npx prisma db push` against blue-mouse to add the defaulted `String[]` column. **This is a DB schema change → GATED; not performed. Awaiting your approval.**
- **Regression risk:** Low — adds one nullable-with-default array column; no data rewrite. (A code-only workaround to tolerate the missing column is possible but is a hack; the schema push is the correct fix.)
- **Fix applied:** **No** (gated).

### P2 — Duplicate `CLIENT_URL` in `.env` (Low)
- Two `CLIENT_URL=` lines; the later one wins. Harmless but should be de-duplicated. Not committed (env file). Fix applied: No.

**No automatic fixes were applied** — the only functional defect requires a gated DB migration.

---

## 14. Final checklist & readiness — Phase 14

- GitHub branch comparison — **done** (main lacks feature work; on feat/`213f21f` + local `32f58bc`).
- Frontend status — **PASS**.
- Backend status — **PASS**.
- Neon DB status — **PASS** connectivity; **FAIL** schema/DB parity (`leadStoreColumnOrder`).
- Automated tests — **23/23 PASS**; limited coverage.
- Build — **PASS**.
- Feature-by-feature — see Phases 3–9 (today's features present; column-order persistence FAIL).
- Security — tenant isolation PASS (API); employee isolation CODE-OK + BLOCKED (live).
- Desktop regression — **PASS** (all probed modules 200).
- Mobile regression — **BLOCKED** (no emulator/device).
- Google OAuth/Meet — **BLOCKED** (no connected account).
- DB schema compatibility — **FAIL** (one missing column).
- Bugs found / fixes applied — 1 High found, **0 applied** (gated).
- Outstanding blockers — employee-login isolation, Google Meet, Android runtime, super-admin UI.

### Production-readiness verdict: **NOT READY (Conditional-GO)**
Fix **P1** (`prisma db push` — with your approval) and clear the BLOCKED items (employee logins, a connected Google account, an Android emulator run). Then re-run this audit. Do **not** merge to `main` until P1 is resolved and feature work is intentionally promoted.

---

### What I need from you to lift the BLOCKED items
1. **Approve `prisma db push`** on blue-mouse to fix the column-order FAIL (dev only).
2. **Dev passwords for the 3 Student Mentor employees** (or create one isolated test employee, with approval) → live employee lead-isolation tests.
3. **A connected Google account** in Calendar → live Meet creation / organizer / shared-vs-private tests.
4. **Android emulator/device** availability → native runtime (login, push, nav, native links).
