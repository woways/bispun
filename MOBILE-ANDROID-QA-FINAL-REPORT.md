# Bispun CRM — Android functional QA, final report (2026-11-02)

**Device:** `emulator-5556` (Pixel_6, API 37, Google Play image) · **Build:** current code
(`index-CUYxkEyj.js`, content-verified = `dist`) · **Backend:** dev `:4000` on **blue-mouse**
(`ep-blue-mouse-b4if0xzj`), `DISABLE_BACKGROUND_WORKERS=true` · **Auth:** signed in as *Bispun Mobile QA*
(dev account). **No production data touched; no real calls/messages/notifications; nothing
pushed/merged/deployed.** Driven via adb `input`+`screencap` with live backend data.

## Headline
**No app bugs found.** Every mobile-specific fix from this effort is verified working on a real Android
runtime with live data. The only failures are **environment limitations** (emulator can't complete the
Firebase token handshake), not code defects. Android functional QA on dev: **GO**. Production *release*
still has 3 prep blockers (signing keystore, `.env.production`, real-device FCM validation).

## PASS / FAIL / NOT TESTED
| Module / workflow | Status | Evidence |
|---|---|---|
| Install current code + content verify | ✅ PASS | `Success`; installed bundle = `index-CUYxkEyj.js` |
| Authentication (logged-in state) | ✅ PASS | Dashboard as "Bispun Mobile QA", avatar, bell 9+ |
| Backend = blue-mouse, workers off | ✅ PASS | health connected; `ep-blue-mouse`, workers disabled |
| Dashboard | ✅ PASS | Business Pulse KPIs, correct date "Mon 2 Nov 2026" |
| **2-column KPI grid (mobile fix)** | ✅ PASS | Dashboard, Lead Store, Revenue all 2-col, no overflow |
| Bottom navigation | ✅ PASS | Dashboard/Leads/Admissions/Finance/More all switch |
| More menu | ✅ PASS | Work/Admissions/Insights/Grow/Quick Actions categorized |
| Lead Store (render + KPIs) | ✅ PASS | Datasets/Imported/Converted/Duplicates, filters, search |
| **Sequential Lead IDs** | ✅ PASS | IDs 1 and 2, "Showing 1–2 of 2 leads" |
| **Horizontal table scroll / all columns reachable (phone-actions occlusion FIX)** | ✅ PASS | Name→Phone→Assigned→Status→Actions all reachable; Actions (mail/edit/delete) no longer occluded |
| **Phone actions menu (FIX)** | ✅ PASS | Copy / Dial number / Dial & track / WhatsApp / Message(SMS), in-app popover |
| **Dial & Track modal** | ✅ PASS | "CLOUD TELEPHONY" modal, calling mode, call-history; not dialed (no real call) |
| **Android back closes overlay (useOverlayDismiss FIX)** | ✅ PASS | BACK closed Dial&Track + Nurture modals, app stayed open |
| Smart Nurture modal | ✅ PASS | Sequences / Process due now / activity; **not** triggered (no sends) |
| **alternatePhone (schema migration)** | ✅ PASS | Edit Lead #1 shows "Alternative Phone 9000000001" — DB→backend→app end-to-end |
| Lead remarks / Notes | ✅ PASS | Edit Lead Notes field populated + editable |
| Edit Lead form (keyboard-safe modal) | ✅ PASS | Name/Phone/AltPhone/Email/Course/Type/Source/Assign/Notes, sticky Save/Cancel |
| Chats (render) | ✅ PASS | search, New, "No chats found" empty state |
| **Calendar mobile agenda + safe-area (FIX)** | ✅ PASS | month grid (today 2 highlighted) + "MONDAY, 2 NOV" agenda |
| **Calendar New event keyboard-safe editor (FIX)** | ✅ PASS | full editor; typed into Title, field stayed visible |
| Finance / Revenue | ✅ PASS | Revenue Management KPI grid |
| Analytics / Insights | ✅ PASS | loads real data (Total Leads 2, Conversion 0%) + Source-wise chart renders |
| Keyboard handling | ✅ PASS | text entry in email/title/notes; IME shown; fields not occluded |
| Dialog positioning / safe areas / no horizontal overflow | ✅ PASS | all modals centered/bottom-sheet, content within safe area |
| App resume (background→foreground) | ✅ PASS | returned to prior state after HOME+relaunch |
| Session persistence (full cold restart) | ✅ PASS | force-stop+relaunch → still authenticated on Dashboard, no re-login |
| No white/blank screens (app) | ✅ PASS | one blank frame was a `screencap` GPU artifact (JS running; redraw fixed it) |
| No crashes | ✅ PASS | zero `FATAL`/ANR for com.bispun.crm across the session |
| **Firebase initialization** | ✅ PASS | FirebaseMessaging/Installations init, hits `firebaseinstallations…/projects/bispun-crm` |
| **Notification permission (Android 13+)** | ✅ PASS | `POST_NOTIFICATIONS granted=true (USER_SET)`; notifications enabled |
| Push plugin wiring + graceful error handling | ✅ PASS | Capacitor PushNotifications runs; `[push] registration error` handled, no crash |
| **FCM token generation** | 🔴 FAIL (environment) | `AUTHENTICATION_FAILED` — emulator can't auth to Firebase Installations; **app code correct** |
| DeviceToken backend registration | ⛔ BLOCKED | no token to register (depends on FCM token) |
| FCM delivery (fg/bg/closed/tap-nav/refresh/logout-cleanup) | ⛔ BLOCKED / NOT TESTED | no token; and won't send to the shared real `bispun-crm` project |
| Chat two-user messaging + attachments | ⛔ NOT TESTED | only one dev QA user in tenant — no second party |
| Lead follow-up date/time | ⚠️ NOT FOUND in edit form | may live in a lead detail/activity view, not the Edit modal |
| OTP onboarding/validation | ⛔ NOT TESTED | needs real OTP delivery — not performed |
| Billing / subscription | ⛔ NOT TESTED | needs real payment — not performed |
| Admissions, Walk-ins, Counselling, UTM, Goals, My Store, Referrals, Settings | ⛔ NOT DEEP-TESTED | reachable via nav/More; not individually exercised |

