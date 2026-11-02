# Bispun Mobile Push Notifications — Firebase/FCM Setup

This describes how to finish configuring Firebase Cloud Messaging (FCM) for the
Bispun Android app. The code is already implemented on branch
`feat/mobile-notifications`; only the credentials below are required to make
push delivery actually work. **No production database or production secret is
needed for development.**

## What is already done in code

- Android Gradle is pre-configured (`com.google.gms:google-services` classpath
  and a conditional `apply plugin` that activates only when
  `google-services.json` is present).
- The `@capacitor/push-notifications` plugin already pulls
  `com.google.firebase:firebase-messaging` — **no manual Android dependency
  changes were made.**
- App package id is `com.bispun.crm` (unchanged).
- Backend FCM sender (`server/lib/pushService.js`) + dispatch hook, device-token
  API (`/api/client/device-tokens`), and the mobile registration helper
  (`src/lib/mobilePush.js`) are implemented.

## 1. Firebase project (reuse the approved company project if one exists)

Do **not** invent Firebase IDs. In the Firebase console:
1. Open the approved Bispun Firebase project (or create one if the team agrees).
2. Add an **Android app** with package name exactly `com.bispun.crm`.
3. Download **`google-services.json`**.

## 2. Place `google-services.json` (Android client config — safe to commit? NO)

Put the file here:

```
S:\Bispun\android\app\google-services.json
```

- This file is **git-ignored by default** in Capacitor projects. Do **not**
  force-add it. It is a client config file, but treat it as project config and
  keep it out of commits unless your team explicitly decides otherwise.
- After placing it, run:
  ```bash
  npm run build
  ```
  ```bash
  npx cap sync android
  ```

## 3. Backend Firebase Admin credentials (SERVER ONLY — never in the frontend)

The backend sends pushes using a Firebase **service account**. In the Firebase
console: Project Settings → Service accounts → Generate new private key.

Add **one** of these to `S:\Bispun\.env` (never commit it, never paste it in
chat):

```
# Option A: inline JSON (single line)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...", ...}

# Option B: path to the downloaded JSON file
GOOGLE_APPLICATION_CREDENTIALS=C:\\secure\\bispun-fcm-service-account.json
```

If neither is set, push delivery is **disabled** and the CRM runs normally
(in-app notifications still work). The backend logs one warning and never
crashes.

## 4. Android notification channel (optional polish)

The backend sends messages on channel id `bispun_default`. Android 8+ creates a
default channel automatically; a custom channel can be added later in the native
layer if specific sound/importance is desired. Not required for delivery.

## 5. Real-device test steps (Android)

1. Place `google-services.json`, set the backend service account, start backend
   + frontend against a **dev** database.
2. On the phone enable Developer options → USB debugging; connect via USB.
3. `npx cap open android`, then Run (▶) onto the device.
4. Log in. Accept the push permission prompt (Android 13+).
5. Confirm a `DeviceToken` row is created for your user (dev DB only).
6. Trigger any event that creates an in-app notification for your user; the
   device should receive a push. Tapping it should open the matching module.

## Security notes

- Firebase Admin credentials stay on the backend only.
- Device tokens are never logged in full (see `maskToken`).
- Tokens are always bound to the authenticated user/company from the session,
  never from the request body — no cross-tenant delivery is possible.
- Company-wide (userId = null) notifications are **not** pushed yet; that is a
  deliberate follow-up decision.
