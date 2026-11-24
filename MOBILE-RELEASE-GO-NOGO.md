# Bispun CRM — Integration Release Preparation: GO / NO-GO

Date: 2026-11-02 · Candidate **`integration/mui-yc @ 70b8209`** · worktree `S:\Bispun-integ`.
**Read-only preparation. No records changed, no commit/push/merge/deploy, no migration applied,
no production config changed.**

## Verdict: 🟡 CONDITIONAL GO
The **code** is release-ready: fully contains both feature branches, builds, passes tests, and
its schema delta vs production is **additive only**. It is **NO-GO for an unconditional deploy**
until four operational prerequisites are met (migration, Prisma client generation on the backend
deploy, Android APK build config, and a decision on the untested workflows). Details below.

---

## 1. Remote branch state (fetched)
| Branch | Head | Changed? |
|---|---|---|
| `origin/main` | `496fa88` | No |
| `origin/feat/mobile-ui-optimization` | `c6b55cc` | No |
| `origin/feat/your-changes` | `d0628dc` | No |
| `origin/feat/mobile-native-actions` | `d29381b` | Advanced — **separate branch, NOT part of this integration** (flag) |

Containment: both `c6b55cc` and `d0628dc` are **ancestors of `70b8209`** — nothing on either
feature branch is missing from the integration. No re-merge needed.

## 2. Intended changes present in the integration ✅
Smart Nurture (`NurtureCenter`), Dial & Track (`CallCenterModal` + `onDial`), Lead Store rewrite,
simplified Lead IDs (`displayLeadId`), `alternatePhone` (schema + 28 UI refs), WhatsApp/SMS
(`nativeActions`), Chat (`ChatPanel` visualViewport), Calendar (`CalendarModal` safe-area), and
the mobile infra (`useOverlayDismiss`, Android `adjustResize`, `ClientPortal` safe-area padding,
plus the new mobile phone-actions fix at `70b8209`). All verified present.

## 3. Release gates on `70b8209` (clean tree) ✅
- `npx prisma validate` → valid
- `node --test` → **40 passed, 0 failed**
- `npx vite build` → clean (~9.7s; only the pre-existing >500 kB chunk-size warning)

## 4. Production build pipeline — ⚠️ ACTION REQUIRED
- Frontend (Vercel): `build` = `vite build`; `vercel.json` only does SPA rewrites. The web app
  does **not** use Prisma — fine.
- **Prisma client: nothing auto-generates it.** No root `postinstall`, and `@prisma/client` has
  **no** postinstall. The client is produced **only** by an explicit `prisma generate`
  (`npm run prisma:generate`), which reads `prisma.config.ts → prisma/schema.prisma` (the
  integration schema, so it would include `alternatePhone` + `DeviceToken`).
- **The backend (Render) deploy build command MUST run `prisma generate`.** This is exactly the
  failure reproduced in dev QA: with a client generated from an older schema, every Lead
  create/update **500s** (`Unknown argument 'alternatePhone'`). The Render build config is **not
  in the repo** (dashboard-managed) — **verify it runs `prisma generate` before relying on this
  deploy.** For the current prod backend to work at all, it almost certainly already does; confirm
  it regenerates on the next deploy with the new schema.
- **Order matters:** both the migration (column exists in DB) **and** client regeneration (client
  knows the field) are required. Migration without regen → 500; regen without migration → 500.

## 5. Android APK test plan + build-config differences
**How the APK is built:** `vite build` → `dist` (Capacitor `webDir`) → `npx cap sync android` →
Gradle build. `appId com.bispun.crm`, `androidScheme http`, `versionCode 1 / versionName 1.0`.

**Build-config differences vs the web/desktop build (must address for a real APK):**
1. **API URL is baked in at build time.** `.env` has `VITE_API_URL=http://10.0.2.2:4000`
   (emulator→host loopback, local only). `.env.production` has **none**, and `api.js` **throws**
   "VITE_API_URL is required in production" if unset in a prod build. → A release APK must be built
   with `VITE_API_URL=<production API https URL>` baked in (e.g. in `.env.production` or build env).
   Never ship the 10.0.2.2 value.
