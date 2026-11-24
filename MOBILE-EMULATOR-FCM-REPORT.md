# Bispun CRM — Android emulator & FCM testing report

Date: 2026-11-02 · Branch `test/bispun-final-qa-android` @ `c349759` (no commits — no code fix made).
Dev API `http://10.0.2.2:4000` → host `:4000` = **blue-mouse dev DB, workers disabled**. **No
production data touched; no real pushes/messages/calls; nothing pushed/merged/deployed.**

## Step 1 — Android environment
| Item | Result |
|---|---|
| SDK / adb / emulator | ✅ `S:\Android\Sdk` (adb + emulator present; `avdmanager` not installed) |
| Installed AVDs | **`Medium_Phone_API_37.0`** (no Pixel 6/API 34 AVD; used the available one) |
| Emulator start | ✅ booted — `adb devices` → **`emulator-5554 device`**, `sys.boot_completed=1` |
| Platforms / build-tools | android-36/37, build-tools 35/36; Gradle wrapper 8.14.3; app min 24 / compile 36 / target 36 |
| JDKs | jdk-23, jdk-21 (Adoptium), Android Studio JBR (openjdk 25) |

## Step 1.6/1.7 — prior Gradle failure: root cause (environmental, NOT a build-config bug)
**`java.io.IOException: Unable to establish loopback connection`** — reproduced on **all three**
attempts: JDK 23 `--no-daemon`, JDK 21 `--no-daemon`, JDK 21 plain daemon. A single-process Java
loopback bind **succeeds** here, and the dev backend/frontend bind localhost fine, so the failure is
specific to **Gradle's cross-process worker loopback socket** — the classic signature of **security
software (AV/EDR/firewall) blocking Gradle's worker inter-process localhost connection**. (Android
Studio, which the team builds with successfully, is typically whitelisted; its bundled JBR + process
model avoid this.) **This is not a test-branch build-configuration issue** — no `gradle`/manifest
change fixes it, so none was made. Candidate fixes (for you, outside this scope): build in **Android
Studio**; or allow the Gradle worker through the security product; or ensure the Windows `hosts` file
has `127.0.0.1 localhost` / `::1 localhost` (currently absent). I did **not** modify system `hosts`,
security settings, or the JDK.

## Step 2 — Debug APK build
| Sub-step | Result |
|---|---|
| Dev API URL for emulator | ✅ `VITE_API_URL=http://10.0.2.2:4000` baked into the build |
| Backend `:4000` = `.env.development` / blue-mouse / workers off | ✅ verified (process inspection + env probe) |
| `google-services.json` matches `com.bispun.crm` | ✅ copied into `android/app/` (gitignored) |
| `vite build` | ✅ clean |
| `npx cap sync android` | ✅ (app + push-notifications plugins) |
| **Gradle `assembleDebug`** | 🔴 **FAIL — loopback (environmental)**; no production creds used; no release signing requested |

**⇒ No current-integration debug APK could be produced via the CLI in this environment.**

## Step 3 — Install & test
- **Install/launch pipeline: ✅ PASS (mechanics).** The latest **existing** APK
  (`S:\Bispun\android\app\build\outputs\apk\debug\app-debug.apk`, **2026-11-01 19:57 — pre-integration
  code**) installed via `adb install -r` and **launched** (Bispun splash shown; `MainActivity`
  top-most). This proves the emulator + install + launch path works.
