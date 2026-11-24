# Bispun CRM — Final QA & Android release-prep report

Date: 2026-11-02 · Code under test = `main` `c349759` (= `70b8209` tree) · Test branch
**`test/bispun-final-qa-android`** @ `c349759` (from origin/main; **no fixes committed — no new bugs
found**). Dev DB = blue-mouse (`bispun-mobile-dev`), workers disabled. **No production data touched;
no external messages/calls; no deploy; no secrets committed.**

## Module results
| Module | Test cases | Passed | Failed | Not tested | Fixes |
|---|---|---:|---:|---:|---:|
| Lead Store (create, Lead ID, alt-phone, search, URL gen, validation) | 10 | 10 | 0 | 0 | 0 |
| Smart Nurture (modal, eligibility UI, APIs) | 4 | 4 | 0 | real sends | 0 |
| Dial & Track (modal, telephony APIs, focus) | 4 | 4 | 0 | real call | 0 |
| Mobile UI (2-col KPI, phone actions, back, safe-area) | 6 | 6 | 0 | 0 | 0 (fix already in c349759) |
| Android production config | 16 | 12 | 0 | 4 (blockers) | 0 |
| Automated gates (build / tests / prisma) | 3 | 3 | 0 | 0 | 0 |
| Production web (unauthenticated smoke) | 4 | 4 | 0 | authed modules | 0 |
| Chat / OTP / Billing / Firebase (functional) | — | — | — | all | 0 |

## COMPLETED (actually exercised)
**Phase 0 — workspace & tooling:** `main` verified at `c349759`; branch `test/bispun-final-qa-android`
created from origin/main; node 22 / npm 10 / java 21 / Capacitor 8.5.3 / Prisma present; dev env =
blue-mouse with `DISABLE_BACKGROUND_WORKERS=true`; the running backend on :4000 was confirmed
(process inspection) to use `--env-file=.env.development` (blue-mouse), **not** production.

**Phase 2 — Lead Store (dev, synthetic leads):**
- ✅ Create lead → `POST /lead-store/manual` **201**.
- ✅ Simplified **Lead ID auto-assignment**: created lead got **ID 2** (after existing ID 1) — sequential.
- ✅ **Uniqueness & ordering**: IDs 1 and 2 distinct; list ordered newest-first.
- ✅ **Alternate phone** create + view (`9000000003`).
- ✅ **Search** filters correctly (search "QA TEST TWO" → 1 matching row, ID 2).
- ✅ **WhatsApp/SMS/Dial URL generation** (`nativeActions.js`): `tel:${num}`, `https://wa.me/${num}`,
  `sms:${num}`.
