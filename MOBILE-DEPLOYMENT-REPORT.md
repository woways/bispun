# Bispun CRM — Production deployment report (PR #3, Path A)

Date: 2026-11-02 · **PR #3 MERGED and deployed to production.** No destructive DB operation; the
10:39:50 UTC snapshot was not restored.

## Merge
- **PR #3 → `main`** merged via **merge commit `c349759`** at **2026-11-02 10:57:57 UTC** (state
  MERGED). `main`: `496fa88 → c349759`. Integration branch preserved (not deleted). Path A (existing
  Render build command retained).

## Pre-merge safety rechecks (all passed)
| Check | Result |
|---|---|
| PR #3 CI / mergeability | ✅ CI 2/2 green, MERGEABLE/CLEAN |
| Production DB identity | ✅ pond (`ep-weathered-pond-axt9umrv`), healthy |
| Neon snapshot | ✅ in place (`production` @ 2026-11-02 10:39:50 UTC, never expires) |
| **Automated customer messages** | ✅ **none possible** — production had **2 nurture enrollments, both COMPLETED; 0 ACTIVE/due; 0 WhatsApp connections (0 CONNECTED)**; worker unchanged vs `main` → deploy triggers **zero** sends |

## Deployment outcome — Render (API) + Vercel (web)
The Render build ran `npm install → prisma generate → prisma db push → start`. Verified on production
(pond), read-only:

**Prisma schema additions applied (additive, as planned):**
| Object | Result |
|---|---|
| `DeviceToken` table | ✅ created — **9 columns, 5 indexes (4 + PK), 2 foreign keys** |
| `Lead.alternatePhone` | ✅ present (nullable TEXT) |

**Data integrity preserved (no loss):**
| | Before | After |
|---|---|---|
| Leads | 26 | **26** |
| Companies | 3 | **3** |
| Users | — | 12 (intact) |

**Service health:**
- Render API `https://api.bispun.com/api/health` → `database: connected` ✅
- Auth routing enforced: `/api/client/auth/me`, `/years`, `/analytics/dashboard` → **401** when
  unauthenticated (correct — not 404/500) ✅
- Vercel web: `consulbuzz.vercel.app` + `bispun.com` → **200** ✅
- Production CRM **login page renders** ("Sign in to your Bispun workspace") — new build served ✅

## Testing — verified vs not tested
**Verified on PRODUCTION (read-only / unauthenticated):**
- Prisma schema additions (DeviceToken + alternatePhone) with correct structure.
- Production data intact (26 leads / 3 companies / 12 users).
- API health + DB connectivity; auth middleware enforced; web app + login page live.

**Not tested on production (requires a team login to real customer data — I did not sign in):**
- Authenticated modules: **Lead Store, Revenue, Analytics**, Dashboard, Chat, Calendar, etc.
  These run the **identical code** (`70b8209`) that was **thoroughly QA'd in development this
  session** (desktop + mobile: Lead Store rewrite/Lead IDs/alternatePhone create+edit, Smart Nurture
  & Dial & Track modals, KPI grids, phone-actions fix, etc.). **Recommend a team member log in to
  production and spot-check** Lead Store create/edit (exercises the new column), Revenue, Analytics,
  Dashboard, Chat, Calendar.
- Still NOT tested anywhere: Chat 2-user send, OTP onboarding, billing/payment, FCM push delivery,
  real Nurture/Dial sends. (The Android APK is a separate release track.)

## Background workers / messaging safety (post-deploy)
Worker is unchanged vs `main` and now runs as it did before. Because production has **0 ACTIVE/due
nurture enrollments and 0 connected WhatsApp providers**, **no automated WhatsApp/SMS/email was or
will be sent** by the deploy itself. New sends occur only if a user enrols leads via the restored
Smart Nurture UI **and** a provider is connected — intended behavior, under your control.

## Rollback / recovery (available, not invoked)
- **Code:** revert merge commit `c349759` on `main` → Render + Vercel auto-redeploy the previous build.
- **Schema:** `DeviceToken` + `Lead.alternatePhone` are additive and backward-compatible (old code
  ignores them) — safe to keep. If full DB revert is ever needed: Neon console → `consulbuzz-production`
  → restore from the **10:39:50 UTC** snapshot, **branch-first** (create a branch from current prod to
  preserve post-deploy writes before restoring). **Do not** auto-restore.

## Status
🟢 **DEPLOYED AND HEALTHY.** PR #3 is merged to `main`; Render API and Vercel web are live on the new
build; the additive schema changes are applied to production with all data preserved; no automated
customer messages were triggered.

**Recommended next:** (1) a team login + production spot-check of Lead Store/Revenue/Analytics;
(2) the Android APK release on its separate track (prod `VITE_API_URL=https://api.bispun.com` +
`google-services.json` + signing). The pre-release snapshot remains as a recovery point.
