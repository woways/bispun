# Bispun CRM — Web + Android Stabilization Tracker (2026-11-03)

Lead: full-stack / Android / QA / security / perf / UI review. **Read-only audit phase complete; no code
changed, nothing run against any database, nothing signed/pushed/merged/deployed.** This file is the live
issue tracker (Phase 0.10).

## Phase 0 — workspace & baseline (DONE, read-only)
- **Worktrees:** `S:/Bispun` (`feat/mobile-ui-optimization` @ `c6b55cc`), `S:/Bispun-integ`
  (`integration/mui-yc` @ `70b8209`), `S:/Bispun-release` (`release/android-signing-prep` @ `47396dd`).
- **Latest main (fetched, verified):** `origin/main` = **`c349759`** (PR #3 merge) — **no commits after it**;
  baseline assumption holds. Local `main` branch is stale (`421120b`, behind 41) — origin/main is truth.
- **CORRECTED baseline fact (verified by ancestry + file + commit evidence):** `origin/main` (c349759)
  **CONTAINS all mobile work.** `70b8209` (integration/mui-yc) and `c6b55cc` (feat/mobile-ui-optimization
  tip) are **both ancestors of origin/main**; zero commits exist on either branch that aren't in main; all
  5 recent mobile commits (compact KPI `0e9fa2c`, keyboard-safe chat `7550573`, calendar agenda `92adc62`,
  margin-collapse `9a78f11`, QA docs `c6b55cc`) are in main; CallCenterModal/NurtureCenter present and wired
  in main's LeadStore; functional diff main↔integration = empty. *(My initial "main lacks mobile work" was
  wrong — it read the stale local `main` ref `421120b`, not `origin/main`.)*
- **Base chosen:** latest **`origin/main`** (per decision rule — no remerge, no branch recreation).
- Untracked local reports preserved (45 files). No tracked edits in any worktree.

## Issue register (severity · status)

### 🔴 BLOCKER-1 — Local backend/Prisma target the PRODUCTION database by default
- **Severity:** Critical (data-safety). **Status:** OPEN — blocks all DB-backed work.
- **Evidence:** `server/index.js:1` and `server/lib/prisma.js:1` both `import "dotenv/config"`; only
  `dotenv` is installed (no `dotenv-flow`/`env-cmd`). Plain dotenv loads **`.env` only**, never
  `.env.development`. `npm run server` = `node --watch server/index.js`. The default `.env` (all three
  worktrees) has `DATABASE_URL`/`DIRECT_URL` = **`ep-weathered-pond-axt9umrv` = pond = PRODUCTION**;
  `.env.development` has dev `ep-blue-mouse-b4if0xzj` but is **never read by the backend**.
- **Impact:** running the backend or any Prisma CLI (`db push`, `migrate`, `studio`) locally connects to
  **production**. Creating QA users or write-tests locally would modify production data. This also likely
  contributes to reported inconsistencies if local/dev and prod were ever mixed.
