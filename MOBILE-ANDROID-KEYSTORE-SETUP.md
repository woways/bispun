# Bispun CRM — Release keystore setup + signed-build readiness (2026-11-03)

Continues MOBILE-ANDROID-SIGNING-REPORT.md. **Nothing signed, built-for-release, pushed, merged,
deployed or published. No keystore created, no passwords handled. No production data / Render / Vercel /
marketing-site changes.** The signing commit is still local only on `release/android-signing-prep`.

---

## A. Re-verified this session (all autonomous, safe checks)

| Check | Result |
|---|---|
| Signing config fail-closed (`android/app/build.gradle`) | ✅ CONFIRMED — see §B |
| Release source = latest approved code | ✅ `47396dd` = `origin/main` (`c34975`, `test/bispun-final-qa-android`) + the one signing commit only |
| Branch diff vs `origin/main` | ✅ only `android/app/build.gradle` (M) + `android/keystore.properties.example` (A); working tree clean |
| Release Vite build → production API | ✅ bundles `https://api.bispun.com` (1×), **zero** `10.0.2.2` |
| Release bundle secret scan | ✅ CLEAN (no `postgres://`, `neon.tech`, `ep-*`, `DATABASE_URL`, live keys) |
| `.env.release` / `.env` git-ignored | ✅ `.env`, `.env.release`, `android/keystore.properties` all ignored |

## B. Signing configuration — fail-closed (reconfirmed)
From `android/app/build.gradle` on `release/android-signing-prep`:
- Credentials read from a **local, gitignored `android/keystore.properties`** — **no passwords, alias or
  paths hardcoded** in tracked files.
- `signingConfigs.release` is populated **only** when `keystore.properties` exists, and attached to
  `buildTypes.release` **only** then. **Never falls back to debug signing for a release.**
- **Fail-closed guard:** `gradle.taskGraph.whenReady` throws a `GradleException` if an
  `assembleRelease`/`bundleRelease` runs **without** `keystore.properties`. Debug builds and Gradle sync
  are unaffected (no release task in the graph).

---

## C. Create the release keystore — YOUR action (passwords stay with you)
> I do **not** generate the key or handle passwords. Do this yourself in Android Studio. I never see or
> print the passwords.

**Open the project first:** Android Studio ▸ **File ▸ Open…** ▸ select `S:\Bispun-release\android`
(the release worktree), let Gradle sync finish.

**Generate the key (wizard):**
1. Menu bar ▸ **Build ▸ Generate Signed Bundle / APK…**
2. Choose **APK** ▸ **Next**.
3. Under "Key store path" click **Create new…**.
4. In the *New Key Store* dialog:
   - **Key store path:** click the folder icon → navigate to `S:\Bispun-release\android\app\` → filename
     **`bispun-release.jks`** → OK.
   - **Password / Confirm:** set a strong keystore password (remember it; it is never committed).
   - **Key ▸ Alias:** `bispun-release`
   - **Key ▸ Password / Confirm:** set the key password (can match the store password).
   - **Validity (years):** `25` or more.
   - **Certificate:** fill First/Last name + Organization (the rest optional).
   - **OK.**
5. Back in the signing dialog the paths/alias are now filled. **STOP here — do not click Next/Finish to
   build yet.** (Building the signed artifact is step E, and only after your explicit go-ahead.)

> CLI alternative (if you prefer, run it yourself — it will prompt for passwords interactively; do not put
> passwords on the command line):
> `keytool -genkeypair -v -keystore S:\Bispun-release\android\app\bispun-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias bispun-release`

## D. Configure `android/keystore.properties` — YOUR action
1. Copy the template:
   `copy S:\Bispun-release\android\keystore.properties.example S:\Bispun-release\android\keystore.properties`
2. Edit `S:\Bispun-release\android\keystore.properties` and set the real values:
   - `storeFile=bispun-release.jks`  (resolves to `android/app/bispun-release.jks`)
   - `storePassword=<your keystore password>`
   - `keyAlias=bispun-release`
   - `keyPassword=<your key password>`
3. Both `*.jks` and `keystore.properties` are **already gitignored** — never commit them. (Verify anytime:
   `git -C S:\Bispun-release check-ignore android/keystore.properties android/app/bispun-release.jks`.)

---

## E. Build the signed release — ONLY after your explicit "yes, sign" (step 8)
Prep (I can run these on your go-ahead; they build the web bundle + sync, no signing yet):
`cd S:\Bispun-release && npx vite build --mode release && npx cap sync android`

Then, because the Gradle **CLI** is blocked by the pre-existing loopback defect, build the signed artifact
**in Android Studio** (its Tooling API avoids the broken CLI path):
1. **Build ▸ Generate Signed Bundle / APK ▸ APK ▸ Next**
2. Select the existing keystore `android/app/bispun-release.jks`, enter passwords, alias `bispun-release`.
3. Build variant **release** ▸ Signature Versions **V1 + V2** ▸ **Finish**.
4. Output: `android/app/release/app-release.apk` (or `build/outputs/apk/release/`).

The fail-closed guard will now **pass** (keystore present) and the APK is signed with your release key. If
`keystore.properties` is missing, the build **fails clearly** instead of producing a debug-signed APK.

## F. Verify the signed APK (after step E)
- **Signature:** `apksigner verify --print-certs app-release.apk` → expect V2 (and V1) true, your cert CN.
- **Package / version:** `aapt dump badging app-release.apk | findstr "package versionName"` →
  `com.bispun.crm`, `versionCode 1`, `versionName 1.0`.
- **Production API baked in:** unzip the APK and grep `assets/public/` for `api.bispun.com` (present) and
  `10.0.2.2` (absent).
- **Firebase:** confirm `google-services.json` (`project_id=bispun-crm`) was present at build time; the
  merged app id is `1:636688255334:android:58029b707c8213c3c320a7`.

## G. Physical-device test (FCM) — after a signed/debug build on a real phone
1. Real Android phone (Android 8+), **Google Play + signed-in Google account**, USB debugging on.
2. `10.0.2.2` is emulator-only — for a device build against a reachable API, use the host LAN IP or a
   deployed dev API (see MOBILE-ANDROID-RELEASE-PREP.md Phase 1, step 2). Restart the dev backend first.
3. Install (`adb -s <device> install -r <apk>`), log in, then
   `adb -s <device> logcat | grep -iE "FirebaseMessaging|\[push\]|DeviceToken"`.
4. **Register the release SHA-1/SHA-256** of `bispun-release.jks` on the Firebase app, or FCM will fail the
   same FIS way as the emulator. Get fingerprints: `keytool -list -v -keystore bispun-release.jks -alias bispun-release`.
5. **Pass:** a token mints, `[push]` registers, a `DeviceToken` row appears for the QA user.

---

## H. Release readiness — GO / NO-GO
- **Signing config: READY** (fail-closed, debug-safe, committed, secrets excluded).
- **Production API config: READY & re-verified** (`api.bispun.com`, no dev URL, no secrets).
- **Release source: READY** (latest approved code).
- **Overall release: NO-GO** until you: (C) create the keystore, (D) write `keystore.properties`,
  (E) build + (F) signature-verify a signed APK via Android Studio **with your approval**, and
  (G) validate FCM + register the release SHA on Firebase. Then publishing still needs your explicit
  approval.

**Awaiting your go-ahead. Next action blocked on you: create the keystore (§C). I will not generate a key,
handle passwords, build a signed artifact, push, merge or distribute without your explicit approval.**