2. **`android/app/google-services.json` is MISSING.** The Gradle `google-services` plugin is applied
   **only if** that file exists (build won't fail without it, but **push notifications are disabled**).
   The DeviceToken/FCM push feature (`src/lib/mobilePush.js` ↔ backend `/api/client/device-tokens`)
   needs the real `google-services.json` present at build time.
3. **Release signing:** a `release` build type exists (`minifyEnabled false`) but no release
   `signingConfig` is in the repo. A Play/production APK needs a release keystore; debug-signed is
   acceptable only for internal QA.
4. Network: `androidScheme http` + `networkSecurityConfig` present; the prod API is https, so no
   cleartext concern.

**APK QA plan (once built from `70b8209` with prod API URL + google-services.json):**
- Install on a device/emulator; log in (QA user); Dashboard + KPIs load from the prod/staging API.
- Lead Store: list, Lead IDs, alternatePhone shows/saves, KPI grids 2-col, **phone menu reachable
  and tappable** (the `70b8209` fix), Dial & track + Smart Nurture open/close, WhatsApp/SMS deep links.
- Chat keyboard-safe composer; Calendar agenda + safe-area; Android hardware-back dismissal.
- Push: token registration (DeviceToken row created), foreground/background notification delivery.
- Session persistence across background/relaunch.

## 6. Production schema diff + non-destructive migration plan (NOT applied)
Diff `origin/main..70b8209` on `prisma/schema.prisma` is **purely additive — no removed/renamed
columns.** The rewrite fields (`assignedToUserId`, `followUpAt`, `LeadRemark`) are **already in
main** (already in production). Only **two objects are new** vs production:

**Prepared SQL (apply to the PRODUCTION DB `ep-weathered-credit` only, with backup/PITR ready):**
```sql
-- (1) DeviceToken table — from prisma/pending-migrations/0001_add_device_token.sql
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

-- (2) Lead.alternatePhone — additive, nullable
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "alternatePhone" TEXT;
```
- Non-destructive: new table + one nullable column; zero existing-row impact; near-instant.
- Verify endpoint is production **before** running; do NOT run `prisma db push` against prod
  (it syncs the whole schema — use these explicit statements).
- **Rollback:** `DROP TABLE "DeviceToken";` and `ALTER TABLE "Lead" DROP COLUMN IF EXISTS "alternatePhone";`
  (safe immediately; after data is written, `alternatePhone` drop discards only that new column's data).

## 7. Production release checklist + rollback
**Pre-deploy**
- [ ] Decide merge path to `main` (merging main auto-deploys **Render API + Vercel web**).
- [ ] Back up / confirm PITR window on the production DB.
- [ ] Apply the additive migration (section 6) to production.
- [ ] Confirm the **Render backend build runs `prisma generate`** (section 4).
- [ ] Confirm Vercel `VITE_API_URL` = production API URL.
- [ ] (Android) build APK with prod `VITE_API_URL` + `google-services.json` + release signing.
- [ ] `DISABLE_BACKGROUND_WORKERS` decision for prod (prod leaves it unset → nurture worker runs;
      confirm that is intended now that Smart Nurture UI is live).

**Deploy**
- [ ] Merge → verify Render build logs show `prisma generate` + successful start; Vercel build green.
- [ ] Smoke prod: `/api/health`, login, Lead Store create/edit (exercises `alternatePhone`), Dial &
      Track, Smart Nurture open, Chat, Calendar.

**Rollback**
- [ ] Revert the merge commit on `main` (re-deploys previous web+API). The additive migration can
      stay (backward-compatible with the old code) or be rolled back via section 6.
- [ ] Android: distribute the previous APK build.

## 8. Tested vs remaining-untested workflows
**Tested / verified this cycle:** branch containment; build + 40/40 tests + prisma validate;
desktop CRM smoke (Dashboard, Lead Store, Revenue, Help, Analytics, My Store, Counselling, UTM,
Walk-ins); Lead Store rewrite incl. Lead IDs + alternatePhone create/read; Smart Nurture modal
(open/close, a11y, APIs 200, no send); Dial & Track modal (open/close, a11y, telephony APIs 200,
no call); mobile layout (2-col KPIs, safe-area, keyboard) and the mobile phone-actions fix
(reachable/tappable at 375px, focus return, 44px target); API auth + health on the dev DB.

**NOT yet tested (carry into release QA, separate from the above):**
- Android **APK rebuilt from `70b8209`** (the APK tested earlier was a prior build) — not built/installed yet.
- **FCM push** end-to-end (needs `google-services.json` + real device + token registration + delivery).
- **Chat** real send/receive between two users; **OTP / mobile auth** end-to-end.
- **Billing / plans / payment** flows; **Smart Nurture** actual sequence execution + real
  WhatsApp/Email/SMS sends (workers were disabled); **Dial & Track** real call + outcome/recording save.
- **Admissions / Walk-ins / Counselling** data-write flows (only read/layout verified).
- Full **production** smoke (only the dev backend/DB was exercised).

---

## Bottom line
**GO** on the integration code — it is contained, green, and schema-additive. **Hold (NO-GO) on an
unconditional deploy** until: (1) the additive production migration is applied, (2) the Render
backend deploy is confirmed to run `prisma generate`, (3) the Android APK is built with the prod API
URL + `google-services.json` (+ release signing), and (4) you accept or close the untested workflows
in section 8. The web + Lead Store/mobile changes are low-risk; the migration is non-destructive and
reversible.

**STOP — GO/NO-GO report ready for your review. Nothing migrated, committed, pushed, merged or
deployed. Candidate commit: `70b8209` on `integration/mui-yc`.**
