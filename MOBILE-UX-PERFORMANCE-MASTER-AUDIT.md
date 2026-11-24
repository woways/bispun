# Bispun CRM — Mobile UX & Performance Master Audit

**Branch:** `feat/mobile-ui-optimization` (now even with `origin/main` @ `f201742`)
**Scope:** Investigation + **implementation plan only — no code was edited.** No production/DB/schema changes. Nothing pushed/merged/deployed. No other branches/worktrees touched.
**Goal:** make the Android/mobile experience faster, smoother and more comfortable than desktop, **without removing, hiding (without an accessible alternative), breaking or downgrading any existing feature** (role permissions, Lead Store, Smart Nurture, Dial & Track, Admissions, Finance, Referrals, notifications, OTP verification, Analytics, and every other authorized module).

---

## Method & honesty caveats (read first)

Two kinds of evidence are used, and they must not be confused:

- **Production bundle sizes** — real bytes from the existing `dist/` build. Trustworthy as-is.
- **Runtime timings** — measured live in the in-app browser (mobile-emulated 375×812) against the **dev** server + **Neon blue-mouse dev DB**. These absolute milliseconds are **NOT production mobile numbers** because: (a) Vite dev serves unbundled ES modules, (b) the dev Neon DB cold-starts (first queries took multiple seconds), and (c) React **StrictMode** double-invokes effects in dev, so many calls appear ×2. What transfers to production is the **structure** (duplicate calls, serial gating, remount-refetch), not the absolute times.

Where a number is dev-only it is labelled. True device/Android cold-start and time-to-interactive still need a profiled run on a real device/emulator (flagged below).

---

# PHASE 1 — PERFORMANCE INVESTIGATION (measured)

## 1A. JavaScript bundle (production `dist/` — real sizes)
- `manualChunks` is minimal: only `{ charts: ["recharts"], icons: ["lucide-react"] }` (`vite.config.js:17-21`). No react/vendor split.
- **`charts-*.js` = 709 KB (~206 KB gzip)** — recharts + d3. Statically imported by `Dashboard.jsx:29-40`, `Revenue.jsx`, `Analytics.jsx` (client+admin), `AdminDashboard.jsx`. Dashboard is the landing module and renders charts in its body, so **recharts is on the first-paint critical path after login — it is NOT lazy.** This is the single biggest bundle problem.
- `ClientPortal-*.js` = **419 KB** — one 6133-line component that statically imports feature views (`GoalsAndTargets`, `Referrals`, `MyStore` — `ClientPortal.jsx:183-185`) that could be split.
- **jsPDF + html2canvas (~700 KB) are already lazy** (`invoicePdf.js:37,196,340` `await import(...)`) — good, no action.
- No `firebase`, `xlsx`, or date libs in the client bundle — good.
- **`bispun-logo` SVG is 991 KB** (`dist` asset) — oversized download/decode on mobile.
- Eager critical path to an interactive dashboard ≈ **~1.5 MB raw** (entry 108 KB + ClientPortal 419 KB + icons 91 KB + CSS 126 KB + Dashboard 91 KB + **charts 709 KB**). recharts ≈ half.

## 1B. Startup / auth / session (sequence measured)
- Cold start paints **blank** until React hydrates (`index.html:24-26` is a bare `#root`, no inline splash). Then three different loaders exist: the full "Getting your workspace ready" skeleton (`App.jsx:39-319`, with a 9-dot `LoadingDots`), a "Checking workspace…" spinner on the login route (`ClientLogin.jsx:128-140`), and "Loading dashboard…" inside the dashboard (`Dashboard.jsx:1091-1098`).
- **Login does a hard reload:** on success `ClientLogin.jsx:98` calls `window.location.replace("/app")`, rebooting the whole SPA → fresh `/auth/me` → lazy ClientPortal chunk → lazy Dashboard chunk → dashboard analytics fetch, **all serial**.
- **Session restoration blocks on `/auth/me`** on every cold start before anything app-like renders (`App.jsx:401-404`, 30 s timeout). Persistent login already works (httpOnly cookie on web; `cb_auth_token` in localStorage on native — `api.js:15-47`); the delay is loader timing, not missing persistence.
- **Measured serial gating (dev, Neon-cold):** on `/app` load the dashboard data call (`/api/client/analytics/dashboard`) did not even start until **~8.0 s**, because it waits behind `/auth/me` (which took ~3–6 s on the cold dev DB). Warm, the same `/auth/me` was **8–16 ms**. → the long wait is **backend/infra (Neon cold-start)**, not frontend; the frontend fault is that the data fetch is *gated serially* behind auth instead of fired in parallel/prefetched.
- **No refresh-token logic.** 401 → on native clears the token; route guard re-checks on next bootstrap. Transient/offline failures are retried with backoff and show a Retry screen, **never an auto-logout** (`App.jsx:383-434`, `api.js:105-171`) — this safety behaviour must be preserved by any change.

