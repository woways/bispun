// Server-only Firebase Cloud Messaging (FCM) sender.
//
// Safety properties:
//  - Firebase Admin credentials live ONLY on the backend, loaded from env.
//  - firebase-admin is imported lazily. If it is not installed or not
//    configured, this module becomes a no-op and the CRM keeps working;
//    push delivery is always best-effort and never throws into callers.
//  - Device tokens are never logged in full (see maskToken).
//
// Pure helpers (maskToken, buildPushMessage, classifyTokenError) are exported
// so they can be unit-tested without Firebase, a network, or a database.

let messagingPromise = null; // memoised init (Promise<messaging | null>)
let warnedUnconfigured = false;

/**
 * Mask a device token for logs: keep only a short suffix. Never log the token
 * itself — it can be used to deliver pushes to a user's device.
 */
export function maskToken(token) {
  const value = String(token || "");
  if (value.length <= 6) return "***";
  return `***${value.slice(-6)}`;
}

// Notification types whose title/message are safe to preview on a device
// lock screen (no customer/lead/financial PII). Everything NOT in this set is
// treated as sensitive and shown with generic text — the full content stays in
// the authenticated in-app notification, which is unchanged. Extend this set
// deliberately, only for categories confirmed to carry no sensitive data.
export const SAFE_PREVIEW_TYPES = new Set(["SYSTEM"]);

export function isSensitiveType(type) {
  return !SAFE_PREVIEW_TYPES.has(String(type || "").trim().toUpperCase());
}

/**
 * Build the FCM message for one token from an in-app Notification row.
 * Pure: no side effects. For sensitive categories the lock-screen payload is
 * GENERIC (no names, phones, amounts, remarks or notes); the real content is
 * only revealed after authenticated navigation inside the app. The data block
 * carries just an id, a type and an internal module key for navigation — never
 * customer data.
 */
export function buildPushMessage({ notification, token }) {
  const sensitive = isSensitiveType(notification?.type);

  const title = sensitive
    ? "Bispun"
    : String(notification?.title || "Bispun").slice(0, 120);
  const body = sensitive
    ? "You have a new notification. Open Bispun to view details."
    : String(notification?.message || "").slice(0, 240);

  return {
    token: String(token),
    notification: { title, body },
    // data values must be strings for FCM. Used for tap-navigation only.
    // actionModule is an internal module key (e.g. "leads"), not customer data.
    data: {
      notificationId: String(notification?.id || ""),
      type: String(notification?.type || "INFO"),
      actionModule: String(notification?.actionModule || ""),
    },
    android: {
      priority: "high",
      notification: {
        channelId: "bispun_default",
        // Defence in depth: hide content on a locked screen for sensitive types.
        visibility: sensitive ? "private" : "public",
      },
    },
  };
}

/**
 * Map a firebase-admin send error to whether the token is permanently invalid
 * (so the caller can deactivate it). Pure.
 */
export function classifyTokenError(error) {
  const code = String(error?.code || error?.errorInfo?.code || "");
  const invalidCodes = [
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token",
    "messaging/invalid-argument",
  ];
  return { invalidToken: invalidCodes.includes(code), code };
}

function readServiceAccount() {
  // Prefer an inline JSON service account; fall back to a file path handled by
  // firebase-admin's applicationDefault() via GOOGLE_APPLICATION_CREDENTIALS.
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline && inline.trim()) {
    try {
      return JSON.parse(inline);
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    }
  }
  return null;
}

/**
 * Lazily initialise firebase-admin messaging. Returns null (and warns once) if
 * firebase-admin is missing or no credentials are configured.
 */
async function getMessaging() {
  if (messagingPromise) return messagingPromise;

  messagingPromise = (async () => {
    let admin;
    try {
      admin = (await import("firebase-admin")).default;
    } catch {
      if (!warnedUnconfigured) {
        console.warn(
          "[push] firebase-admin is not installed; push delivery is disabled."
        );
        warnedUnconfigured = true;
      }
      return null;
    }

    try {
      if (!admin.apps.length) {
        const serviceAccount = readServiceAccount();
        const hasAdc = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

        if (!serviceAccount && !hasAdc) {
          if (!warnedUnconfigured) {
            console.warn(
              "[push] No Firebase credentials configured " +
                "(FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS); " +
                "push delivery is disabled."
            );
            warnedUnconfigured = true;
          }
          return null;
        }

        admin.initializeApp({
          credential: serviceAccount
            ? admin.credential.cert(serviceAccount)
            : admin.credential.applicationDefault(),
        });
      }
      return admin.messaging();
    } catch (error) {
      console.error("[push] Firebase init failed:", error?.message || error);
      return null;
    }
  })();

  return messagingPromise;
}

/** True when FCM is actually usable right now. */
export async function isPushConfigured() {
  return Boolean(await getMessaging());
}

/**
 * Send one notification to many tokens. Best-effort: never throws.
 * Returns { sent, failed, invalidTokens } where invalidTokens should be
 * deactivated by the caller.
 */
export async function sendToTokens(tokens, notification) {
  const list = Array.from(new Set((tokens || []).filter(Boolean)));
  const result = { sent: 0, failed: 0, invalidTokens: [] };
  if (!list.length) return result;

  const messaging = await getMessaging();
  if (!messaging) return result; // disabled / unconfigured

  await Promise.all(
    list.map(async (token) => {
      try {
        await messaging.send(buildPushMessage({ notification, token }));
        result.sent += 1;
      } catch (error) {
        result.failed += 1;
        const { invalidToken, code } = classifyTokenError(error);
        if (invalidToken) result.invalidTokens.push(token);
        console.error(
          `[push] send failed token=${maskToken(token)} code=${code || "unknown"}`
        );
      }
    })
  );

  return result;
}
