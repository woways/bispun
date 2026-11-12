# Bispun CRM — Production Deployment Readiness

**Date:** 2026-11-12. Independent public read-only checks + cited operator evidence. **No deploy/dashboard/prod changes made.**

## 1. Topology (verified public where possible)
| Tier | Platform | State |
|---|---|---|
| Frontend | **Vercel** `bispun.com` | HTTP 200, `Server: Vercel`, single bundle `index-CPawhHV9.js` |
| Backend | **Render** `consulbuzz-api.onrender.com` | `/api/health` 200 `{database:"connected"}`; feature routes present (401) |
| Database | **Neon** `consulbuzz-production` / `production` / `neondb` | behind (0004→0005) — see Migration Readiness |

## 2. 🔴 Blocker 1 — Frontend/backend VERSION MISMATCH (independently verified)
The deployed **frontend bundle is a STALE build**: PDF change strings (`College Revenue / College Slab`, `University Name / Affiliation Name`, `Online Meet`, `Business Summary`/`Team Activity`/`My Workspace`, `Influencer Name`, `Interested College`, `Referred`/`Earned`/`Credited`, `Smart Nurture`, `Admission Done`) are **absent from the live bundle** but **present in `origin/main` source**. The **backend** already runs recent `main` (routes present). → **Users do not see the PDF changes**, and the stale frontend may call backend features inconsistently. **A Vercel rebuild/redeploy from current `main` (after consolidation) is required.**

## 3. 🔴 Blocker 2 — Uncontrolled `prisma db push` on deploy (cited operator evidence)
Render `bispun-api` build command = `npm install && npx prisma generate && npx prisma db push`, Auto-Deploy On Commit from `main`. Every merge to `main` **auto-syncs the production schema with no review/approval**, and a bare `db push` that meets a data-loss diff **fails the build → backend not updated while Vercel may still go live (partial deploy)**.
**Fix (operator, approved):** change build to `npm install && npx prisma generate`; apply schema via the reviewed SQL sequence in the Migration Readiness doc.

## 4. 🔴 Blocker 3 — Prod DB behind
Stable Lead ID + account-deletion persistence non-functional in prod until `0005P` + `0008` applied (see Migration Readiness). Do not create prod leads until `0005P` is applied.

## 5. Safe deployment order (PREPARED — needs your approval; nothing executed)
1. Consolidate + review the integration branch (this work) → decide `fa0518f`/counselling inclusion.
2. Merge the approved integration to `main` (your approval).
3. **Fix Render build command** (remove `db push`).
4. **Apply approved prod migrations** via reviewed SQL (`0003→0004→0005P→0006→0009→0008`; hold `0007`); validate (0 NULL leadNumber, trigger present).
5. **Deploy backend** (Render) → verify `/api/health` + route probes.
6. **Rebuild + deploy frontend** (Vercel) from current `main` with prod `VITE_API_URL`; confirm the new bundle contains the PDF strings.
7. Re-run the Manual QA Guide across all 4 roles against the live stack; re-verify prod DB read-only.

## 6. Rollback runbook
- Frontend: Vercel → Deployments → promote previous. Backend: Render → Rollback to last healthy. DB: additive changes need no rollback on code revert; for a bad `0005`, drop trigger/function/index/column; Neon branch/PITR for data incidents.
- Incident outbound halt: set prod `DISABLE_BACKGROUND_WORKERS=true` and restart.

## 7. Verdict
🔴 **NO-GO for production as-is.** Three blockers (stale frontend, uncontrolled `db push`, behind DB) must be cleared via approved operator actions. The **integration branch itself is build-green and backend-verified locally** and is ready for your manual review/testing — but is **not** on main/production.
