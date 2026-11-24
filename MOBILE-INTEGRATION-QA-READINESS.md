# Bispun CRM — Integration QA Checklist + Release Readiness

Date: 2026-11-02 · Branch **`integration/mui-yc` @ `85a4f8d`** (worktree
`S:\Bispun-integ`). **No code changed this pass (review only). No push/merge/
migration/deploy. `main` and both feature branches untouched.**

## Decision recorded
Per your instruction, **Smart Nurture** and **Dial & Track (call-center)** are
**intentionally deferred** from this integration — NOT reintroduced. The latest
developer's Lead Store rewrite + Lead ID/`alternatePhone` improvements are kept;
our Mobile UI (Chat, Calendar, 2-col KPI grids, contrast, anti-clip) and the native
**WhatsApp/SMS** actions are preserved.

## Review for broken references (result: CLEAN)
| Check | Result |
|---|---|
| Dangling frontend refs to `NurtureCenter` / `CallCenterModal` / `onDial` / `callLead` / `setCallLead` | ✅ **None** — fully removed; no code calls them |
| `NurtureCenter.jsx` / `CallCenterModal.jsx` component files | Present but **imported nowhere** — orphaned/dead code, tree-shaken from the build; **kept in repo** so the deferred features can be re-wired later |
| WhatsApp/SMS native actions | ✅ Wired (`openWhatsApp`/`openSMS` imported + used in LeadStore) |
| Frontend build | ✅ clean at `85a4f8d` (40/40 tests, `prisma validate` valid, no conflict markers) — unchanged since the merge commit |

### ⚠️ Note: Smart Nurture BACKEND is still active
The **frontend** Nurture UI was removed, but the **backend** Smart Nurture is
**intact and running**: `startNurtureWorker()` (server/index.js) + the
`/api/client/nurture` routes. This isn't broken, but:
- The **nurture background worker will run** on server startup unless
  `DISABLE_BACKGROUND_WORKERS=true`. Decide whether that's intended while the UI is
  deferred (dev QA should set `DISABLE_BACKGROUND_WORKERS=true`).
- `/api/client/nurture` endpoints are now **unused by the client UI** (harmless).
Document this with the developer alongside the deferral.

## Intentionally deferred (pending developer confirmation)
- **Smart Nurture** — frontend `NurtureCenter` UI removed by the rewrite; backend
  worker + routes still present. Re-adding the UI is a separate task.
- **Dial & Track** — call-center `CallCenterModal` + `onDial` tracking removed;
  replaced by the developer's plain `tel:` dial link. (Frontend-only; no backend
  worker for it was found.)

## Remaining QA checklist (run on `integration/mui-yc`)
**Prerequisites (need approval / your action):**
- [ ] Bring the **dev backend** (`:4000` → `bispun-mobile-dev`) back up (it's down).
- [ ] **Apply the additive migration** (new `DeviceToken` table + `Lead.alternatePhone`
      column + relations) to `bispun-mobile-dev` — **not done; needs your approval**
      (`prisma migrate`). The merged backend won't run correctly until it's applied.
- [ ] Set `DISABLE_BACKGROUND_WORKERS=true` for QA (nurture worker).
- [ ] Manual QA login (QA Admin / Employee A/B).

**Lead Store (rewrite — highest priority, retest fully):**
- [ ] Lead list loads; **Lead ID column** + heading render; `alternatePhone` shows/saves.
- [ ] Datasets / Imported / Converted / Duplicates KPIs correct.
- [ ] Filters, search, view, Export CSV, pagination.
- [ ] Row action menu: **Dial number** (`tel:`), **WhatsApp**, **Message (SMS)** work.
- [ ] Mobile: KPI cards are **2-column**, numbers don't clip; Desktop: table + multi-col KPIs.

**Other touched modules (retest mobile + desktop):**
- [ ] Revenue, Help (KPI 2-col mobile / desktop columns; values not clipped).
- [ ] Analytics, My Store, Counselling, UTM Leads, Walk-ins (functional + layout).

**Regression (should be unchanged — spot-check):**
- [ ] Chat (mobile keyboard-safe + desktop two-pane), Calendar (mobile agenda + desktop week grid), Dashboard KPIs, Android Back, notifications, session.

**Automated (green now; re-run after migration):**
- [x] `vite build` clean · [x] `node --test` 40/40 · [x] `prisma validate` valid.

## Release readiness status
| Dimension | Status |
|---|---|
| Conflict resolution | ✅ done, clean, a11y preserved |
| Build / tests / schema validity | ✅ green |
| Broken references from removals | ✅ none (orphaned files only) |
| Additive migration applied | ❌ **not applied** (needs approval) |
| Runtime functional QA (Lead Store etc.) | ⚠️ **NOT TESTED** (backend down) |
| Mobile + Desktop visual QA on merged modules | ⚠️ **NOT TESTED** (needs backend + login) |
| Smart Nurture backend worker decision | ⚠️ open (disable for QA) |

**Overall:** 🟡 **Code-ready for development QA**, **NOT ready for production
release.** Before a `main` merge (which **auto-deploys production** — Render + Vercel):
apply the additive migration to the proper DBs, complete mobile + desktop functional
QA on the rewritten Lead Store and the other touched modules, confirm the Nurture
backend/worker decision with the developer, then choose the merge path.

**STOP — integration branch `integration/mui-yc` @ `85a4f8d` ready for your dev-QA
review. Nothing pushed/merged/migrated/deployed.**