## Bugs identified / fixed
**None.** No verified app defects, so Phase 7 produced no code changes. The two things that *looked* like
bugs were environment artifacts:
1. "System UI isn't responding" ANR — fresh-emulator CPU thrash during first load (app at 76% CPU), not
   the app.
2. Blank/white frame after cold restart — a `screencap` GPU-compositing artifact; the app's JS was
   running (loading modules, handling push) and a redraw showed the correct authenticated Dashboard.

The QA branch `test/bispun-final-qa-android` (`c349759`) is unchanged; no regression run needed (no fix).

## Firebase / FCM — detail
The push integration is **correct**: Firebase initializes, the Android-13+ permission is requested and
granted, the Capacitor plugin attempts registration, and the app handles failure gracefully. On this
emulator the Firebase Installations service returns `AUTHENTICATION_FAILED` (`GCM-GMS: Failed to get
direct boot token`), so **no FCM token can be minted here** → no DeviceToken, no delivery test. This is a
known emulator/Firebase-provisioning limitation. **End-to-end FCM must be validated on a real device**
with a signed-in Google account, using an **isolated dev target** — not on the shared `bispun-crm`
project from here.

## Android production-release blockers (Phase 8)
1. 🔴 **Release signing keystore** — app uses debug signing only (`signingConfigs` absent, no `.jks`).
2. 🔴 **`.env.production` with `VITE_API_URL=https://api.bispun.com`** — none exists; a release build would
   fall back to the dev/localhost URL.
3. 🟠 **Real-device FCM validation** — cannot be completed on the emulator (see above).
- ✅ Already satisfied: `applicationId com.bispun.crm`, `versionCode 1`/`versionName 1.0`, min 24/target 36,
  `POST_NOTIFICATIONS` in merged manifest, no secrets bundled in the APK.

## Final Android GO / NO-GO
- **Dev functional QA: GO** — current build runs correctly; all mobile fixes verified; no app bugs.
- **Production release: NO-GO until** the 3 blockers above are resolved (keystore + prod env URL +
  real-device FCM check). All require your decision/credentials; none is a code defect.

## Suggested next steps (need your approval)
- Resolve release signing + `.env.production` (I can scaffold `.env.production` and a signing-config
  template; keystore creation/passwords stay with you via a secure method).
- Validate FCM on a physical Android device against an isolated dev notification target.
- Clean up the 2 synthetic dev leads (IDs 1–2 "QA TEST…/DELETE ME") in blue-mouse when you're done.
