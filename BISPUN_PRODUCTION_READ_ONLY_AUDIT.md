# Bispun CRM — Production Read-Only Audit (Phase 3 + Phase 4)

**Date:** 2026-11-12
**Scope:** strictly non-destructive. Public HTTPS GETs, route-existence probes (no auth, no writes), deployed-asset inspection. Authenticated prod / Render / Vercel / Neon dashboards were **not** accessed (no authorized credentials); those items cite prior operator-verified docs in the repo and are flagged as such, never as my own runtime verification.
**No production writes, migrations, seeds, deploys, or communications occurred.**

---

## 1. Production endpoints (independently verified, read-only)

| Target | Result |
|---|---|
| `https://bispun.com/` | `HTTP 200`, `Server: Vercel`, region `bom1` (Mumbai). HTML references exactly one JS + one CSS asset. |
| Frontend bundle | `/assets/index-CPawhHV9.js` (≈624 KB) — **single, non-code-split bundle** (HTML has no other `/assets/*.js`). |
| Backend base (from bundle) | `https://consulbuzz-api.onrender.com` |
| `…/api/health` | `HTTP 200` → `{"success":true,"database":"connected","message":"Bispun API and database are working"}` |

### Backend route-existence probes (GET, no auth; `401`=route present/needs-auth, `404`=absent)
| Route | Code | Meaning |
|---|---|---|
| `/api/health` | 200 | up |
| `/api/client/referrals/me` | **401** | present (referrals deployed) |
| `/api/client/lead-store/column-preferences` | **401** | present (P1 route deployed) |
| `/api/client/counselling/options` | **401** | present |
| `/api/client/walkins` | **401** | present |
| `/api/client/revenue` | **401** | present |
| `/api/admin/referrals` | **401** | present (admin credit path deployed) |

→ **The deployed backend is a recent `main`** (all new feature routes exist). Consistent with Render Auto-Deploy-On-Commit from `main`.

## 2. Deployed FRONTEND is stale — PDF changes absent (independently verified)

Method: downloaded the live bundle `index-CPawhHV9.js` and grepped for PDF requirement UI strings; cross-checked the same strings against `origin/main` source. UI text literals survive minification, so presence/absence is reliable (control strings "Walk-in"/"Counselling" are present, proving the method).

| PDF string (requirement) | In PROD bundle | In `origin/main` source | Interpretation |
|---|---|---|---|
| "College Revenue / College Slab" (9.7) | ❌ 0 | ✅ | in main, **not deployed** |
| "University Name / Affiliation Name" (6.12) | ❌ 0 | ✅ | in main, **not deployed** |
| "Online Meet" (7.3) | ❌ 0 | ✅ | in main, **not deployed** |
| "My Workspace" / "Business Summary" / "Team Activity" (14.7) | ❌ 0 | ✅ | in main, **not deployed** |
| "Influencer Name" (4.2–4.4) | ❌ 0 | ✅ | in main, **not deployed** |
| "Interested College" (3.2) | ❌ 0 | ✅ | in main, **not deployed** |
| "Import Batches" (3 clarification) | ❌ 0 | ✅ | in main, **not deployed** |
| "No eligible leads selected" (3.18) | ❌ 0 | ✅ | in main, **not deployed** |
| "Referred"/"Earned"/"Credited" (11.1) | ❌ 0 | ✅ | referral lifecycle **not deployed** |
| "Smart Nurture" (3.15) | ❌ 0 | ✅ | **not deployed** |
| "Admission Done" (6.7) | ❌ 0 | ✅ | **not deployed** |
| "Amount credited" (11.8) | ❌ 0 | ✅ | **not deployed** |
| "Order History" (15.1) | ❌ 0 | ❌ 0 | **not implemented even in main** |

> **Finding P-1 (CRITICAL — production inconsistency):** the deployed frontend (`bispun.com`, bundle `index-CPawhHV9.js`) is an **older build that predates almost all PDF changes**, even though the **backend** on Render already runs the corresponding new code. **Frontend and backend are version-mismatched in production.** Until Vercel is rebuilt/redeployed from current `main`, end users do NOT see the PDF changes regardless of backend readiness.
>
> **Finding P-2:** "Order History" (§15.1) is **absent from `origin/main` source as well** → Billing Order History is **not implemented** anywhere yet (to be re-confirmed by the traceability pass; wording variants checked).

## 3. Production database state (CITED prior operator evidence — not my own access)