## 1C. Navigation & rendering (confirmed live)
- Module routing is local state (`const [module,setModule]` — `ClientPortal.jsx:558-563`), synced to the URL. The active module mounts at a single point wrapped with **`key={module}`** (`ClientPortal.jsx:5240-5244`), which **forces a full teardown + rebuild of the module subtree on every switch**. There is **no keep-alive / no cache** of mounted modules.
- **No data cache** (no react-query/SWR). Each module refetches on mount: LeadStore (`LeadStore.jsx:3100`), Revenue (`Revenue.jsx:1556`), Analytics (`Analytics.jsx:229`), UTMLeads (`UTMLeads.jsx:1622`), Walkins/Counselling, Dashboard (`Dashboard.jsx:478`), Admissions (several).
  - **Confirmed live:** Dashboard → Leads → Dashboard refetched lead-store, lead-store/manual, meta/assignees, status-options on the way in, then calendar + analytics/dashboard again on return. Every switch = fresh network wait + spinner, lost scroll/in-module state.
- **No React Context**; shell state (notifications, chat-unread, socket) lives in the one 6133-line component, and modules aren't `React.memo`. So the 45 s notification poll (`:1657`), 25 s chat poll (`:1703`), and socket events (`:1788`) re-render the whole portal including the active module.
- **Mobile bottom nav** exposes 4 primary modules (Dashboard, Leads, Admissions, Finance) with everything else under **More** (`mobileUi.jsx:312`, `ClientPortal.jsx:1290-1327`). Each tap calls `setModule` → same full remount+refetch path — **the #1 contributor to mobile switch latency/jank.**

## 1D. Duplicate requests (measured)
- **`/api/client/auth/me` fires more than once on startup** — `ClientLogin.jsx:45` probes it *and* `App.jsx` bootstrap calls it. In dev StrictMode this appeared as 4×; the genuinely redundant one is the login-route probe overlapping the app bootstrap. (The ×2 on every other endpoint — years, unread-counts, calendar, analytics — is StrictMode in dev and will not occur in the production build; **to be re-confirmed against a production build**.)

## 1E. Android / Capacitor (levers)
- Good baseline: WebView loads **bundled local assets** (`capacitor.config.json` — `webDir dist`, `androidScheme http`), no remote boot round-trip. Motion primitives are **transform/opacity-only** and **`prefers-reduced-motion` is honoured globally** (`index.css:135-182`). Back-button/overlay handling is solid (`BackButtonHandler.jsx`, `backStack.js`).
- Levers not yet used: **no `@capacitor/status-bar`** (system status bar unmanaged; no `<meta name="theme-color">`), **no `@capacitor/splash-screen`** (native splash is a static drawable that dismisses at WebView first-paint → blank gap before React), **no `@capacitor/keyboard`** (handled per-component via `visualViewport`). `android:hardwareAccelerated` not explicitly declared; release `minifyEnabled false` (`android/app/build.gradle:20`). **Fonts load remotely from Google Fonts** at startup (`index.html:13-19`) despite bundled assets — a cold-launch network dependency.

## Network/backend vs frontend — the split the brief asked for
- **Backend/infra latency:** Neon dev-DB cold-start dominates the big absolute numbers (auth/me 3–6 s, dashboard 4–8 s cold; milliseconds when warm). Production `pond` has the same serverless cold-start class; the login-resilience retry/503 work already shipped mitigates failures but not first-hit latency.
- **Frontend latency/jank (what we own here):** 709 KB eager recharts; serial auth→data gating; full remount + full refetch on every module switch; whole-portal re-renders from polls/socket; duplicate `/auth/me`; blank-screen/hard-reload startup; remote fonts.

---

# PHASE 2 — MOBILE UX DESIGN (directions — desktop unchanged unless separately approved)

