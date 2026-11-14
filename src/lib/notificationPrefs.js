// Notification sound preference store (frontend half).
//
// A tiny, framework-agnostic store for the current user's notification SOUND
// preferences: whether notification/chat sounds play at all, and at what volume.
//
// Design goals (see PR brief):
//  - Works immediately, client-side, with NO backend. The agreed endpoint
//    (GET/PATCH /api/client/notification-preferences -> { soundEnabled, volume })
//    does not exist yet, so every server call is best-effort: a 404 or any other
//    error must NEVER throw to callers, revert the local value, or spam the
//    console in a loop. The control stays fully responsive before the backend
//    lands, and syncs automatically once it does.
//  - localStorage-backed for instant effect and persistence across reloads; all
//    storage access is wrapped in try/catch (private mode, native WebView,
//    disabled storage, quota).
//  - Native-safe: no bare `window`/`localStorage` assumptions without guards.
//  - Subscribable so sound.js and the Settings control react to changes.

import { apiRequest } from "./api";

const STORAGE_KEY = "bispun_notif_prefs";
const ENDPOINT = "/api/client/notification-preferences";

const DEFAULTS = Object.freeze({
  soundEnabled: true,
  volume: 1,
});

// Guarded access to localStorage — returns null when unavailable (SSR, native,
// privacy mode) so callers degrade to in-memory/defaults.
function getStorage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// Coerce an arbitrary object into a valid prefs shape, falling back to defaults
// for any missing/invalid field. Never throws.
function normalize(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    soundEnabled:
      typeof source.soundEnabled === "boolean"
        ? source.soundEnabled
        : DEFAULTS.soundEnabled,
    volume:
      source.volume === undefined || source.volume === null
        ? DEFAULTS.volume
        : clampVolume(source.volume),
  };
}

function readStored() {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return null;
    return normalize(JSON.parse(text));
  } catch {
    return null;
  }
}

function writeStored(prefs) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable / quota — ignore, memory still holds the value */
  }
}

// In-memory state: seeded from localStorage (if present) else defaults, so the
// very first getSoundEnabled()/getVolume() call is correct and synchronous.
let state = readStored() || { ...DEFAULTS };

const listeners = new Set();

function notify() {
  const snapshot = getPrefs();
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      /* a broken subscriber must not break the others or the setter */
    }
  });
}

export function getPrefs() {
  return { ...state };
}

export function getSoundEnabled() {
  return state.soundEnabled === true;
}

export function getVolume() {
  return clampVolume(state.volume);
}

// Update memory + localStorage, notify subscribers, then fire a best-effort
// server PATCH. The local value is applied and persisted FIRST and is never
// reverted by a failed sync — the control must stay responsive before the
// backend endpoint exists.
export function setPrefs(partial) {
  state = normalize({ ...state, ...(partial || {}) });
  writeStored(state);
  notify();

  // Best-effort, fire-and-forget server sync. Any error (404 before the backend
  // lands, network failure, etc.) is swallowed so it never throws or reverts.
  try {
    const result = apiRequest(ENDPOINT, {
      method: "PATCH",
      body: JSON.stringify(getPrefs()),
    });
    if (result && typeof result.catch === "function") {
      result.catch(() => {
        /* no backend yet / offline — keep local value silently */
      });
    }
  } catch {
    /* apiRequest threw synchronously — ignore, local value stands */
  }

  return getPrefs();
}

// One-shot load from the server. On success, merge into memory + localStorage
// and notify. On ANY error (no backend yet, offline, bad payload) keep the
// local/default value silently — no throw, no console spam.
export async function hydrateFromServer() {
  try {
    const data = await apiRequest(ENDPOINT);
    if (data && typeof data === "object") {
      state = normalize({ ...state, ...data });
      writeStored(state);
      notify();
    }
  } catch {
    /* endpoint missing / offline — local or default prefs remain in effect */
  }
  return getPrefs();
}

// Subscribe to preference changes. Returns an unsubscribe function.
export function subscribe(fn) {
  if (typeof fn !== "function") return () => {};
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
