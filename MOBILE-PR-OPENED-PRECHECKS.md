# Bispun CRM — Integration PR opened + release prechecks

Date: 2026-11-02 · **PR open, NOT merged. Nothing deployed, migrated, or changed in
Render/Vercel/DB. No branches deleted.**

## Pull Request
- **URL: https://github.com/woways/bispun/pull/3**
- `integration/mui-yc` @ **`70b8209`** → base **`main`** (`496fa88`); **state: OPEN**, not draft,
  **not merged**. `mergeable: CLEAN` (no conflicts). PR CI checks: **2 passing, 0 failing, 0 pending**.
  Auto-merge: **off**. Title flagged **"DO NOT MERGE yet"**; body lists all changes, 40/40 tests,
  NOT TESTED workflows, production-impacting review items, and deployment prerequisites.

## Pre-push verification (all passed)
- Fetched `origin`; `main` still `496fa88` (unchanged). Both feature branches + both
  mobile-notifications branches **contained**; working tree **clean** (no tracked changes).
- **Secret / machine-file scan of the outgoing diff:** no real `.env`, keystore, `google-services.json`,
  `local.properties`, `.bak`, service-account, or `node_modules` tracked. `.env.example` contains only
  placeholders (the one `DATABASE_URL` match is the commented `user:pass@host` template). **Clean.**
- Pushed **only** `integration/mui-yc` (normal push, new branch, no force; `main` untouched).

## Step 9 — Render build `prisma generate`: ⚠️ UNVERIFIED BLOCKER
I **cannot access the Render dashboard** (no `render.yaml`/`Procfile` in the repo; no Render
credentials/API token available), so I cannot confirm the build command from authoritative settings.
The PR's green CI checks are **GitHub Actions**, not Render — they do not prove Render regenerates
the Prisma client. **You must verify in the Render dashboard:**
- Render → the **API service** → **Settings** → **Build Command** must include **`npx prisma generate`**
  (recommended full: `npm ci && npx prisma generate`). **Start Command:** `node server/index.js`.
- Confirm the service's `DATABASE_URL` env points at the **production** DB (`ep-weathered-credit`).
- Why it matters: Prisma 7 has no auto-generate; without regeneration from this schema, Lead
  create/update returns **HTTP 500** (`Unknown argument 'alternatePhone'`) — the reproduced failure.
- If the build command lacks `prisma generate`, add it (build step only) **before** deploying.

## Step 10 — DeviceToken production migration approval checklist (SQL NOT applied)
Only **one** additive object is missing in production (`Lead.alternatePhone` already present).
- [ ] Confirm target endpoint is **`ep-weathered-credit`** (production), note the Neon **PITR** timestamp.
- [ ] **Pre-check** (expect null): `SELECT to_regclass('public."DeviceToken"');`
- [ ] Apply (explicit SQL only — **never `prisma db push` on prod**):
```sql
CREATE TABLE "DeviceToken" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL, "platform" TEXT NOT NULL DEFAULT 'android',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_companyId_idx" ON "DeviceToken"("companyId");
CREATE INDEX "DeviceToken_userId_active_idx" ON "DeviceToken"("userId","active");
CREATE INDEX "DeviceToken_companyId_userId_idx" ON "DeviceToken"("companyId","userId");
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```
- [ ] **Post-check:** `DeviceToken` exists, 4 indexes + 2 FKs present.
- [ ] **Ordering:** apply **before/with** the backend deploy (so the regenerated client matches the DB).
- [ ] **Rollback:** `DROP TABLE "DeviceToken";` (new, empty, nothing references it). Compatible with the
      current prod backend (it ignores the table until the new code ships).

## Step 11 — Background-worker decision + rollback summary
- **Worker decision:** the nurture worker/scheduler (`nurtureEngine.js`) is **unchanged vs `main`** —
  production behavior is identical to today. Gated by `DISABLE_BACKGROUND_WORKERS` (dev = true/disabled;
  prod leaves it unset → runs as it already does). Tenant-isolated + idempotent (status transitions);
  push dispatch is `try/catch`-isolated. **Recommendation:** keep `=true` in all dev/QA; in prod it is
  unchanged — but since the Smart Nurture **UI** is now live, confirm you intend users to enrol leads
  into real send sequences on release. No new external sending is enabled by default.
- **Rollback:** revert the merge commit on `main` → auto-redeploys the previous web + API. **Reverting
  Git does NOT undo the DB** — the `DeviceToken` table is backward-compatible, so keep it, or
  `DROP TABLE "DeviceToken";` to fully revert. Neon **PITR** to the pre-migration timestamp is the DB
  recovery path. Android: redistribute the previous APK.

## Step 12 — Remaining release blockers
**CRITICAL (clear before merge/deploy):**
1. Confirm Render Build Command includes `npx prisma generate` (Step 9 — unverified).
2. Apply the additive `DeviceToken` migration to production (Step 10 — your approval).
3. Android: rebuild from `70b8209` with prod `VITE_API_URL` + `google-services.json` + signing, then device-QA (incl. FCM).

**NON-BLOCKING (schedule / accept):**
- A11y Major fast-follows (modal focus-trap; 3 legacy LeadStore modals' dialog semantics).
- Untested functional flows: Chat 2-user send, OTP, billing/payment, real Nurture/Dial sends, FCM delivery.
- Confirm prod worker / Smart-Nurture live-send intent.

## Status
🟢 **PR #3 is open and ready for team review**; CI green; no conflicts. **Not merged, not deployed.**
Before you approve the merge: clear the three CRITICAL items above. Request team review of
`server/`, `prisma/schema.prisma`, and `prisma/pending-migrations/` (production-impacting).

**STOP — PR opened and prechecks reported. Awaiting your explicit approval to merge/deploy.**
