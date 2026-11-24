# Bispun CRM — PR #3 Final Merge Readiness

Date: 2026-11-02 · **All checks read-only. Nothing merged, migrated, pushed, deployed, or
changed in Render/Vercel/DB.**

## Step 1 — Git & PR status
- **PR #3** ([link](https://github.com/woways/bispun/pull/3)): **OPEN**, not draft, **not merged**
  (`mergedAt: null`). `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN` (no conflicts).
  **CI: 2 passing, 0 failing, 0 pending.** Auto-merge: **off**. Reviews submitted: **none yet**.
- `origin/main` = **`496fa88`** (unchanged — has **not** advanced; clean merge, no rebase needed).
- `origin/integration/mui-yc` = local `HEAD` = **`70b8209`** (in sync; no divergence; nothing to overwrite).
- Containment: `feat/mobile-ui-optimization`, `feat/your-changes`, `feat/mobile-notifications`,
  `feat/mobile-notifications-handover` all **contained**. All intended developer changes included.

## Step 2 — Render configuration: ⚠️ UNVERIFIED (needs your dashboard evidence)
No Render config is in the repo and I have **no access to the Render dashboard**, so I cannot verify
the build/start commands from authoritative settings. **Please send one of:**
- A screenshot of **Render → the API/web-service for Bispun → Settings → "Build & Deploy"**, showing
  **Build Command** and **Start Command**; and
- **Settings → Environment**, showing that **`DATABASE_URL`** targets the production DB
  (host begins `ep-weathered-credit`) — you may redact the password.

**What must be true:**
- Build Command includes **`npx prisma generate`** (recommended: `npm ci && npx prisma generate`) so the
  Prisma client is regenerated from `prisma/schema.prisma` (the integration schema). Without it, Lead
  create/update returns **HTTP 500** (`Unknown argument 'alternatePhone'`). Prisma 7 has no auto-generate.
- Start Command: **`node server/index.js`**. `DATABASE_URL` → production (`ep-weathered-credit`).
- Do **not** change Render settings without approval; just confirm (or fix build-only if `prisma generate` is absent).

## Step 3 — Production DeviceToken migration precheck (reconfirmed, read-only)
Production identity: **`ep-weathered-credit-axobwesm` / neondb**. Re-run confirms:
`DeviceToken` **MISSING** → migrate; `Lead.alternatePhone`, `assignedToUserId`, `followUpAt`,
`LeadRemark`, `WalkIn.alternatePhone` all **present** → no change. **Only `DeviceToken` is new.**

**Exact SQL (additive; NOT applied):** `CREATE TABLE "DeviceToken"` (id PK, companyId, userId, token
UNIQUE, platform default 'android', active default true, lastSeenAt/createdAt/updatedAt) + indexes
`DeviceToken_token_key` (unique), `_companyId_idx`, `_userId_active_idx`, `_companyId_userId_idx` + FKs
to `Company(id)` and `User(id)` **ON DELETE CASCADE ON UPDATE CASCADE**. (Full script in
`MOBILE-PR-OPENED-PRECHECKS.md` / `prisma/pending-migrations/0001_add_device_token.sql`.)
- **FKs/indexes/constraints** match the Prisma `DeviceToken` model exactly.
- **Backup/recovery:** Neon automatic **PITR** — note the restore timestamp before applying.
- **Compatibility with the currently deployed backend:** safe — the current prod code does not reference
  `DeviceToken`, so adding the empty table is inert until the new code ships.
- **Pre-check:** `SELECT to_regclass('public."DeviceToken"');` → null before. **Post-check:** table +
  4 indexes + 2 FKs exist; `SELECT count(*) FROM "DeviceToken";` → 0.
- **Rollback:** `DROP TABLE "DeviceToken";` (new, empty, nothing references it).

## Step 4 — Final release checks
- **Automated (fresh on `70b8209`):** `prisma validate` ✅ · `node --test` **40/40** ✅ · `vite build` clean ✅.
- **Web CRM compatibility:** additive + backward-compatible — `Lead.alternatePhone` already in prod;
  `DeviceToken` ignored by current code until deploy. No destructive schema change; no removed columns.
- **Smart Nurture worker:** **unchanged vs `main`** — production behavior identical to today; gated by
  `DISABLE_BACKGROUND_WORKERS` (unset in prod → runs as it already does), tenant-isolated (`companyId`),
  idempotent (SENT/COMPLETED/REPLIED/FAILED), push dispatch `try/catch`-isolated. No new default sending.
- **Deployment monitoring to prepare:**
  - *Render (API):* watch the deploy's build log for `prisma generate` + "Bispun API running"; then
    `GET /api/health` → `database: connected`; first Lead create/edit (exercises `alternatePhone` + client).
  - *Vercel (web):* build succeeds; site loads; `VITE_API_URL` resolves to the prod API; no console/CORS errors.
- **Rollback:** revert the merge commit on `main` → auto-redeploys the previous web + API. **Git revert does
  NOT undo the DB** — `DeviceToken` is backward-compatible (keep it), or `DROP TABLE "DeviceToken";`; Neon
  PITR is the DB recovery path. Android: redistribute the previous APK.
- **Readiness split:** **Web + Backend = release-ready pending the 2 gates below.** **Android = NOT ready**
  (rebuild from `70b8209` with prod `VITE_API_URL` + `google-services.json` + signing, then device-QA incl. FCM).
- **Still NOT TESTED (functional):** Chat 2-user send/receive & read indicators; OTP onboarding; Billing/Plans
  change + payment; FCM push delivery + tap nav + invalid-token cleanup; Smart Nurture real sequence sends;
  Dial & Track real call + outcome save; full production smoke. (None marked PASS.)

## Step 5 — Final merge decision
| Item | Status |
|---|---|
| PR #3 | **OPEN**, MERGEABLE/CLEAN, CI 2/2 green, not merged, no reviews yet |
| Latest integration commit | **`70b8209`** (synced to origin) |
| Render Prisma generation | 🔴 **UNVERIFIED** — needs your dashboard screenshot |
| Production DeviceToken migration | 🟡 **Not applied** — approved SQL ready; needs your go-ahead |
| Tests | ✅ 40/40 · build clean · prisma valid |
| **Does merging `main` deploy production?** | **YES — push to `main` auto-deploys Render (API) + Vercel (web).** So the DB migration + Render `prisma generate` must be in place BEFORE merge. |

**Exact release sequence (on your approval):**
1. Verify Render Build Command includes `npx prisma generate` (fix build-only if missing).
2. Note Neon PITR; **apply the `DeviceToken` migration** to production (additive, reversible).
3. **Merge PR #3 → `main`** (this deploys): prefer a single merge/squash commit.
4. Watch Render build (`prisma generate` ran, server up) + Vercel build; run prod smoke (health, login,
   Lead create/edit, Dial & Track, Smart Nurture open, Chat, Calendar).
5. Build + QA the Android APK separately.

**GO / NO-GO:** 🟡 **CONDITIONAL GO.** Code, tests, build, schema diff, containment, and the PR are all
green. **Two gates remain before merge** (because merge = deploy): (1) confirm Render runs
`prisma generate`; (2) apply the `DeviceToken` migration. Clear those two and it is a **GO** for the
Web + Backend; **Android stays a separate NO-GO track.**

**STOP — all safe read-only checks pass. Awaiting your explicit approval to merge PR #3 (and, before it,
to apply the DeviceToken migration once you've confirmed Render's build command).**