- **Root cause:** backend uses mode-agnostic `dotenv/config`; prod DB creds live in the local `.env`
  (they belong only in Render's env). Vite (frontend) *does* read `.env.development`, so the split is
  frontend-only — the backend has no dev/prod split locally.
- **Fix (needs approval — touches local env + prod creds):** point the local `.env`
  `DATABASE_URL`/`DIRECT_URL` at **blue-mouse (dev)** to match `.env.development`, and remove pond creds
  from the local file (production reads its own `DATABASE_URL` from Render, not this file). Optionally make
  the backend load `.env.development` when `NODE_ENV!==production` for a real split. **Until fixed: run no
  backend, no Prisma command.**

### 🟠 ISSUE-2 — Release keystore alias mismatch
- **Severity:** High (blocks signing). **Status:** OPEN — config-only fix, no keystore change.
- **Evidence:** `S:/Bispun-release/android/app/bispun-release.jks` exists (2592 bytes, created 03-Nov-2026,
  1 PrivateKeyEntry). Actual alias = **`bispun-releasekey0`** (Android Studio default). Signing config +
  `keystore.properties.example` expect **`bispun-release`**. `keystore.properties` still **not created**.
- **Fix:** create `S:/Bispun-release/android/keystore.properties` from the example with
  **`keyAlias=bispun-releasekey0`**, `storeFile=bispun-release.jks`, and your store/key passwords.
  Do **not** recreate the keystore. Both files stay gitignored. (I will not handle the passwords.)

### 🔴 LOGIN-4 — Transient backend failures during auth bootstrap force a false logout (intermittent login / refresh-fixes-it)
- **Severity:** Critical (priority #1). **Status:** ✅ DONE — FIXED + a11y-APPROVED + BUILD-PASS + LIVE-VERIFIED + COMMITTED `689fe5d` (local, not pushed). a11y-lead re-verify: **PASS, approved to merge** (all 3 MAJOR fixed); `vite build` exit 0.
- **Live verification (built-in browser, dev stack on blue-mouse):** real 401 → `/login`; backend **down** →
  2 retries → **"Can't reach the server / Try again"** `role=alert` screen with focused `<h1>`, path stays
  `/app` (NO logout); backend back → normal routing. No React console errors.
- **a11y-lead second pass:** state machine / classification / reduced-motion PASS. 3 MAJOR fixed →
  (A) removed colliding `aria-label` on Retry (2.5.3); (B) Retry contrast `text-slate-950` on sky (1.4.3);
  (C) loading screen focuses its `<h1>` on mount so Retry→checking isn't silent. Follow-up filed below.
- **Fix applied (branch `fix/bispun-web-mobile-stabilization`):**
  - `src/lib/api.js` — tag network/abort errors (`isNetworkError`); add `classifyAuthError()`
    (maintenance / unauthenticated=401,403 / transient=network,timeout,429,5xx,unknown).
  - `src/App.jsx` — new `useAuthBootstrap(path)` hook: retries transient failures (2×, 1s/3s backoff,
    30s timeout) then shows an explicit **"Can't reach the server — Try again"** screen; redirects to login
    ONLY on 401/403 (no silent logout). New accessible `AuthMessageScreen` (role=alert/status, `<h1>`,
    focus-to-heading on appearance keyed to attempt, document.title, focus-visible ring). Loading screen
    hardened: `aria-busy`+`role=status`, skeleton `aria-hidden`, all 3 animations disabled under
    `prefers-reduced-motion`. All three guards (client, admin-guest, admin) now resilient.
  - a11y-lead checklist obtained and followed; its diff-review criteria still to be run against the change.
- **Evidence (static):** `src/lib/api.js:140` `apiRequest` throws on any `!response.ok`; it also rejects on
  network error / timeout. `src/App.jsx` `verifyClient` (≈342–403) and the two admin guards catch **every**
  error except `status===503 maintenance` and set `unauthenticated` → `<Navigate to="/login">`. No retry.
- **Impact:** a cold **Render** backend or **Neon** autosuspend cold-start (first request after idle) returns
  5xx/timeout → a user with a valid session cookie is bounced to login; a refresh (now warm) works. Matches
  "sometimes login fails / screens need a refresh."
- **Root cause:** no distinction between *not authenticated* (401/403) and *couldn't reach/validate auth*
  (network/5xx/timeout); no bootstrap retry.
- **Fix (minimum, honest):** classify errors — redirect to `/login` only on 401/403; on transient
  network/5xx/timeout, retry with bounded backoff, then show an explicit **"Can't reach server — Retry"**
  screen (NOT a silent redirect, per your rule). Apply to all three guards. UI change → a11y-reviewed.
- **To confirm live:** reproduce by pausing the backend mid-session (Phase 4 live test, pending stack up).

### 🟢 BROWSER-2 — Cross-browser/laptop inconsistency: root-caused (Priority 2)
- **Status:** AUDIT DONE (Chromium live + code). **No new code bug** beyond LOGIN-4 (already fixed).
- **The exact reasons (evidence-based), separating by-design from bugs:**
  1. **Module visibility is SERVER-driven** — `/api/client/auth/me` returns the company's module list
     (verified live: QA admin → all 10 modules). Same user+company = identical modules on ANY browser.
     Cross-**company** differences are **by design** = plan entitlements (`PlanModule`→`CompanyModule`;
     Basic omits walk-ins/counselling). NOT a bug.
  2. **Role/permissions** (CLIENT_ADMIN vs EMPLOYEE + `canManage*` + `pageAccess`) → by design.
  3. **Per-browser `localStorage`** is the MAIN "looks different across laptops/browsers" cause, confirmed
     live: `cb_global_year` (="2026"; the global YEAR filter → different data & empty states look like
     "missing features") and `cb_ui_preferences` (layout/sidebar prefs). By design (per-browser prefs), not
     a code bug — but the biggest perceived-inconsistency source. A different laptop with a different stored
     year shows different numbers/sections.
  4. **No service worker**; Vercel serves content-hashed assets (immutable) + `index.html` revalidated by
     default → stale-asset/chunk-load risk LOW (not the cause). `vercel.json` has rewrites only, no headers.
  5. **Refresh-dependent behavior** = LOGIN-4 (fixed).
- **Responsive (Chromium live):** 375px → no horizontal overflow, mobile bottom nav (Dashboard/Leads/
  Admissions/Finance/More); 1440px → desktop sidebar, no overflow. PASS.
- **PASS/FAIL/BLOCKED/NOT TESTED:** single-browser authenticated render + responsive = **PASS**;
  module/role/subscription visibility correctness = **PASS** (server-driven); **Chrome-vs-Edge direct
  comparison = NOT TESTED** (Edge not automatable here; both are Chromium so no engine-level diff — any
  difference is cache/storage/profile/extensions, mechanism identified); multi-physical-laptop = NOT TESTED
  (driver = per-browser localStorage, identified).
- **Recommendations (hardening, not verified bugs — hold for approval):** (a) explicit `Cache-Control` in
  `vercel.json` (index.html `no-cache`, `crm-assets/*` `immutable`) belt-and-suspenders vs stale HTML on
  corporate proxies; (b) default the year filter to the latest year WITH data so an empty old year doesn't
  read as "features missing."
- **Dev note:** set a known dev password on the 3 synthetic blue-mouse QA users (admin + 2 employees) to
  enable authenticated testing; recorded in the session scratchpad (not committed, not in this report).

### 🟢 MULTITENANT-3 — Multi-company isolation + role/subscription (Priority 3)
- **Status:** TESTED on blue-mouse (API-level, live backend). **PASS** on isolation, roles, subscription.
- **Setup (synthetic, blue-mouse only, re-confirmed identity in-guard):** created **Company B = "QA Company B"**
  (id `cmw0ng4pf…`) on the **Basic plan (8 modules, no walk-ins/counselling)** with a CLIENT_ADMIN
  (`qa.b.admin@example.com`) + EMPLOYEE (`qa.b.emp@example.com`). Company A = "Bispun Mobile QA" (10 modules).
- **Tenant isolation — PASS:** Company A leads list = **2** (its own); Company B list = **0** (does NOT see
  A's). Cross-tenant read of an A lead by id using B's token → **HTTP 404** (blocked). Server scopes by
  `companyId`.
- **Subscription/module config — PASS (by design, server-enforced):** `/auth/me` returns the company's
  module set — A=10 (incl. walkins, counselling), B=8 (Basic, neither). Confirms "clients see different
  modules" is intentional plan entitlement, not a bug.
- **Role visibility — PASS:** Company A admin sees all 2 leads; employees A & B see **0** (assigned-only
  scoping enforced server-side, not just hidden in UI).
- **Dev vs prod Super Admin — structurally safe:** these QA companies live in **blue-mouse (dev)**; the
  production Super Admin runs against **pond** — separate DB, so dev QA companies cannot appear there.
- **Super Admin visibility (dev) — NOT TESTED:** no SUPER_ADMIN exists in blue-mouse (0 platform users);
  would need a synthetic super-admin via the separate `/api/admin/auth` flow. Can add on request.
- **Dev writes to clean up later:** Company B + its 2 users; dev passwords set on the 3 Company-A QA users
  (creds in session scratchpad, not committed).

### 🟢 PERF-4 — Performance baseline + bundle optimization (Priority 4)
- **Status:** BASELINE CAPTURED; one safe fix applied (lazy PDF). Measured on blue-mouse dev stack.
- **⚠️ Measurement caveat (critical):** the backend here is **local, talking to remote Neon (us-east-2)**.
  `GET /` (no DB) = **~2ms**; every DB endpoint ≈ **2.3–4.5s**, warm too. So the multi-second API times are
  **network RTT to remote Neon from the dev machine — a dev artifact, NOT app or production slowness.** In
  prod, Render is co-located with Neon (tens of ms). Do not read these as production numbers.
- **Baseline (dev):** login 4–8s; auth/me ~3s (heaviest: user+company+modules+permissions); leads/revenue/
  analytics/admissions 2.3–4.5s — all dominated by the Neon RTT floor. Dashboard load = **5 API calls, 4
  unique** (auth/me, chat/unread-count, calendar, calendar/users) — modest, no severe waterfall.
- **`/auth/me` fires 2× = React StrictMode dev-only double-invoke** (`main.jsx` `<React.StrictMode>`); prod
  builds don't double-invoke. ClientPortal consumes the `clientSession` prop (no real duplicate fetch). Not
  a prod issue.
- **Real, production-relevant finding — bundle weight (affects Android WebView startup):**
  - `ClientPortal` chunk = **1.44 MB (234 KB gz)** — a monolith: 12 module components
    (Dashboard/LeadStore/Revenue/Analytics/Walkins/Counselling/UTMLeads/Admissions/Settings/Help/Calendar/
    Chat) are **statically imported**, so the whole app loads on login.
  - `jspdf`+`html2canvas`+`dompurify` (~700 KB) loaded **eagerly** via `invoicePdf.js`'s top-level import,
    though PDF export is rare.
- **✅ Fix applied (safe, no UI/behavior change):** `src/lib/invoicePdf.js` now loads `jsPDF` (and its
  transitive html2canvas/dompurify) via **dynamic `import()`** inside each exporter (functions made async;
  callers are fire-and-forget onClick handlers). → ~700 KB deferred to first actual PDF generation. Bundle
  re-measure pending build.
- **Recommended larger fix (needs approval + a11y, higher impact):** lazy-load the 12 module components with
  `React.lazy` + Suspense so only the active module loads — biggest win for initial load + WebView startup +
  "slow navigation." Changes loading UX (skeletons) → route through accessibility-lead. Proposed, not done.

### 🟢 UIANIM-5 — Mobile UI / animation polish (Priority 5)
- **Design proposal:** `MOBILE-UI-DESIGN-PROPOSAL.md` — lightweight CSS-only motion layer (no libs), mobile
  only (`lg:hidden`), reduced-motion-aware. **accessibility-lead APPROVED with a checklist** (global
  reduced-motion must also neutralize looping animations + smooth-scroll; no `transition:all`; never
  transition the focus ring; sheet dismissal stays instant; `aria-current` synchronous; chat live-region +
  calendar a11y-tree must stay intact).
- **✅ Implemented + committed `ab9bf85` (steps 1–3) — accessibility-lead diff-review: PASS (all 8 criteria, no fixes):**
  - `src/index.css` — motion tokens (`--cb-ease`, `--cb-dur-*`), opacity/transform keyframes
    (`cbFadeIn/cbFadeInUp/cbSheetIn/cbBackdropIn`) + utility classes, and a GLOBAL
    `@media (prefers-reduced-motion: reduce)` rule (near-zero durations + `animation-iteration-count:1` so
    shimmer/pulse go static + `scroll-behavior:auto`).
  - `src/components/mobileUi.jsx` — `BottomSheet` backdrop-fade + slide-up on open (dismissal unchanged/instant);
    `MobileBottomNav` color transition + `active:scale-95` press feedback (resting ≥56px) + fading
    `aria-hidden` indicator; `transition-[color,transform]` only (focus ring instant).
  - **Verified live (375px):** More sheet opens animated, focus trapped; Esc → instant dismiss + focus
    return + scroll unlock. Build exit 0. Desktop untouched.
- **Remaining (steps 4–5, pending):** KPI/card fade-in + press affordance; module-mount fade; chat
  last-bubble fade (must not block its `aria-live`); calendar cross-fade (no duplicated a11y-tree content).
- **Gated on user:** the bigger `React.lazy` module code-split (PERF-4 recommendation) — awaiting go/no-go.

### 🟡 OBSERVATION-3 — Module/feature differences across clients are likely BY DESIGN
- **Severity:** Info (shapes Phase 3). **Status:** to verify with QA matrix.
- **Evidence:** schema has `Plan`, `Module`, `PlanModule`, `CompanyModule`, `Subscription` (schema.prisma
  374–453). Module visibility is entitlement-driven, so different clients legitimately seeing different
  modules is expected. Phase 3 must establish the **expected feature matrix** per plan and flag only
  *unexplained* differences (e.g., same plan, different modules; or stale cached build).

## Phase 1 — environment isolation (audit DONE; mapping below)
| Surface | Dev | Prod | Notes |
|---|---|---|---|
| Web CRM frontend API | `.env.development` → `localhost:4000` | Vercel build → `api.bispun.com` | Vite mode split OK |
| Android APK frontend API | `.env` → `10.0.2.2:4000` (emulator); `.env.release` → `api.bispun.com` | release mode OK | `src/lib/api.js` throws if unset in PROD |
| **Backend DB** | **intended blue-mouse** | pond (Render) | 🔴 **BLOCKER-1: local backend actually uses pond** |
| CORS | allowlist + `credentials:true`, mobile origins `capacitor://localhost`,`ionic://localhost` | same | sane (no wildcard-with-credentials) `server/index.js:98` |
| Auth | httpOnly cookie (web) + JWT Bearer (mobile); `secure/sameSite` gated on `NODE_ENV` | — | `server/routes/clientAuth.js` |
| Multi-tenant | `companyId` scoping present in client routes | — | to exercise in Phase 2 |
| Workers | `DISABLE_BACKGROUND_WORKERS` gate | — | keep disabled |

## Blocked pending runtime infra / access (document & continue)
- **Dev backend not running** + **BLOCKER-1** → Phases 2, 4, 8 (DB-backed QA, login, functional) BLOCKED.
- **Emulator closed / no physical device** → Phases 7(jank), 9 (Android+FCM device) BLOCKED.
- **Browsers for cross-test** (Edge/Firefox) + **Render/Vercel/Neon read-only dashboard access** (no creds
  here) → parts of Phases 1(5), 3 BLOCKED / NOT TESTED.
- **Production authenticated testing** requires email+phone verification (phone not complete) → do NOT
  bypass; need an approved staging/test-account plan.

## Decisions — RESOLVED
1. **Stabilization base** = latest **`origin/main`** (verified to contain all mobile work). Worktree
   **`S:/Bispun-stab`** on branch **`fix/bispun-web-mobile-stabilization`** @ `c349759`. No remerge.
2. **BLOCKER-1 fixed (approved "repoint to dev"):** both `S:/Bispun/.env` and `S:/Bispun-stab/.env` now use
   **blue-mouse (dev)** for `DATABASE_URL`/`DIRECT_URL`; no pond reference in active `.env`. Original saved
   to `S:/Bispun/.env.pond.bak` (gitignored). ⚠️ `S:/Bispun-integ/.env` still points at pond — flagged,
   not changed (separate preserved worktree); fix or ignore per your call.
3. **Keystore (ISSUE-2):** still needs **you** to create `S:/Bispun-release/keystore.properties` with
   `keyAlias=bispun-releasekey0`, `storeFile=bispun-release.jks`, and your passwords. Keystore untouched.

## Progress
- ✅ Phase 0 (baseline, worktree), Phase 1 (env isolation audit + fix, all worktrees → blue-mouse,
  workers off, backups safe), Phase 10 (keystore read-only + path corrected).
- ✅ Dev stack verified on blue-mouse (1 QA company "Bispun Mobile QA": admin + 2 employees, 2 leads).
- ✅ **Priority 1 (LOGIN-4):** fixed, live-verified, committed `689fe5d`.
- **Next priorities:** P3 two-company cross-tenant/role QA (create synthetic Company B in blue-mouse) →
  P2 browser/cache/feature-visibility → P4 navigation/API perf → P5 mobile UI/animation (a11y-gated +
  brainstorm). All UI edits route through accessibility-lead first.

## Follow-ups (filed, not done)
- **A11Y-FOLLOWUP-1 (separate PR):** `/login` + `/admin/login` and the authenticated app mount do not move
  focus to their `<h1>`/first field on navigation (WCAG 2.4.3). Pre-existing (not introduced by LOGIN-4);
  a11y-lead flagged as the likeliest silent SR gap in the broader app. Fix in a focused follow-up.
- **DEV-DATA:** 2 synthetic leads (IDs 1–2) in blue-mouse to clean up when QA is done.

**No pushes/merges/deploys/signing. No production data changes.**
