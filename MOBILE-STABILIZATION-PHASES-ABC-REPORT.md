# Bispun CRM — Mobile Polish + Code-Split: Phases A/B/C Report (2026-11-03)

Branch **`fix/bispun-web-mobile-stabilization`** (worktree S:\Bispun-stab). **All local — nothing pushed,
merged, deployed, signed; no production data; release keystore/worktree untouched.**

## Commits (this branch, in order)
| Hash | What |
|---|---|
| `689fe5d` | Login resilience (transient failures no longer force logout) |
| `01acb32` | Defer the jsPDF stack (~700KB) out of the eager bundle |
| `ab9bf85` | Mobile motion system + BottomSheet/nav polish (P5 steps 1–3) |
| `b76032c` | **Phase A** motion polish — card / chat / calendar entrances |
| `d018576` | **Phase B** React.lazy code-split of the client modules |
| `2d3d18f` | Phase B a11y touch-ups (error-boundary focus ring indigo-500; heading h2→h1) |

## Exact changed files
- `src/App.jsx`, `src/lib/api.js` — login resilience (earlier).
- `src/lib/invoicePdf.js` — lazy jsPDF.
- `src/index.css` — motion tokens + global `prefers-reduced-motion`.
- `src/components/mobileUi.jsx` — BottomSheet/nav motion.
- `src/components/ui.jsx`, `src/modules/client/Dashboard.jsx` — KPI card entrance (Phase A).
- `src/modules/client/ChatPanel.jsx` — new-message bubble fade (Phase A).
- `src/modules/client/CalendarModal.jsx` — mini-month cross-fade (Phase A).
- `src/ClientPortal.jsx` — React.lazy + Suspense + error boundary + title/preload (Phase B).

## Phase A — mobile motion polish (DONE, a11y PASS)
Card entrance (`cb-fade-in` on StatCard + Dashboard KPI card; narrowed their `transition-all`); chat bubble
`cb-fade-in-up` (the separate `sr-only aria-live` region untouched → announcements unaffected); CalendarModal
mini-month keyed by month → cross-fade with one copy in the a11y tree (week/time grid left un-keyed to
preserve scroll). Mount-only fades, **no forced remounts**, state/scroll/data-fetch preserved, reduced-motion
honoured. **accessibility-lead diff review: PASS** (all criteria).

## Phase B — React.lazy module code-split (DONE; a11y review pending)
11 route modules → `React.lazy` (CalendarModal kept static — always-mounted overlay). Accessible Suspense
fallback (`role=status`/`aria-live`/`aria-busy`, visible "Loading…", never steals focus, scoped to the single
`<main>`). `ModuleErrorBoundary` (keyed by module) catches rejected `import()`: `role=alert`, `<h2>`, native
"Try again" (name == text), focus-to-heading on failure, **no auto-retry**, cleared on navigation.
`document.title` per module; nav `aria-current="page"` already synchronous; idle-preload of Lead Store.
**Verified live:** Dashboard/Lead Store/Admissions load on demand, titles update, aria-current correct, no
crash. *(Stale `activeModule` console errors are a frozen pre-fix HMR artifact; committed source is clean.)*

## Phase C — performance & regression
### Before → After (production build)
| Metric | Before | After | Δ |
|---|---|---|---|
| `ClientPortal` chunk | **1446 KB** | **428 KB** | −70% |
| `invoicePdf` chunk (eager) | 356 KB | 7 KB | PDF libs now on-demand |
| **Eager authed-landing JS** (index+icons+charts+ClientPortal+Dashboard) | **~3219 KB** | **~1578 KB** | **−51%** |
| Modules on first load | all 11 eager | on-demand chunks | LeadStore 179 / Settings 169 / Admissions 139 / Dashboard 93 / ChatPanel 96 / … |
| `index.html` modulepreload | heavy | index / icons / charts only | modules stream on nav |

### Measured behaviour
- **API latency:** `GET /` (no DB) ≈ **2 ms**; DB endpoints ≈ 2.3–4.5 s **(dev→remote-Neon RTT, a dev
  artifact — not app/prod slowness; in prod Render is co-located with Neon).**
- **API requests per route:** Dashboard load = **5** (no bad waterfall). `/auth/me` ×2 = **dev-only React
  StrictMode** (prod builds don't double-invoke); not a real duplicate.
- **Loading state:** accessible Suspense fallback, no blank screen.
- **Layout:** mobile **375** ✅ and **390** ✅ (no horizontal overflow, bottom nav, entrance fades at opacity
  1); desktop **1440** ✅ (sidebar, no overflow). Desktop preserved.

### Build / tests / a11y
- `vite build`: ✅ PASS (every phase). `prisma validate`: ✅. Backend tests (`npm test`): ✅ **11/11**.
- accessibility-lead: ✅ login fix, ✅ motion `ab9bf85`, ✅ Phase A `b76032c`, ✅ **Phase B `d018576` + `2d3d18f`
  CONFIRMED PASS** (WCAG 2.2 AA for the reviewed scope). Only tracked a11y follow-up: pre-existing `/login` +
  authed-mount on-mount heading focus (SC 2.4.3) — separate ticket, not introduced by this work.
- Functional spot-checks (blue-mouse, authed): login resilience, tenant isolation (B can't see A; 404
  cross-tenant), module/role visibility, lazy navigation — all behaving correctly.

## Remaining blockers
1. **Android emulator / physical device: NOT TESTED** (none available). On-device install of the new build,
   WebView startup/jank timing, and FCM delivery are **not verified from browser testing** and remain open.
2. **Signed release build:** keystore exists (alias **`bispun-releasekey0`**); `android/keystore.properties`
   not yet created; no signed artifact produced/verified.
3. **FCM** push delivery still unverified end-to-end (prior emulator `AUTHENTICATION_FAILED` = provisioning).
4. Phase B accessibility-lead diff review: pending (expected PASS; will confirm).

## Android release GO / NO-GO
**NO-GO** for release. The web/mobile stabilization is solid and verified in-browser (login resilience, ~51%
lighter initial load, accessible motion + loading/error states, tenant isolation), but release requires, on
your side: (a) create `keystore.properties` → build a **signed** APK/AAB in Android Studio → signature-verify;
(b) install that build on an emulator/physical device and smoke-test the new bundle; (c) validate **FCM** on a
real device. Until (a)–(c), do not ship.

**Do not push / merge / deploy / sign / distribute, or touch production data or the release keystore, without
explicit approval.**
