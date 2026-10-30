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

// The single tap-navigation handler shares this state so that prime (early,
// pre-login) and init (post-login) cooperate without attaching two listeners.
let liveOnNavigate = null; // set only while authenticated
let pendingNavigation = null; // a cold-start tap buffered until login
let navListenerAttached = false;

// Internal navigation allowlist. A notification may only move the user to one
// of these known in-app modules. Anything else (unknown key, a URL, junk) is
// ignored — push payloads can never drive arbitrary or external navigation.
// Backend notifications currently use: help, lead-store, leads, settings.
const ALLOWED_MODULES = new Set([
  "dashboard",
  "leads",
  "lead-store",
  "utm-leads",
  "admissions",
  "revenue",
  "revenue-slabs",
  "nurture",
  "my-store",
  "counselling",
  "walkins",
  "chat",
  "notifications",
  "settings",
  "profile",
  "help",
  "referrals",
  "analytics",
  "targets",
]);

const MODULE_KEY = /^[a-z][a-z0-9-]{0,39}$/;

export function isAllowedModule(value) {
  const key = String(value || "").trim();
  return MODULE_KEY.test(key) && ALLOWED_MODULES.has(key);
}

export function isMobilePushSupported() {
  try {
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

function loadPlugin() {
  if (!pluginPromise) {
    // IMPORTANT: resolve to a plain, NON-thenable wrapper object — never the
    // Capacitor plugin proxy directly. The PushNotifications proxy has a `.then`
    // that is "not implemented on android"; if it were a Promise resolution
    // value, Promise adoption would call that `.then` and reject, which aborted
    // push init before register() (no FCM token was ever obtained). Wrapping it
    // in `{ plugin }` keeps the proxy out of the promise-resolution path.
    pluginPromise = import("@capacitor/push-notifications").then((mod) => ({
      plugin: mod.PushNotifications,
    }));
  }
  return pluginPromise;
}

async function sendToken(token) {
  await apiRequest("/api/client/device-tokens/register", {
    method: "POST",
    body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
  });
}

// Validate, then either navigate now (if authenticated) or buffer the target
// for after login. Never navigates a logged-out user.
function handleTapAction(action) {
  const actionModule = action?.notification?.data?.actionModule;
  if (!isAllowedModule(actionModule)) return;

  if (typeof liveOnNavigate === "function") {
    liveOnNavigate(actionModule);
  } else {
    pendingNavigation = actionModule; // consumed by initMobilePush after login
  }
}

async function ensureNavListener() {
  if (navListenerAttached || !isMobilePushSupported()) return;
  const { plugin: PushNotifications } = await loadPlugin();
  await PushNotifications.addListener(
    "pushNotificationActionPerformed",
    handleTapAction
  );
  navListenerAttached = true;
}

/**
 * Attach the tap listener as early as possible (app bootstrap), so a tap that
 * COLD-STARTS the app is captured even before login. No-op in a browser; does
 * not request permission or register — it only buffers a validated target.
 */
export async function primeMobilePush() {
  if (!isMobilePushSupported()) return;
  try {
    await ensureNavListener();
  } catch (error) {
    console.error("[push] prime failed", error?.message || error);
  }
}

/**
 * Initialise push once per native session, after login. Safe to call again.
 * @param {{ onNavigate?: (actionModule: string) => void }} opts
 *   onNavigate receives a validated internal module key and must route only to
 *   an already-authorized destination (the portal enforces per-user/module
 *   permissions on render).
 */
export async function initMobilePush({ onNavigate } = {}) {
  if (!isMobilePushSupported() || initialized) return;
  initialized = true;

  try {
    await ensureNavListener();

    // Enable navigation and flush any cold-start tap captured before login.
    liveOnNavigate = typeof onNavigate === "function" ? onNavigate : null;
    if (pendingNavigation && liveOnNavigate) {
      const target = pendingNavigation;
      pendingNavigation = null;
      liveOnNavigate(target);
    }

    const { plugin: PushNotifications } = await loadPlugin();

    let perm = await PushNotifications.checkPermissions();
    if (
      perm.receive === "prompt" ||
      perm.receive === "prompt-with-rationale"
    ) {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      initialized = false; // let a later sign-in retry (nav still works)
      return;
    }

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

    // Foreground receipt: the existing in-app notification bell already polls
    // and updates its unread count, so no separate in-app banner is created
    // here (avoids duplicate alerts). Android shows nothing extra by default.
    await PushNotifications.addListener("pushNotificationReceived", () => {});

    await PushNotifications.register();
  } catch (error) {
    initialized = false;
    console.error("[push] init failed", error?.message || error);
  }
}

/** Deactivate this device server-side and stop navigating. Call on logout. */
export async function unregisterMobilePush() {
  if (!isMobilePushSupported()) return;

  // Stop navigating immediately: a tap after logout must not route anywhere.
  liveOnNavigate = null;
  pendingNavigation = null;

  try {
    const { plugin: PushNotifications } = await loadPlugin();

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
    navListenerAttached = false;
    currentToken = null;
  }
}
