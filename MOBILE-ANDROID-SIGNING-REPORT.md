# Bispun — Android Release Signing (Integration Branch)

**Branch:** `integration/pr13-main-20261110`
**Signing config integrated from:** `S:\Bispun-release` branch `release/android-signing-prep`,
commit `47396dd` ("build(android): add fail-closed release signing config").
**Status:** signing config present and verified fail-closed. **Signed AAB not yet built**
(requires the existing keystore + passwords — operator-only).

---

## What is configured

`android/app/build.gradle` now:

- Reads release credentials from a **local, gitignored** `android/keystore.properties`
  (template: `android/keystore.properties.example`). No secrets live in the repo.
- Defines `signingConfigs.release`, populated **only** when `keystore.properties` exists.
- Attaches that signing config to `buildTypes.release` **only** when the keystore exists —
  it never falls back to the debug key for a release.
- **Fails closed:** a `gradle.taskGraph.whenReady` guard throws a clear `GradleException`
  if an `assembleRelease`/`bundleRelease` is requested without `keystore.properties`,
  so an unsigned or debug-signed release artifact is never produced.
- Leaves **debug builds and Gradle sync unaffected** (the guard only fires when a release
  task is in the graph).

`.gitignore` already protects: `android/keystore.properties`, `android/bispun-release.jks`,
`android/app/bispun-release.jks`, and all `*.jks` / `*.keystore`.

### Verification performed (this branch)

| Check | Result |
|---|---|
| `assembleDebug --dry-run` (no keystore) | BUILD SUCCESSFUL (debug unaffected) |
| `bundleRelease --dry-run` (no keystore) | BUILD FAILED — fail-closed guard message (build.gradle:67) |
| Full `assembleDebug` (no keystore) | BUILD SUCCESSFUL in 10s (real debug build unchanged) |
| `npx prisma validate` | schema valid |
| `npm test` | 86 pass, 0 fail |

---

## Operator-only steps to produce the signed AAB

> These require the **existing** keystore and its passwords. **Do NOT create, regenerate,
> overwrite, move, or expose the keystore or passwords.** Run these yourself; they are
> intentionally not automated here.

1. **Locate the existing upload keystore** `bispun-release.jks` (do not create a new one).

2. **Create `android/keystore.properties`** (gitignored — never commit) by copying the
   template and filling in real values:
   - `storeFile` — path to the existing `.jks`. Either an **absolute** path (recommended, no
     ambiguity), or place the `.jks` at `android/app/bispun-release.jks` and keep
     `storeFile=bispun-release.jks` (resolved relative to the `:app` module dir).
   - `storePassword`, `keyAlias` (e.g. `bispun-release`), `keyPassword` — the real values.

3. **Build the signed bundle** from `android/`:
   ```
   .\gradlew.bat bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab` (signed with the
   upload key). For a signed APK instead: `.\gradlew.bat assembleRelease` →
   `android/app/build/outputs/apk/release/app-release.apk`.

4. **Confirm it is signed** (not unsigned):
   - APK: `apksigner verify --print-certs app-release.apk`
   - AAB: `jarsigner -verify -verbose -certs app-release.aab` (or validate via `bundletool
     build-apks`). The signer should be the `bispun-release` upload key.

5. **versionCode / versionName:** currently `1` / `1.0`. Fine for the first Play upload.
   **Bump `versionCode`** in `android/app/build.gradle` for every subsequent upload.

6. **Play App Signing:** Google re-signs with the app signing key on upload; `bispun-release.jks`
   is the **upload** key. Keep it (and its passwords) backed up securely — losing it blocks
   future updates unless Play key reset is used.

7. **Upload** the AAB to the Play Console internal-testing track. **HELD** — public Play Store
   submission is on hold per project policy; do not submit without explicit approval.

---

## Signed AAB blocker (current)

- The **existing keystore `bispun-release.jks` and its passwords are not available to this
  automated session** (and must not be created/exposed here). The operator must perform
  steps 2–3 above. Until then, `bundleRelease` correctly fails closed.

## Remaining Android device QA

- Integration APK (`f832936`) was **installed and launch-tested** on Pixel_6: login screen
  rendered, Dev backend reached (`/api/client/auth/me` → 401), no crash. It is **not yet
  fully authenticated-device-tested** (no sign-in / in-app flows exercised on this build).
  The prior user-reported 19/19 manual QA was on the previous build and is **not** claimed here.
- Recommended before release: a fresh authenticated manual pass (login + core flows) on the
  signed build, on the Pixel_6 emulator and at least one physical device.

## Google Play submission blockers

- Signed AAB not yet built (above).
- Play listing assets (title, descriptions, screenshots, feature graphic), Data Safety form,
  and the account-deletion URL deployment — not finalized.
- Public submission is **HELD** pending explicit approval.
