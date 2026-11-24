# Bispun CRM — Android release prep + FCM troubleshooting (2026-11-03)

Continues MOBILE-ANDROID-QA-FINAL-REPORT.md. **No production infra touched; nothing signed, built-for-release,
pushed, merged, deployed or published; no production notifications; no credentials printed or committed.**
Changes this session are local only: `.env.release` (gitignored) and `keystore.properties.example`
(committable template, no secrets); the mistaken `.env.production` was removed; **no tracked code edited**.

---

## PHASE 1 — FCM `AUTHENTICATION_FAILED`: root cause

### Evidence (from logcat on emulator-5556, now closed)
```
FirebaseMessaging: Failed to get FIS auth token
FirebaseMessaging: Topic sync or token retrieval failed on hard failure exceptions:
                   java.util.concurrent.ExecutionException: java.io.IOException: AUTHENTICATION_FAILED. Won't retry.
GCM-GMS: Failed to get direct boot token: java.io.IOException: AUTHENTICATION_FAILED
CapacitorCookies: Getting cookies at: https://firebaseinstallations.googleapis.com/v1/projects/bispun-crm/installations
Capacitor/Console: [push] registration error ... AUTHENTICATION_FAILED   (handled; no crash)
```
It fails at the **Firebase Installations Service (FIS)** step — the app can't get a FIS auth token, so FCM
never mints a registration token.

### What is correct (ruled out as the cause)
- **App code** — ✅ Firebase initializes, Capacitor PushNotifications runs, **POST_NOTIFICATIONS requested
  and granted** (`granted=true, USER_SET`), registration attempted, error handled gracefully (no crash).
- **Firebase config identity** — ✅ `google-services.json` is internally consistent and matches the app:
  `project_id=bispun-crm`, `project_number=636688255334`,
  `mobilesdk_app_id=1:636688255334:android:58029b707c8213c3c320a7`, `package_name=com.bispun.crm`, API key
  present. So this is **not** a google-services mismatch and **not** an app bug.
- **GMS present** — the emulator has `com.google.android.gms` and `com.android.vending` (Play image).

### Most likely cause + what can't be checked from here
`AUTHENTICATION_FAILED` from FIS on an emulator almost always means the **emulator instance cannot
authenticate to the Firebase project** — it is not device-verified / has no properly provisioned Google
account for FIS. This is **emulator-specific**, consistent with all evidence.

A **project/API** cause cannot be fully excluded without the Firebase/GCP console (no access here). Please
verify in the console (read-only):
1. **APIs enabled** for project `bispun-crm`: *Firebase Installations API*, *Firebase Cloud Messaging API*
   (and legacy *Cloud Messaging*), *FCM Registration API*.
2. **API key restrictions** on the Android key (`current_key`): either unrestricted, or "Android apps"
   with `com.bispun.crm` + the build's signing SHA-1 registered, and the above APIs allowed under "API
   restrictions". A key restricted away from these APIs produces exactly this error.
3. The Android app's **SHA-1/SHA-256** certificate fingerprints are registered on the Firebase app (debug
   keystore SHA-1 for debug builds; release keystore SHA-1 for release).

### Verdict
App + config are correct; the token handshake fails at FIS on this emulator. **Classify as
environment/provisioning, pending the console checks above.** Confirm on a physical device.

### Physical-device FCM test (definitive)
1. Real Android phone (Android 8+), **Google Play + a signed-in Google account**, USB debugging on.
2. **Network wrinkle:** `10.0.2.2` is emulator-only. For a real device, build the APK against either the
   host's LAN IP or a deployed dev/staging API — e.g. `echo "VITE_API_URL=http://<host-LAN-IP>:4000" >
   .env.release2 && npx vite build --mode release2 && npx cap sync android`, then build the APK. (Keep the
   dev backend reachable on that IP/port; it is currently stopped — restart it first.)
3. `adb -s <device> install -r android/app/build/outputs/apk/debug/app-debug.apk` (or Android Studio Run → the phone).
4. Log in, then: `adb -s <device> logcat | grep -iE "FirebaseMessaging|\[push\]|DeviceToken"`.
5. **Pass:** a token is obtained and `[push]` registers → a `DeviceToken` row appears for the QA user
   (confirms emulator-only). **Fail the same way:** project/API config → fix per the console checklist.
- **DeviceToken backend security** (safe to test once a token exists): confirm the register endpoint
  requires auth and stamps the row with the caller's `companyId`/`userId` (tenant isolation), and that a
  token can't be registered for another tenant. Not executable now (no token on the emulator).

---

## PHASE 2 — production build configuration ✅ DONE & VERIFIED
- The client reads **only** `VITE_API_URL`; `src/lib/api.js` **throws in production if it's unset**
  (`"VITE_API_URL is required in production"`) — a good safety net.
- **Correct split (important):** `vite build` is always *production mode*, so a standing `.env.production`
  would have hijacked the **default dev/emulator build** too. Fixed by using a dedicated mode:
  - **`.env.release`** (gitignored) → `VITE_API_URL=https://api.bispun.com`.
  - **Release build command:** `npx vite build --mode release` (then `npx cap sync android`).
  - Default `npm run build` stays on `.env` → `http://10.0.2.2:4000` for dev/emulator. **Preserved.**
- **Verified by test builds (to throwaway dirs, dev `dist` untouched):**
  - default build → baked `http://10.0.2.2:4000`, **no** api.bispun.com.
  - `--mode release` → baked `https://api.bispun.com`, **no** 10.0.2.2.
  - release bundle **secret scan clean** (no `postgres://`, `neon.tech`, `ep-*`, `DATABASE_URL`, keys).
  - (`http://localhost:4000` still appears as a **dead fallback literal** in api.js; never executes in prod.)