- ✅ **API validation**: name with `&`/parentheses rejected ("letters, spaces, apostrophes, periods,
  hyphens only").
- ✅ Phone-action menu, **Dial & Track** modal (open/close, telephony APIs 200, focus return), **Smart
  Nurture** modal (eligibility/flow UI, nurture APIs 200), and the **mobile phone-actions fix**
  (reachable/tappable at 375px) — verified on this same code this session.

**Phase 7 — Smart Nurture & Dial & Track (dev):** modals + APIs functional; worker gated off. Real
WhatsApp/Email/SMS sends and real calls **not performed** (no providers connected; by design).

**Phase 8 — Android production config audit:** PASS items — package `com.bispun.crm` (namespace +
applicationId + Capacitor appId all match); `windowSoftInputMode="adjustResize"`; `network_security_config`
present; launcher icons present; `.gitignore` covers google-services/keystore/service-account/`.env`
(10 patterns); **no dev DB endpoints or QA creds in tracked source**; `api.js` throws if `VITE_API_URL`
unset in prod (fails safe).

**Phase 11 — automated gates:** `prisma validate` valid · `node --test` **40/40** · `vite build` clean.

**Phase 1 — production web (unauthenticated):** `api.bispun.com/api/health` connected; CRM login page
renders; protected routes return 401 (auth enforced); Vercel web 200. *(Done in the deploy verification.)*

## NOT TESTED (safe but not exercised / needs data or providers)
- **Lead Store:** remarks management, follow-up date/time (not exercised this pass).
- **Chat (Phase 3):** user-to-user send/receive, history, real-time, unread, attachments, reconnect —
  needs **two simultaneous authenticated sessions**; not feasible to prove in one browser context.
- **OTP (Phase 4):** generation/validation/expiry/rate-limit logic is in code; **real SMS/email delivery
  NOT TESTED** (no provider authorization; would need a sandbox).
- **Billing/Plans (Phase 5):** pages/roles/visibility present in code; **real payment / subscription
  changes NOT TESTED** (no test-mode payment run; no real charges per rules).
- **Firebase push (Phase 6):** DeviceToken model + `/device-tokens` route + `mobilePush.js` present;
  **device push delivery, tap-nav, token refresh/cleanup NOT TESTED** (no running device/emulator;
  `google-services.json` not in the build worktree).

## BLOCKED (missing access / environment / credentials)
1. **Authenticated PRODUCTION testing (Phase 1):** no approved production test account provided → live
   Dashboard/Lead Store/Revenue/Analytics/etc. under login **not tested on production**. (Same code was
   dev-QA'd.) **Needs: a team test account, or your approval to use one.**
2. **Signed production APK/AAB (Phase 8/12):** **no release signing keystore is configured** — the
   `release` build type has no `signingConfig` (debug only). **Will not invent or use debug signing for a
   production release.** **Needs: a release keystore + explicit approval.**
3. **Android device testing (Phase 9):** no emulator currently running; `adb` not on PATH (present at
   `S:\Android\Sdk\platform-tools`); the Gradle **CLI build previously failed** (loopback) in this
   environment (earlier APKs were built in Android Studio). **Needs: Android Studio build + a device/
   emulator**, then the full device smoke.
4. **FCM device push (Phase 6):** blocked by (3) + `google-services.json` placement.

## Android release blockers & setup (Phase 8/12)
To produce a production APK/AAB from `main`:
1. **Release keystore (BLOCKER):** create/obtain a keystore; add a `signingConfigs { release {...} }` +
   `buildTypes.release.signingConfig` to `android/app/build.gradle`; store secrets in `keystore.properties`
   (already gitignored). **Do not** ship debug-signed.
2. **`google-services.json`:** copy the existing `S:\Bispun\android\app\google-services.json` (package
   `com.bispun.crm` — matches) into the build checkout's `android/app/`.
3. **Production API URL:** build with **`VITE_API_URL=https://api.bispun.com`** (the current `dist/` has
   the dev URL baked in — it must be rebuilt). Verify no `10.0.2.2`/localhost in the release bundle.
4. **`POST_NOTIFICATIONS` (Android 13+):** confirm the merged manifest includes it (the
   `@capacitor/push-notifications` plugin may inject it) — add to `AndroidManifest.xml` if absent.
5. Build: `VITE_API_URL=https://api.bispun.com npm run build && npx cap sync android` → Android Studio →
   signed release (AAB for Play, APK for sideload). **No Play upload / distribution without your approval.**

## Phase 10 — fixes
**None required this pass.** No new verified defect was found; the one real bug (mobile phone-actions
occlusion) was fixed and is already in `c349759`. Test branch has no commits beyond `main`.

## Production regression
Production (web + API) remains healthy (`/api/health` connected; web 200; schema additions present; data
intact). No regression observed in the unauthenticated surface. Authenticated production regression =
**BLOCKED** (no test account).

## Remaining blockers (classified)
| Blocker | Type | Needs |
|---|---|---|
| Release signing keystore | CRITICAL (Android release) | Your keystore + approval |
| Authenticated production test account | HIGH (prod verification) | Approved team account |
| Android device/emulator + Gradle build env | HIGH (device QA) | Android Studio build + device |
| WhatsApp/SMS/Email/OTP provider sandboxes | MEDIUM | Provider test-mode + approval |
| Payment test-mode | MEDIUM | Provider test keys + approval |

## Final GO / NO-GO
- **Web CRM + Backend:** 🟢 **GO — already deployed and healthy** (c349759). Lead Store core verified in dev.
- **Android production release:** 🔴 **NO-GO (blocked)** until a release keystore is configured + signed,
  `google-services.json` placed, the bundle rebuilt with `https://api.bispun.com`, and device smoke passes.
- **Unverified functional areas** (Chat 2-user, OTP delivery, billing payment, FCM device): **NOT TESTED**
  — require accounts/providers/devices you must authorize.

**STOP — all safely-runnable testing done; blockers require your access/approval. No code pushed/merged/
deployed; no production data changed; dev synthetic leads (2) remain in the dev DB only.**