- **Navigation:** keep the 4-primary + More bottom nav, but make switches *instant* by keeping visited modules alive and cached (Phase 5 #2). Consider remembering the last-opened module.
- **Bottom navigation:** already safe-area aware and non-color-only active state (`mobileUi.jsx:312-359`); refine touch target sizes (≥44 px) and active feedback.
- **Compact KPI cards:** the compact mobile KPI grids already landed (commit `0e9fa2c`); extend the pattern consistently and let KPI/table content paint *before* charts stream in.
- **Mobile-friendly forms:** larger touch targets, correct `inputMode`/`enterKeyHint`, keyboard-safe fields (chat/calendar already handle `visualViewport`); standardize via a native keyboard plugin.
- **Clean sheets & dialogs:** `BottomSheet` is a proper focus-trapped dialog with Android-back close — reuse it everywhere a modal appears on mobile.
- **Consistent headers & spacing:** one mobile app-bar height, safe-area top, consistent module header/spacing tokens.
- **Lightweight transitions:** reuse the existing `cb-*` transform/opacity animations; add a subtle cross-fade on module switch once keep-alive lands.
- **Responsive touch feedback:** `active:scale`/`:active` states with `motion-reduce:` fallbacks (pattern already used in Referrals).
- **Reduced-motion accessibility:** already global; keep every new animation within the `cb-*` tokens so it stays covered. Every UI change will go through the accessibility review before it lands.

---

# PHASE 3 — APP STARTUP (splash + persistent login — design)

- **Branded splash:** existing Bispun logo (`src/assets/bispun-logo.svg`) + **three** animated dots (trim the existing 9-dot `LoadingDots`), shown **only while real work is in flight** — it replaces the `status==="checking"` branch and the `Suspense` fallback (`App.jsx:455-457,545`) and unmounts the instant `/auth/me` resolves. **No artificial delay.**
- **Kill the native→React blank gap:** place the same branded markup as static HTML inside `index.html`'s `#root` so it paints at WebView load and is replaced on React mount. (Optionally add `@capacitor/splash-screen` for a JS-controlled hide, but the static-HTML approach needs no new plugin.)
- **Returning user enters without re-login:** persistence already works (cookie/JWT). Improvements: (a) replace the **hard reload** on login with a client-side `navigate` so the SPA doesn't reboot; (b) prefetch the ClientPortal + Dashboard chunks and fire the dashboard data call in parallel with (not after) `/auth/me` resolving.
- **Safety (non-negotiable):** do **not** bypass `/auth/me`, do **not** skip the auth gate, do **not** extend cookie/JWT lifetime. Preserve the 401→clear-token and transient-retry-never-logout behaviour. Handle expired/offline exactly as today (Retry screen).

---

# PHASE 4 — FEATURE PRESERVATION (before/after inventory — baseline)

Baseline "before" inventory to diff every change against. **No feature below may be removed, hidden without an accessible alternative, or downgraded.**

**Client bottom nav (primary):** Dashboard · Lead Store · Admissions · Finance (Revenue).
**Client "More" sheet:** Chats · Goals & Targets · UTM Leads · Domestic Admissions · International Admissions · Insights (Analytics) · My Store · Referrals.
**Client modules (files):** Dashboard, LeadStore, Admissions, Walkins, Counselling, Revenue (+RevenueSlabs), Analytics, UTMLeads, MyStore, Referrals (+ReferralHome, MyReferrals), GoalsAndTargets(+All), Chats (ChatPanel), Calendar (CalendarModal), Settings, Help, Profile.
**Key in-module features to preserve:** Lead Store direct **Call** (`tel:`) + **Send Message**, **Dial & Track** (CallCenterModal), **Smart Nurture** (NurtureCenter), Lead Details view, import/assignment/status; Referrals backend reward slabs + redemption/payout; Revenue At-Risk/Leakage + 6 workflows; **OTP email/phone verification** (VerifiedInput); notifications; role/permission gating (`hasModulePermission`); native integrations (push/FCM, Android back button, keyboard-safe inputs).
**Verification method:** for each PR, a module-by-module before/after checklist across Web + Android and the relevant roles (admin/manager/employee), plus `grep` guards for the key feature markers (as used for the Referrals merge).

---

# PHASE 5 — IMPLEMENTATION PLAN (DRAFT — to be finalized with your UI requirements)

### 1. Root causes of mobile lag (measured)
1. **709 KB eager recharts** on the dashboard critical path (frontend).
2. **Full remount + full data refetch on every module switch** — no keep-alive, no cache (frontend). *Biggest perceived-latency cause on mobile.*
3. **Serial startup chain** (login hard-reload → blocking `/auth/me` → lazy chunks → dashboard fetch) (frontend structure) amplified by **Neon cold-start** (backend/infra).
4. **Whole-portal re-renders** from 25 s/45 s polls + socket, no memo/context (frontend).
5. **Duplicate `/auth/me`** + remote Google Fonts at startup (frontend/network).

### 2. Navigation architecture recommendation
Keep the same routes and bottom nav (no feature moves). Make switching instant by: removing `key={module}` and **keeping recently-visited modules mounted but hidden** (stable position + `display:none`, or a small mounted-module cache), and adding a **lightweight data cache** (react-query/SWR or a simple module-keyed store) with background revalidate so returns are instant. Wrap modules in `React.memo` and lift shell/poll state out of the render path (context or a store).

### 3. Splash & persistent login design
As Phase 3: branded logo + 3 dots covering only real work; static-HTML splash in `#root` to remove the native blank gap; replace the login hard-reload with client-side navigation; prefetch post-auth chunks and parallelize the dashboard fetch. No auth/security changes.

### 4. Proposed mobile UI improvements
As Phase 2, prioritized behind the perf fixes; each one accessibility-reviewed and feature-preserving.

### 5. Exact files that would change (anticipated)
- Bundle: `vite.config.js`; `Dashboard.jsx`, `Revenue.jsx`, `Analytics.jsx`, `admin/Analytics.jsx`, `admin/AdminDashboard.jsx` (lazy charts); `ClientPortal.jsx` (split feature views); logo asset.
- Nav/render: `ClientPortal.jsx` (remove `key`, keep-alive, memo, lift state); per-module data-load effects (cache); optionally a new `src/lib/` cache/store.
- Startup/splash: `index.html`, `src/main.jsx`, `src/App.jsx`, `src/ClientLogin.jsx`, `src/assets/bispun-logo.svg`; optionally `package.json` (+ `@capacitor/splash-screen`/`status-bar`).
- Android: `index.html` (`theme-color`, self-hosted fonts), `AndroidManifest.xml`, `android/app/build.gradle`, `MainActivity.java`, `capacitor.config.json`.
- **No server/DB/schema files.**

### 6. Implementation phases & priorities
- **P0 (biggest win, lowest risk):** data cache + keep-alive for module switching; lazy recharts off first paint.
- **P1:** branded splash + remove hard-reload + parallelize startup; dedupe `/auth/me`.
- **P2:** memo/context to stop poll/socket re-renders; self-host fonts; status-bar/theme-color; Android flags (hardwareAccelerated, release minify).
- **P3:** virtualize/paginate large Admissions tables; broaden chunk prefetch; logo SVG optimization.
Each phase = its own small PR, accessibility-reviewed, with the Phase 4 checklist.

### 7. Test plan (web / mobile / Android)
- Build green + `npm test`; per-PR before/after feature checklist (Phase 4) across roles.
- Web: Lighthouse/Performance timings; verify no module lost; keyboard + reduced-motion.
- Mobile-emulated (375px): module-switch is instant (cache hit, no spinner), scroll preserved; splash shows only during real work.
- **Android device/emulator (needed for true numbers):** cold start, time-to-interactive, login-to-dashboard, module-switch latency, with screen recordings before/after.

### 8. Potential regressions & safeguards
- Keep-alive could leak stale data → pair with background revalidate + explicit refresh.
- Removing the login hard-reload could resurface the old blank-screen bug → test the exact path the comment at `ClientLogin.jsx:98` guards.
- Lazy charts must keep a Suspense fallback so KPIs paint first.
- Caching must respect role/permission scoping (never serve another role's cached data).
- Preserve 401→clear-token and transient-retry-never-logout.
- Every change gated by build + tests + feature checklist + accessibility review; one small PR at a time; nothing pushed/merged without your approval.

### 9. Performance metrics to compare (before/after)
Cold start, time-to-interactive, login-to-dashboard, module-switch latency (ms + spinner yes/no), # API calls per switch, duplicate-request count, JS transferred to first interactive dashboard (KB), dashboard-chart first-paint, and a reduced-motion pass. Captured on web + Android.

---

## Status & next step
Investigation complete; this plan is a **draft**. Per your instruction I will **wait for your UI requirements one by one** before finalizing Phase 5 and before any code is written. Tell me the first mobile-UI item you want to tackle (e.g. splash screen, instant module switching, or the dashboard bundle), and I'll turn it into a concrete, feature-preserving, accessibility-reviewed implementation proposal for your approval.