- **Current-integration module testing (login, Lead Store, Lead IDs, alt phone, Smart Nurture, Dial &
  Track, Chat, Calendar, keyboard, back, deep links, resume, logout): ⛔ BLOCKED** — the installed APK
  is **old code**, and the current-code APK cannot be built here (Step 2). Per your rule ("test the
  latest integrated code, not an older APK"), these are **NOT validated on device** and are **not**
  reported as pass on old code.

## Step 4 — Firebase FCM
⛔ **BLOCKED — nothing sent.** Reasons: (1) no current-integration APK to register a real DeviceToken;
(2) sending a test push needs Firebase Admin credentials + an isolated non-customer target, which is
not safely available here. Per your instruction, I **stopped before sending** any push. Code-level
status: `google-services.json` (com.bispun.crm) present; `mobilePush.js`, `DeviceToken` model,
`/api/client/device-tokens` route, and `pushService`/`pushDispatch` (try/catch-isolated) are in
`main`. **Device registration/delivery/tap-nav/token-refresh/cleanup: NOT TESTED.** Note: the base
`AndroidManifest.xml` has only `INTERNET`; confirm the merged manifest includes `POST_NOTIFICATIONS`
for Android 13+ (the Capacitor push plugin may inject it).

## Step 5 — Remaining development tests (dev stack, synthetic data)
- **Lead Store (dev): ✅ PASS** this session on the current code — create → 201, **Lead ID
  auto-assign** (created ID 2 after ID 1; unique, ordered newest-first), **alternate phone**
  create/view, **search** filter (→ 1 row), **WhatsApp/SMS/Dial URL generation** (`tel:`,
  `https://wa.me/`, `sms:`), API validation (invalid name chars rejected). Smart Nurture & Dial &
  Track **modals** + nurture/telephony APIs 200 (no real sends/calls; workers off).
- **Follow-up / remarks:** follow-up UI present in `LeadStore.jsx`; **not re-exercised this pass**
  (NOT TESTED). Remarks surfacing not located in `LeadStore.jsx` (likely a separate detail view) —
  NOT TESTED.
- **Chat two-user, OTP (mock), Billing (mock), Smart Nurture scheduling, Dial & Track calls:** NOT
  TESTED — need two simultaneous sessions / provider sandboxes; no real sends or calls were made.

## Automated tests (current code = main)
`npx prisma validate` valid · `node --test` **40/40** · `npx vite build` clean.

## Step 6 — Summary
1. **Gradle build:** 🔴 **FAIL** — `Unable to establish loopback connection` (environmental; use Android Studio).
2. **Debug APK path (current code):** none produced. Existing **old** APK: `S:\Bispun\android\app\build\outputs\apk\debug\app-debug.apk` (2026-11-01, pre-integration).
3. **Emulator install result:** ✅ installed + launched (old code; mechanics PASS). Emulator `emulator-5554` (`Medium_Phone_API_37.0`).
4. **Mobile module results (device):** ⛔ BLOCKED on current code (no current-code APK). Dev **web** functional results: Lead Store PASS (above).
5. **FCM registration/delivery:** ⛔ BLOCKED / NOT TESTED (no current APK + no isolated push target; nothing sent).
6. **Bugs fixed / files changed:** none — no new bug found; the build blocker is environmental, not a code defect.
7. **Automated tests:** PASS (40/40, build, prisma).
8. **Remaining blocked tests:** current-code device smoke; FCM device delivery; Chat 2-user; OTP real; billing payment; follow-up/remarks live.
9. **Android production-release prerequisites:** build in **Android Studio** (CLI loopback blocked) with `VITE_API_URL=https://api.bispun.com`; `google-services.json` (com.bispun.crm) in place; **add a release signing keystore + `signingConfig`** (debug-only today — BLOCKER); verify `POST_NOTIFICATIONS` for Android 13+; then device smoke + FCM delivery. **No Play upload/distribution without your approval.**

## Final status
- **Emulator pipeline:** 🟢 working. **Gradle CLI build:** 🔴 blocked (environmental). **Current-code
  device + FCM testing:** ⛔ blocked until an Android-Studio build of `main` is produced.
- **Web + Backend:** 🟢 already deployed, healthy; Lead Store dev-verified.

**STOP — all safely-runnable steps done; the Android build is blocked by an environment-level Gradle
loopback issue (Android Studio recommended). Nothing sent, pushed, merged or deployed; dev synthetic
leads (IDs 1–2) remain in the dev DB only.**
