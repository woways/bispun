# Bispun CRM — Production Release Prerequisites (read-only prep)

Date: 2026-11-02 · Candidate **`integration/mui-yc @ 70b8209`**. **All checks read-only.
No code/env/credential/database/Render/Vercel/Git change. Nothing migrated, pushed, merged
or deployed.**

---

## PHASE 1 — Render backend build audit
**Evidence available:** No `render.yaml` / `Procfile` / `Dockerfile` in the repo — Render's
build and start commands are **dashboard-managed** (not in version control).
`BISPUN_PAYMENT_LINKS_CHANGES.md` confirms: *"push to `main` → Render (API) and Vercel (web)
auto-deploy."* `README.md` documents `npx prisma generate` → `npx prisma db push` for setup.

**Can `prisma generate` be confirmed from repo?** No — it cannot be confirmed from version
control alone. Facts that bound the risk:
- Prisma 7 has **no auto-generate on install** (verified: neither root `package.json` nor
  `@prisma/client` has a `postinstall`). The client exists **only** if a build step runs
  `prisma generate`.
- The **current** production backend works, so Render's build command **must already** run it
  (or an equivalent). The risk is only whether it **re-runs** on the next deploy with the new
  schema — which a standard build command does.

**Exact safe build/start commands to confirm in the Render dashboard (do NOT change yet):**
- Build command should be: **`npm ci && npx prisma generate`** (reads `prisma.config.ts →
  prisma/schema.prisma`, the integration schema with `alternatePhone` + `DeviceToken`).
- Start command: **`node server/index.js`** (= `npm run server:prod`).
- **Action:** open Render → the API service → Settings → confirm the Build Command contains
  `prisma generate`. If it does **not**, add it (build only) before deploying — otherwise Lead
  create/update **500s** (`Unknown argument 'alternatePhone'`), the exact dev-QA failure.

## PHASE 2 — Production database migration plan
**Identity confirmed (read-only, no credentials shown):** endpoint
**`ep-weathered-credit-axobwesm`**, database `neondb` — the **production** CRM, distinct from dev
`ep-blue-mouse-b4if0xzj`.

**Read-only schema comparison (production vs integration Prisma schema):**
| Object | In production? | Needs migration? |
|---|---|---|
| **`DeviceToken`** table | ❌ **absent** | ✅ **YES** |
| **`Lead.alternatePhone`** | ✅ **already present** | ❌ no |
| `Lead.assignedToUserId`, `Lead.followUpAt`, `LeadRemark`, `WalkIn.alternatePhone` | ✅ present | ❌ no |

**⇒ Production needs ONE additive object: the `DeviceToken` table.** (`Lead.alternatePhone` was
already applied to the production DB ahead of main's committed schema — harmless drift that the
integration schema reconciles.)

**Exact additive SQL — `DeviceToken` only (apply to production `ep-weathered-credit` ONLY, NOT applied here):**
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
- **Backup/validation:** Neon keeps automatic PITR — note the restore timestamp before running;
  the change is a brand-new empty table, so there is zero risk to existing rows. After apply,
  validate: `SELECT to_regclass('public."DeviceToken"');` returns non-null and the 4 indexes +
  2 FKs exist.
- **Do NOT run `prisma db push` against production** (it reconciles the whole schema) — run these
  explicit statements only, after confirming the endpoint is `ep-weathered-credit`.
- **Rollback:** `DROP TABLE "DeviceToken";` (safe — new, empty, nothing references it).
- **Sequencing:** apply the migration **before/with** the backend deploy so the regenerated client
  (which maps `DeviceToken`) matches the DB. Order: migrate → deploy backend (with `prisma
  generate`) → verify.

## PHASE 3 — Android release configuration audit
- **VITE_API_URL injection:** `src/lib/api.js` reads `import.meta.env.VITE_API_URL`, **baked in at
  build time** (per `DEVELOPER2-HANDOVER.md`); nothing hardcoded. The APK's API base = whatever
  `VITE_API_URL` is set to when `vite build` runs before `npx cap sync android`. Current `.env`
  and `.env.example` use the emulator value `http://10.0.2.2:4000`; `.env.production` sets none,
  and `api.js` **throws** if unset in a prod build.
- **Production API endpoint:** **not derivable from the repo** — docs show only the web origins
  (`https://bispun.com`, `https://consulbuzz.vercel.app`) and a placeholder `https://<api-domain>`.
  The real API URL is the value configured as **`VITE_API_URL` in Vercel** (the web app's prod
  API). **Use that verified value for the APK build — do not guess a URL.**
