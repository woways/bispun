# Bispun CRM — Android install blocker + Android Studio Run handoff

Date: 2026-11-02 · Emulator `emulator-5554` (`Medium_Phone_API_37.0`), online, **not wiped**.
**No production data touched; no real messages/calls; nothing pushed/merged/deployed.**

## Installation result — CLI install BLOCKED (verified, not an assumption)
`adb install` of the fresh APK **hangs every time** and never lands. Attempts, all → hang:
- streamed install (default), non-streaming (`--no-streaming`), `pm install` via push, git-bash + PowerShell,
  before **and** after a clean cold reboot. `installd` sits **idle** (no dexopt) while the PackageManager
  binder transactions stall → the install path is **stuck**, not merely slow.
- **Independently verified:** the installed app is **still the Nov-1 build** (`lastUpdateTime=2026-11-01 20:01`).
  I am **not** claiming the new APK is installed, and I will not test the old build as if it were current.

Per your instruction I **stopped CLI install retries** and terminated the stale install process. The
emulator remains up and online (reconnected after each adb-client kill; **no wipe**).

## The fresh APK to deploy (verified current code)
`S:\Bispun-integ\android\app\build\outputs\apk\debug\app-debug.apk` — built **2026-11-02 18:14**,
package `com.bispun.crm`, web bundle `crm-assets/index-CUYxkEyj.js` (**matches the current `dist`** →
latest integrated code; dev API `http://10.0.2.2:4000`). The dev backend is up on `:4000` (blue-mouse,
workers disabled).

## Step 5 — Android Studio Run (you operate; I can't drive the GUI)
Android Studio's deploy uses its own pipeline (which built your APK + installed the Nov-1 one), so it
typically works where raw `adb install` hangs:
1. In **Android Studio** (project `S:\Bispun-integ\android` already open from your build).
2. Top toolbar **device dropdown** → select **`Medium_Phone_API_37.0` (emulator-5554)** (it's running).
3. Ensure the run config is **app**.
4. Click **Run ▶** (Shift+F10). Android Studio builds (incremental), installs, and launches.
5. Watch the **Run** tool window (bottom) — it should show `Installing APK…` → `Launching…` without the
   loopback error (Android Studio uses its managed Gradle, not the blocked CLI path).
6. Tell me when it says the app launched (or paste any error from the Run/Build window).

## Step 6/7 — logs & verification (I'll do after you Run)
Once you've clicked Run, I will **independently verify actual install success** (not just launch):
`lastUpdateTime` must flip to **2026-11-02**, and the installed app's `versionName`/content must match
the fresh APK. I'll also pull Logcat for deployment/PackageManager errors.

## Step 8 — fallback if Run also fails (fresh AVD; current one NOT wiped)
If Android Studio Run also hangs on install, the current API-37 image is unreliable — create a fresh,
faster AVD (no CLI image/avdmanager is installed, so this is in Android Studio):
1. **Android Studio → Device Manager** (phone icon, right toolbar) → **Create Device**.
2. Pick **Pixel 6** → **Next**.
3. System image: choose **API 34 (UpsideDownCake), x86_64, Google Play** → **Download** if not present → **Next** → **Finish**.
4. **Do not delete/wipe** `Medium_Phone_API_37.0`.
5. **Start** the new Pixel 6 / API 34 emulator, select it in the device dropdown, **Run ▶**.
6. Tell me the new emulator's id (from `adb devices`) and I'll run QA there.

## Steps 9–11 — functional QA (ready to run the moment the current APK is installed)
Dev backend is live (`:4000`, blue-mouse, workers off). Once install is **verified** (Nov-2), I'll test:
Dashboard, bottom nav, Lead Store + Lead IDs + alt phone, Smart Nurture & Dial & Track, Chat, Calendar,
keyboard, **Android back**, session persistence; Firebase init + notification permission + DeviceToken
registration (via Logcat); and an isolated dev FCM delivery **only if a safe non-customer target is
confirmed** (else NOT TESTED — nothing sent to real users).
- **Login:** `install -r`/Run keeps app data, so the prior session may carry over (then I test
  authenticated modules directly). If it lands on the login screen, I'll use a **secure credential-entry
  method** (credential-request tool / the device itself) — I won't ask you to paste a password in chat.

## Step 12 — PASS / FAIL / NOT TESTED (current status)
| Area | Status |
|---|---|
| Fresh APK built + verified current code | ✅ PASS (Nov-2 18:14, bundle match) |
| Dev backend / API / workers | ✅ PASS (blue-mouse, 10.0.2.2, workers off) |
| Emulator up (not wiped) | ✅ PASS (`emulator-5554`, online, booted) |
| **CLI adb install of current APK** | 🔴 **FAIL/BLOCKED** (hangs, all methods, pre/post reboot) |
| Current APK installed on device | ❌ NO — still Nov-1 build |
| Login / Dashboard / Lead Store / Chat / Calendar / Nurture / Dial&Track / back / session | ⛔ NOT TESTED (needs current APK installed) |
| Firebase init / permission / token / delivery | ⛔ NOT TESTED (needs current APK) |

## Remaining blockers
1. **Deploy the current APK** — via **Android Studio Run** (Step 5); CLI install is environment-blocked.
2. (If Run fails) **fresh Pixel 6 / API 34 AVD** in Device Manager (Step 8).
3. **Dev QA login credentials** — only if the carried-over session doesn't authenticate (I'll use a secure method, not chat).

**STOP — CLI install is blocked and I've stopped retrying. Please click Run ▶ in Android Studio (steps
above) to deploy to emulator-5554, then tell me — I'll verify the install is actually the Nov-2 build and
run the full emulator + Firebase QA. Nothing pushed, merged, deployed, or sent.**