- `applicationId com.bispun.crm` ✅ · `versionCode 1`/`versionName 1.0` ✅ · min 24/target 36 ✅ ·
  `POST_NOTIFICATIONS` in merged manifest ✅.

---

## PHASE 3 — release signing (scaffold only; not applied, nothing signed)
Current: `android/app/build.gradle` has **no `signingConfig`** → release = debug-signed (the blocker).
Created `android/keystore.properties.example` (committable template, placeholders only).

**Step A — create the keystore (your action; passwords never leave your machine).** Android Studio →
**Build ▸ Generate Signed Bundle / APK ▸ APK ▸ Create new…**; set key store path
`android/app/bispun-release.jks`, alias `bispun-release`, validity ≥ 25 years; keep the passwords safe.
(CLI equivalent: `keytool -genkeypair -v -keystore android/app/bispun-release.jks -keyalg RSA -keysize 2048
-validity 10000 -alias bispun-release`.)

**Step B — copy the template:** `cp android/keystore.properties.example android/keystore.properties` and
fill in real values. Both `*.jks` and `keystore.properties` are already gitignored — never commit them.

**Step C — apply this gradle diff** (reads the gitignored props; falls back to debug when absent, so it
never breaks the current debug build):
```gradle
// top of android/app/build.gradle, after `apply plugin: 'com.android.application'`
def keystorePropsFile = rootProject.file("keystore.properties")
def keystoreProps = new Properties()
if (keystorePropsFile.exists()) { keystoreProps.load(new FileInputStream(keystorePropsFile)) }

android {
  // …existing config…
  signingConfigs {
    release {
      if (keystorePropsFile.exists()) {
        storeFile file(keystoreProps['storeFile'])
        storePassword keystoreProps['storePassword']
        keyAlias keystoreProps['keyAlias']
        keyPassword keystoreProps['keyPassword']
      }
    }
  }
  buildTypes {
    release {
      if (keystorePropsFile.exists()) { signingConfig signingConfigs.release }
      minifyEnabled false
      proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
  }
}
```
**Step D — build the signed release** (only with your approval): `npx vite build --mode release && npx cap
sync android && cd android && ./gradlew assembleRelease` (APK) or `bundleRelease` (AAB for Play).
I did **not** apply this diff (it's a release-config change; tell me the target branch — the QA branch
`test/bispun-final-qa-android` isn't checked out in either worktree — and I'll apply it there).

---

## PHASE 4 — remaining functional tests
| Test | Status | Reason |
|---|---|---|
| Two-user Chat send/receive + attachments | ⛔ BLOCKED | only one dev QA user in tenant; emulator now closed |
| OTP validation (test provider/mock) | ⛔ NOT TESTED | no test OTP provider configured; no real OTP sends |
| Billing/payment sandbox | ⛔ NOT TESTED | no payment sandbox configured; no real charges |
| Lead follow-up | ⚠️ PARTIAL | `Lead.followUpAt` exists in schema (indexed) but is **not** in the Lead Store edit modal — set via other flows; live test not completed (emulator closed) |
| Smart Nurture stop rules / scheduling | ⚠️ PARTIAL | modal verified render earlier; sequences not created and "Process due now" **not** clicked (avoids sends) |
| FCM token lifecycle / logout cleanup | ⛔ BLOCKED | no token minted on emulator (Phase 1) |

Most of Phase 4 needs a **physical device + a second QA user + sandbox providers**, none available here.
The emulator `emulator-5556` is **no longer running** (closed since the last session); the dev backend
background process is **stopped** (restart before any live device test).

---

## PHASE 5 — final validation
| Check | Result |
|---|---|
| `prisma validate` | ✅ PASS ("schema is valid") |
| Frontend build — default (dev) | ✅ PASS (bundle → 10.0.2.2) |
| Frontend build — `--mode release` | ✅ PASS (bundle → api.bispun.com) |
| Backend tests (`npm test`) | ✅ PASS — 11/11 (pushService + pushDispatch) |
| Android config checks | ✅ PASS (appId, version, min/target, POST_NOTIFICATIONS merged) |
| Secret scan — release bundle | ✅ CLEAN |
| Secret scan — tracked source | ✅ CLEAN (only doc placeholders in `.env.example` + `docs/MOBILE_PUSH_FIREBASE_SETUP.md`) |
| gitignore of new/secret files | ✅ `.env.release`, `*.jks`, `keystore.properties` ignored; `.example` committable |
| Regression | ✅ none — **no tracked code changed**; only gitignored `.env.release` + committable template added |

---

## Status by category
- **PASS:** Phase 2 (prod build config + verification), Phase 5 (validate, both builds, 11/11 tests,
  secret scans, config checks), Phase 3 scaffold prepared.
- **FAIL (environment, not code):** FCM token on the emulator (`AUTHENTICATION_FAILED` at FIS).
- **BLOCKED:** two-user Chat, FCM token lifecycle/logout cleanup, DeviceToken live security test (need
  device + 2nd user + a mintable token).
- **NOT TESTED:** OTP, Billing/payment, release-signed build (needs your keystore + approval).

## What needs your action / approval
1. **Firebase console checks** (Phase 1 checklist) + **physical-device FCM test** to classify
   emulator-vs-project definitively.
2. **Release keystore** creation + `keystore.properties` (passwords stay with you), then say whether to
   apply the Phase 3 gradle diff and on which branch.
3. Approval to build a **signed release** (not done; no publish).
4. Cleanup of the 2 synthetic dev leads (IDs 1–2) in blue-mouse when you're done.

**Do not push/merge/deploy/release-sign/publish or change production config — awaiting your approval.**