From repo docs `BISPUN-PROD-SCHEMA-CORRECTED-FINDING-20261111.md` and `BISPUN-RENDER-DBPUSH-P0-20261111.md` (operator ran read-only `information_schema` on Neon `consulbuzz-production`). **I could not independently re-run these** (no prod DB credentials); treat as prior evidence to re-confirm before release:

- `public."Lead"` exists but column **`leadNumber` DOES NOT EXIST** → migration **0005 never applied to prod** → **stable Lead ID (§2) is non-functional in production** (new leads would get `leadNumber = NULL`; UI shows blank LD id via graceful `formatLeadDisplayId(null)→null`).
- **`AccountDeletionRequest` table ABSENT** in prod (the backend guards this and returns a safe fallback).
- `preferredColleges` (0004) present → prod sits **between 0004 and 0005**.
- Consequently the 0005 **unique index + trigger/function are absent** (cannot exist without the column).

## 4. Phase 4 — Lead-ID trigger & deployment risk (verified + cited)

| Question | Answer | Basis |
|---|---|---|
| Is `0005` in the active migration/deploy process? | **No.** Deploy runs `prisma db push`, which adds the `leadNumber` **column + unique index** but **omits** the backfill, `NOT NULL`, function `assign_company_lead_number`, and trigger `Lead_assign_lead_number`. | verified: `db push` is the sync mechanism; trigger is not in `schema.prisma` (I confirmed the trigger lives only in `prisma/pending-migrations/0005*.sql`). |
| Does prod have the correct trigger/function? | **No** (column missing ⇒ trigger cannot exist). | cited operator SQL |
| Per-company uniqueness protection present in prod? | **No** (index absent with column). | cited |
| Do local/staging/prod schemas differ? | **Yes** — prod ≈ 0004; main/`schema.prisma` ≈ 0009 + `AccountDeletionRequest`. | verified main; cited prod |
| Is referral migration `0007` applied per environment? | `0007` columns are in `schema.prisma`, so a prod `db push` **would add them**; whether a deploy has run since they entered main is **UNVERIFIED** (needs prod SQL). Backend route exists (401), implying code deployed. | partial |
| Admission-linked IDs consistent? | In my isolated DB: yes (trigger applied). In prod: **at risk** until 0005P applied. | verified local; cited prod |
| Risk of a failed future deploy? | **Yes** — bare `db push` (no `--accept-data-loss`) **aborts** on any narrowing/data-loss diff → **Render build fails → backend not updated while Vercel may still go live** (partial deploy). | per operator doc + `db push` semantics |

### Safe remediation (PREPARED — do NOT execute without separate approval)
1. **Change Render Build Command** `… && npx prisma db push` → **`npm install && npx prisma generate`** (removes uncontrolled prod schema sync). Operator dashboard action, separately approved.
2. Apply **missing** migrations to Neon `production` via SQL editor, each reviewed + approved, idempotent order: `0003 → 0004 → 0005P (REQUIRED: adds column + backfill + index + function + trigger) → 0006 → 0009 → 0008`. **Skip `0007` calendar (HOLD).** After `0005P`: verify `0` NULL `leadNumber`, `0` duplicates per `(companyId, leadNumber)`, trigger `Lead_assign_lead_number` present.
3. **Deploy order:** apply schema → deploy **backend** (Render), verify `/api/health` → **rebuild & deploy frontend** (Vercel) with prod `VITE_API_URL`. Backend-before-frontend avoids the new UI calling absent columns.
4. Reconcile `leadNumber` `Int?` (schema) vs intended `NOT NULL` before ever adopting `migrate deploy`.

## 5. What is BLOCKED / UNVERIFIED (needs authorized access)

- Authenticated production UI behavior for ALL roles → **BLOCKED** (no prod login; will not use the user's credentials without explicit authorization).
- Live prod DB column/enum/index/trigger state → **UNVERIFIED by me** (cited operator SQL only).
- Render/Vercel dashboard config, prod `DISABLE_BACKGROUND_WORKERS`, rollback readiness → **UNVERIFIED by me** (cited).
- Exact deployed backend commit SHA → **UNVERIFIED** (`/api/health` exposes no version; route-existence only proves "recent main").

## 6. Production audit bottom line

🔴 **Production is NOT ready to represent the PDF changes.** Backend code is recent, but (a) the **frontend is a stale build** (users don't see the changes), (b) the **prod DB is behind** (stable Lead ID + account-deletion non-functional), and (c) the **deploy mechanism (`db push`) cannot complete** the stable-ID feature and can cause **partial deploys**. None of these can be closed without separately-authorized operator actions.
