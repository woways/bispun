# Bispun CRM — Manual Testing Environment (READY)

**Date:** 2026-11-13 · **Branch:** `integration/bispun-final-pdf-review` (worktree `S:\Bispun-final-review`)
**Verified by actually loading the browser + API — not just config.**

## Verified URLs
| Tier | URL | Status |
|---|---|---|
| **Frontend (open this)** | **http://localhost:5178** | vite dev server, HTTP 200, renders login + app |
| Backend API | **http://localhost:4200** | `/api/health` → 200 `{database:"connected"}` |
| Database | local `bispun_final` @ localhost:5432 (**isolated, disposable**) | healthy; **not Neon/production** |

## Safety posture (confirmed)
- `DATABASE_URL`/`DIRECT_URL` resolve to **localhost/bispun_final** only; no Neon (`pond`/`ep-weathered`/`blue-mouse`) ; no shell override.
- `DISABLE_BACKGROUND_WORKERS=true` (nurture / calendar-reminder / subscription timers OFF). SMTP/Firebase/WhatsApp/SMS/Razorpay = dummy → **no real customer messaging, no gateway calls**.
- Backend log confirms: "DISABLE_BACKGROUND_WORKERS=true … DISABLED (development mode)".

## Test accounts (all password in the gitignored note — NOT printed here)
Credentials file (open it; never committed): **`S:\Bispun-final-review\.manual-qa-credentials.txt`**
| Role | Email | Tenant | Portal |
|---|---|---|---|
| Client Admin | `it.admin@qa-a.local` | qa-test-co | Client (http://localhost:5178) |
| Manager | `it.manager@qa-a.local` | qa-test-co | Client |
| Employee | `it.employee@qa-a.local` | qa-test-co | Client |
| Super Admin | `admin@consulbuzz.local` | (platform) | Admin |
All four share one password (in the note). All four API logins verified **200**; Super Admin uses the admin portal.

## Live verification performed (browser + API)
| Check | Result |
|---|---|
| Frontend loads, redirects to `/login`, renders sign-in | ✅ |
| Client-Admin login via browser form → `/app` | ✅ |
| **Dashboard renders** with real data | ✅ Total Leads 28, Qualified 10, New 18, Admissions 10, Potential Revenue ₹11,40,000, Received ₹4,70,000; KPI cards have "View details" drill-down links |
| **§18 greeting fix (live)** | ✅ shows **"Good Morning, A Admin"** (user's name, not the company) |
| **Lead Store renders** | ✅ KPI cards (Import Batches / Imported Leads / Converted 10 / Duplicates Skipped) + Lead Type/Filter/View/Export/Add Lead/Import + lead table with **stable Lead IDs (LD028, LD027…)** |
| Post-login API calls | ✅ all 200 (`auth/me`, `analytics/dashboard`, `years`, `notifications/unread-count`, `chat/unread-count`, `calendar`) |
| 4-role API logins | ✅ all 200 (client portal ×3, admin portal ×1) |

## Manual QA guide ↔ actual UI
`BISPUN_MANUAL_QA_GUIDE.md` + `BISPUN_MASTER_MANUAL_QA.csv` match the integrated UI: login copy ("Sign in to your Bispun workspace"), Dashboard KPI cards with "View details", and Lead Store controls (Add Lead, Import Leads, Filter, View, Export CSV, Smart Nurture) + the clarified KPI labels (Import Batches, Duplicates Skipped) all present as described.

## How to start/stop (if servers aren't running)
- Backend: from `S:\Bispun-final-review`, `node server/index.js` (uses `.env` → port 4200, bispun_final).
- Frontend: `npm run dev -- --port 5178 --strictPort`.
- Postgres: `pg_ctl -D C:\Users\kotha_7hh7\scoop\persist\postgresql\data start`. If it refuses backends with Windows "error code 487", do a clean `pg_ctl ... -m fast stop` then `start`.

## Remaining blockers (unchanged from GO/NO-GO)
This is a **local manual-testing** environment, ready now. **Production** remains NO-GO until: stale Vercel frontend redeployed from main, Render `prisma db push` build fixed, prod migrations applied (incl. counselling `0010`). Android/FCM/device and production checks are separate.

## Dashboard Test 1 (also in the manual guide)
See the closing message / `BISPUN_MANUAL_QA_GUIDE.md` §1.1 — Total Leads KPI drill-down.
