# Bispun CRM — Android Studio Run verification (2026-11-02)

**Verdict: Build + launch succeeded, but the CURRENT-CODE APK did NOT install. The app running on
the emulator is an OLDER build. Functional QA not started — I will not test a stale build as if it
were current.** No production data touched; no push/merge/deploy; no parallel adb installs launched
(read-only queries + one APK pull only).

## 1. Did Android Studio's deployment complete?
- **Build:** ✅ SUCCESSFUL (112 Gradle tasks) — your screenshot + the fresh APK confirm it.
- **Launch:** ✅ The app is on screen — `dumpsys activity` shows `MainActivity` visible (Task #33),
  `baseDir=…/com.bispun.crm-fL9HZti3rM282MF3VtU0eA==/base.apk`.
- **Install of the new code:** 🔴 **DID NOT COMPLETE.** Android Studio launched the **pre-existing
  (older) package** instead of replacing it. No `INSTALL_FAILED` line and no pending install session —
  the deploy skipped/failed the install and just relaunched what was already there.

## 2. Installed package identity (read-only)
| Field | Value |
|---|---|
| versionName / versionCode | 1.0 / 1 |
| codePath | `/data/app/~~BZatUw0yKekwAI2ve4hTFw==/com.bispun.crm-fL9HZti3rM282MF3VtU0eA==/base.apk` |
| lastUpdateTime | 2026-11-01 20:01:24 |
| **device clock right now** | **2026-11-01 22:29** (emulator clock lags real Nov-2 by ~1 day) |

Because the emulator's own clock is stuck on Nov-1, `lastUpdateTime` is **useless as an absolute date** —
so I verified by **content** instead. Note the package was last written at device-time **20:01**, which is
~2.5 h *before* the device's current **22:29** clock → the just-now Run did **not** rewrite it.

## 3. Is the Nov-2 current APK installed? — ❌ NO (content proof)
Vite content-hashes every bundle filename, so identical code ⇒ identical names. They differ:

| Bundle | Installed on device | Fresh APK = current `dist` |
|---|---|---|
| main entry | `index-D1wr-juJ.js` | `index-CUYxkEyj.js` |
| app bundle | `index-Dpw74qC2.js` (108 429 B) | `index-Shi6WLnH.js` (109 983 B) |
| css | `index-CNx6l6wQ.css` | `index-BMg-ggkW.css` |
| vendor es | `index.es-BlbfPBPQ.js` | `index.es-BhMTto1u.js` |
| **APK md5** | `826da9924978388b3e1dac246c76b73b` | `1729342dbbb03f68d01efe4e6a1e0960` |

Different hashes on every bundle ⇒ the **installed app is a different, older build**, not the current code.

## 4. Package-manager / Logcat — why the install didn't land
Logcat is full of (the smoking gun):
```
W libbinder.Binder: Binder transaction to android.content.pm.IPackageManager … took 1024–1871ms.
                    Data bytes: 80  Reply bytes: 4
```
**PackageManager binder calls take 1–1.9 s for an 80-byte payload.** The PM subsystem on this API-37
image is pathologically slow — the **same environmental degradation** that hangs `adb install`. A full
install is many such transactions plus dexopt, so it stalls; Android Studio gave up on the install and
launched the existing APK. This is an **emulator/system-image defect**, not a project or code problem.

## 5. No parallel adb installs
Confirmed — I only ran read-only queries (`dumpsys`, `pm path`, `logcat -d`) and pulled the installed
`base.apk` to hash it. No install/reinstall was attempted.

## 6/7. Backend + Firebase
| Check | Status |
|---|---|
| Dev backend `:4000` health | ✅ PASS — `{"success":true,"database":"connected"}` |
| Neon endpoint / workers | ✅ PASS — `ep-blue-mouse-b4if0xzj-pooler`, `is_dev=true`, `workers_disabled=true` |
| Firebase init / notification permission / token | ⛔ NOT TESTED — needs the **current** build running |

## 8. PASS / FAIL / NOT TESTED
| Workflow | Status |
|---|---|
| Gradle build (Android Studio) | ✅ PASS |
| App launch on emulator | ✅ PASS (but **older** build) |
| **Current-code APK installed** | 🔴 **FAIL** — older build on device |
| Dev backend / blue-mouse / workers off | ✅ PASS |
| Login | ⛔ NOT TESTED (needs current build) |
| Dashboard | ⛔ NOT TESTED |
| Bottom navigation | ⛔ NOT TESTED |
| Lead Store (+ Lead IDs, alt phone, phone-actions fix) | ⛔ NOT TESTED |
| Smart Nurture | ⛔ NOT TESTED |
| Dial & Track + native actions (wa.me/sms/tel) | ⛔ NOT TESTED |
| Chat (keyboard-safe composer) | ⛔ NOT TESTED |
| Calendar (mobile agenda) | ⛔ NOT TESTED |
| Keyboard / Android back / session persistence | ⛔ NOT TESTED |
| Firebase init + notification permission + FCM | ⛔ NOT TESTED |

**Everything "NOT TESTED" is blocked on one thing: getting the current-code APK actually installed.**

## Recommended next step — the pre-approved fallback: fresh Pixel 6 / API 34 AVD
The binder-latency evidence shows the API-37 image's PackageManager is the blocker, so retrying install
on it (even clean) will likely stall again. Create a fresh AVD (no wipe of `Medium_Phone_API_37.0`):
1. Android Studio → **Device Manager** (phone icon, right toolbar) → **Create Device**.
2. **Pixel 6** → Next.
3. System image **API 34 (UpsideDownCake), x86_64, Google Play** → **Download** → Next → Finish.
4. **Start** the new Pixel 6 / API 34 emulator, select it in the device dropdown, **Run ▶**.
5. Tell me — I'll `adb devices`, verify the install is the **Nov-2 bundle by content**, then run full QA + Firebase.

*(Cheaper alternative if you'd rather not create an AVD: fully power-off and cold-boot the current
emulator, then Run ▶ again — a cold boot sometimes clears the degraded PackageManager. If install still
stalls, the Pixel 6 / API 34 AVD is the reliable path.)*