- **Firebase `google-services.json`:** **present in the main checkout**
  (`S:\Bispun\android\app\google-services.json`), `project_id "bispun-crm"`,
  `package_name "com.bispun.crm"` — **matches** Capacitor `appId` and `applicationId`
  (`com.bispun.crm`). It is **not** in the integration worktree (gitignored; worktrees don't carry
  it). The Gradle `google-services` plugin applies **only if the file exists** (build won't fail
  without it, but push is disabled). ⇒ copy it into the build worktree's `android/app/` before
  building the release APK.
- **Release signing:** `android/app/build.gradle` `buildTypes.release` has `minifyEnabled false`
  + proguard but **no `signingConfig`** → the release build uses the **default debug key**. A
  Play/production APK needs a dedicated **release keystore + signingConfig**; debug-signed is
  acceptable only for internal sideload QA. `versionCode 1 / versionName 1.0` (fine for first
  release; bump for subsequent).

**Safe Android production build plan (no APK generated here):**
1. In the build checkout of `70b8209`, set `VITE_API_URL=<prod API URL from Vercel>` (e.g. a
   `.env.production` used only for the build — not committed).
2. Ensure `android/app/google-services.json` (com.bispun.crm) is present.
3. Decide signing: add a release `signingConfig` (keystore) for Play, or accept debug-signed for QA.
4. `npm run build` → `npx cap sync android` → Gradle assembleRelease (in Android Studio or CLI).
5. Install on a device and run the APK QA plan (below).

## PHASE 4 — Release checklist

### Exact remaining blockers
1. **Backend:** confirm Render build runs `prisma generate` (Phase 1). *(verify; likely already true)*
2. **DB:** apply the `DeviceToken` additive migration to production (Phase 2). *(not applied)*
3. **Android:** (a) bake prod `VITE_API_URL`; (b) place `google-services.json` in the build worktree;
   (c) choose release signing; (d) **rebuild the APK from `70b8209` and QA it** (the APK tested
   earlier was a prior build).
4. **Decision:** `DISABLE_BACKGROUND_WORKERS` is unset in prod → the nurture worker runs once
   Smart Nurture UI is live; confirm that is intended.

### Component readiness (separate)
| Component | Status | Gate |
|---|---|---|
| **Web CRM (Vercel)** | 🟢 Ready | `vite build` green; Vercel `VITE_API_URL` already set (site runs). Deploys on merge to main. |
| **Backend API (Render)** | 🟡 Conditional | needs DeviceToken migration + confirmed `prisma generate` in build. Low-risk, additive. |
| **Android APK** | 🔴 Not ready | needs prod API URL + google-services.json in build + signing decision + rebuild from 70b8209 + device QA. |

### Required tests
- Post-migrate prod smoke: `/api/health`, login, **Lead Store create/edit** (exercises
  `alternatePhone` + regenerated client), Dial & Track, Smart Nurture open, Chat, Calendar.
- Android APK (built from 70b8209): login, Lead Store phone menu reachable/tappable (the 70b8209
  fix), Dial & track/Smart Nurture/WhatsApp/SMS, Chat keyboard, Calendar, **FCM token
  registration + push delivery**, session persistence.
- Still untested (carry forward): FCM push end-to-end, Chat 2-user send, OTP/mobile auth, billing/
  payments, real Nurture sends, real Dial & Track call save, Admissions/Walk-ins/Counselling writes.

### Recommended release sequence
1. Confirm Render build command includes `prisma generate` (fix build-only if missing).
2. Back up / note PITR; **apply the `DeviceToken` migration** to production.
3. Merge `integration/mui-yc` → `main` (triggers Render API + Vercel web auto-deploy).
4. Watch Render build logs: `prisma generate` ran + server started; Vercel build green.
5. Prod smoke (tests above). 6. Separately build + QA the Android APK; release via your channel.

### Rollback plan
- **Web/API:** revert the merge commit on `main` → auto-redeploys the previous web + API. The
  `DeviceToken` table is backward-compatible (old code ignores it); drop it only if required
  (`DROP TABLE "DeviceToken";`).
- **DB:** `DROP TABLE "DeviceToken";` (safe/empty) if fully reverting.
- **Android:** redistribute the previous APK.

### Final GO / NO-GO
- **Web CRM:** 🟢 **GO** (on merge; low-risk).
- **Backend:** 🟡 **CONDITIONAL GO** — GO once the `DeviceToken` migration is applied and Render
  `prisma generate` is confirmed. Both are small and non-destructive.
- **Android:** 🔴 **NO-GO** until built from `70b8209` with prod API URL + `google-services.json`
  + signing decision, then device-QA'd.
- **Overall:** **CONDITIONAL GO** for Web + Backend after the two backend/DB gates; **Android is a
  separate track** not yet release-ready.

**STOP — read-only prerequisites report ready for your approval. Production confirmed to need only
the `DeviceToken` table; nothing applied, changed, or deployed. Candidate: `70b8209`.**
