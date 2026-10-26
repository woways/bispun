// Mobile push notifications — Android/iOS only (Capacitor).
//
// CRITICAL: every entry point is gated by Capacitor.isNativePlatform(). In a
// desktop/web browser these functions return immediately and do nothing, so
// no native permission prompt is ever shown and existing web behaviour is
// completely unchanged. The @capacitor/push-notifications plugin is imported
// lazily so the web bundle never evaluates native-only code at import time.

import { Capacitor } from "@capacitor/core";
import { apiRequest } from "./api.js";

let initialized = false;
let currentToken = null;
let pluginPromise = null;

export function isMobilePushSupported() {
  try {
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

function loadPlugin() {
  if (!pluginPromise) {
    pluginPromise = import("@capacitor/push-notifications").then(
      (mod) => mod.PushNotifications
    );
  }
  return pluginPromise;
}

async function sendToken(token) {
  await apiRequest("/api/client/device-tokens/register", {
    method: "POST",
    body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
  });
}

/**
 * Initialise push once per native session. Safe to call repeatedly.
 * @param {{ onNavigate?: (actionModule: string) => void }} opts
 *   onNavigate is invoked when the user taps a notification, with the same
 *   actionModule string the in-app notifications already use for navigation.
 */
export async function initMobilePush({ onNavigate } = {}) {
  if (!isMobilePushSupported() || initialized) return;
  initialized = true;

  try {
    const PushNotifications = await loadPlugin();

    let perm = await PushNotifications.checkPermissions();
    if (
      perm.receive === "prompt" ||
      perm.receive === "prompt-with-rationale"
    ) {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      initialized = false; // let a later sign-in retry
      return;
    }

    // Register listeners BEFORE calling register() so the token is captured.
    await PushNotifications.addListener("registration", async (tokenData) => {
      const token = tokenData?.value;
      if (!token || token === currentToken) return;
      currentToken = token;
      try {
        await sendToken(token);
      } catch (error) {
        console.error("[push] token registration failed", error?.message);
      }
    });

    await PushNotifications.addListener("registrationError", (error) => {
      console.error("[push] registration error", error?.error || error);
    });

    // Foreground receipt: Android shows it in the system tray automatically;
    // no desktop-affecting UI work is done here.
    await PushNotifications.addListener("pushNotificationReceived", () => {});

    // Tap (background / cold start): navigate using the existing module router.
    await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action) => {
        const actionModule = action?.notification?.data?.actionModule;
        if (actionModule && typeof onNavigate === "function") {
          onNavigate(actionModule);
        }
      }
    );

    await PushNotifications.register();
  } catch (error) {
    initialized = false;
    console.error("[push] init failed", error?.message || error);
  }
}

/** Deactivate this device server-side and drop listeners. Call on logout. */
export async function unregisterMobilePush() {
  if (!isMobilePushSupported()) return;

  try {
    const PushNotifications = await loadPlugin();

    if (currentToken) {
      try {
        await apiRequest("/api/client/device-tokens/unregister", {
          method: "POST",
          body: JSON.stringify({ token: currentToken }),
        });
      } catch (error) {
        console.error("[push] unregister failed", error?.message);
      }
    }

    await PushNotifications.removeAllListeners();
  } catch (error) {
    console.error("[push] cleanup failed", error?.message || error);
  } finally {
    initialized = false;
    currentToken = null;
  }
}
