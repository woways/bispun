# Bispun CRM — Gradle build diagnosis & Android Studio build path

Date: 2026-11-02 · Branch `test/bispun-final-qa-android` @ `c349759` (0 commits — no code fix is
applicable). Build worktree `S:\Bispun-integ` (= main tree). **No production data touched; no system
`hosts`/firewall/AV change; nothing pushed/merged/deployed.**

## Step 1 — root cause: ✅ CONFIRMED (and it is NOT security software)
**Exact failure (from `--stacktrace`):**
```
java.io.IOException: Unable to establish loopback connection
  at org.gradle.internal.remote.internal.inet.SocketConnection.<init>(SocketConnection.java:64)
Caused by: java.net.SocketException: Invalid argument: connect
```
This is Gradle's **launcher ↔ daemon** loopback socket failing with **`EINVAL` ("Invalid argument")**
on `connect()` — not "connection refused" and not a timeout.

**Evidence gathered (reproduced every time):**
| Variable tested | Result |
|---|---|
| JDK 21 (Adoptium) / JDK 23 / **JBR 25** (Android Studio's) | ❌ all fail identically |
| Shell: git-bash **and** PowerShell (native Windows) | ❌ both fail |
| Gradle daemon **and** `--no-daemon` | ❌ both fail |
| `-Djava.net.preferIPv4Stack=true` on daemon (`org.gradle.jvmargs`) **and** launcher (`GRADLE_OPTS`) | ❌ no effect |
| Single-process Java loopback round-trip (localhost/127.0.0.1/::1) | ✅ **works** |
| Cross-process loopback (curl → node backend :4000; browser → :5174) | ✅ **works** |
| Loopback interface | ✅ normal (`127.0.0.1`, `::1`); no VPN/VirtualBox/Hyper-V adapter |

**Conclusion:** The fault is **specific to Gradle's internal `SocketConnection`** on this Windows host
(dual-stack: the machine has active global IPv6 `2001:4490:…` alongside IPv4). It is **not** blocked by
security software — ordinary cross-process loopback connects (curl, browser, node) succeed; a block
would give "connection refused", not `EINVAL`. It is **not** JDK-, shell-, or IPv4/IPv6-flag-fixable
(all tested). **This is not a project build-config defect** — nothing in `gradle.properties`/manifest
fixes it, so the test branch has **no code change**. Android Studio builds succeed because it runs
Gradle via the **Tooling API / its own managed daemon**, which avoids this CLI socket path.

**Safest fix/workaround:** build via **Android Studio** (below). *(System-level options I did NOT take,
per your rules: adding `127.0.0.1 localhost`/`::1 localhost` to the Windows `hosts` file — currently
absent; or reinstalling the Winsock catalog `netsh winsock reset` as admin. Mentioned for your IT only;
not required if you build in Android Studio.)*

## Step 2 — build inputs (verified ready)
- Worktree/branch: `S:\Bispun-integ` (integration/mui-yc @ `70b8209` = the `main`/`c349759` tree).
- `VITE_API_URL = http://10.0.2.2:4000` (emulator → host; from `.env`, used by the production `vite build`).
- Backend `:4000` = **blue-mouse dev DB**, `DISABLE_BACKGROUND_WORKERS=true` (verified).
- `google-services.json` = `com.bispun.crm` (present in `android/app/`, gitignored).
- **Web assets rebuilt + `cap sync`'d** (android assets timestamp current) — ready for a native build.
- No production credentials in the Android bundle (no `ep-weathered`/`pond` in source; dev API only).

## Step 3 — build using Android Studio (you operate the GUI; I cannot drive it reliably)
I can't type into Android Studio's desktop UI, so here are **exact click-by-click** steps:
1. Launch **Android Studio**.
2. **File → Open…** → select **`S:\Bispun-integ\android`** → **OK** (this is the current-code project
   with the freshly synced web assets). If asked to trust the project, **Trust Project**.
3. Let **Gradle Sync** run automatically (bottom status bar). If prompted for a Gradle JDK, accept the
   default **embedded JDK (jbr-25 / "Android Studio default")**.
4. Wait for "Gradle sync finished".
5. **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
6. On the "APK(s) generated" notification, click **locate** — the file is
   **`S:\Bispun-integ\android\app\build\outputs\apk\debug\app-debug.apk`**.
7. **Tell me the APK path + build time**, and I will install it on `emulator-5554` and run Step 4.

*(This APK will carry the emulator API `http://10.0.2.2:4000` — correct for emulator QA. For a
**production** APK, first run `VITE_API_URL=https://api.bispun.com npm run build && npx cap sync android`,
then Build APK, and add a release signing keystore — separate, approval-gated.)*

## Step 4 — device testing (ready to run once the APK exists)
Emulator `emulator-5554` (`Medium_Phone_API_37.0`) is **up and booted**; dev backend is live on
`:4000` (blue-mouse). When you give me the APK path I will: `adb install -r`, verify the installed
`versionName/versionCode` and that it's the current build, then test login, session persistence,
Dashboard/bottom-nav, Lead Store + Lead IDs + alt phone, Smart Nurture & Dial & Track UI, Chat,
Calendar, Android back, phone actions, resume/background, Logcat for crashes, and Firebase
registration + notification permission — sending an isolated dev push only if a safe non-customer
target is confirmed (else report NOT TESTED).

## Step 5 — final report
- **Gradle failure root cause:** ✅ **CONFIRMED** — Gradle `SocketConnection` loopback `connect()` →
  `SocketException: Invalid argument` (dual-stack Windows + Gradle CLI socket path); **not** security
  software, **not** JDK/shell/IPv4-fixable.
- **Android Studio build:** ⏸️ **PENDING YOU** — requires GUI operation I can't perform; exact steps above.
- **New APK path / timestamp:** none yet (CLI build blocked; Android-Studio output will be
  `…\android\app\build\outputs\apk\debug\app-debug.apk`).
- **Installed APK version / source commit:** n/a yet (will verify after your build).
- **Emulator test results:** pending the current-code APK (emulator ready; pipeline proven).
- **FCM test results:** pending the APK (no push sent).
- **Remaining blockers:** (1) Android Studio build is a **user-operated** step; (2) production release
  still needs a **signing keystore** (debug-only today).

**STOP — root cause confirmed; CLI build is environment-blocked. Please build the debug APK in Android
Studio (steps above) and send me the path; I'll install and run the full emulator + FCM smoke. Nothing
pushed, merged, deployed, or sent.**
