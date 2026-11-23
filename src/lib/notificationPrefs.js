// Notification sound preference store (frontend half).
//
// A tiny, framework-agnostic store for the current user's notification SOUND
// preferences: whether notification/chat sounds play at all, and at what volume.
//
// Design goals (see PR brief):
//  - Server-persisted (#11): the agreed endpoint
//    (GET/PATCH /api/client/notifications/preferences) stores { soundEnabled,
//    volume } per user, so the preference survives logout/login and syncs
//    across devices. localStorage is kept as an INSTANT-effect cache + offline
//    fallback, not the source of truth.
//  - Every server call stays best-effort: a transient error (offline, cold
//    backend, or a dev build before the migration is applied) must NEVER throw
//    to callers, revert the local value, or spam the console in a loop. The
//    control stays fully responsive and reconciles with the server on next load.
//  - localStorage-backed for instant effect and persistence across reloads; all
//    storage access is wrapped in try/catch (private mode, native WebView,
//    disabled storage, quota).
//  - Native-safe: no bare `window`/`localStorage` assumptions without guards.
//  - Subscribable so sound.js and the Settings control react to changes.

import { apiRequest } from "./api";

const STORAGE_KEY = "bispun_notif_prefs";
// Single agreed contract (#11): sound preferences live on the existing
// notification-preferences route alongside the type toggles. The server nests
// them under `preference` (see readServerPrefs); PATCH accepts a partial
// { soundEnabled, volume } and never clears the type toggles.
const ENDPOINT = "/api/client/notifications/preferences";

const DEFAULTS = Object.freeze({
  soundEnabled: true,
  volume: 1,
  // Which synthesized notification sound plays for workspace alerts. "classic"
  // is the historical pattern, so existing users hear no change. The catalogue
  // of valid keys lives in src/lib/sound.js; an unknown key falls back to the
  // default at playback time (we deliberately do NOT import sound.js here to
  // avoid a circular dependency — sound.js imports this module).
  soundChoice: "classic",
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
    soundChoice:
      typeof source.soundChoice === "string" && source.soundChoice.trim()
        ? source.soundChoice.trim().slice(0, 32)
        : DEFAULTS.soundChoice,
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

export function getSoundChoice() {
  return typeof state.soundChoice === "string" && state.soundChoice
    ? state.soundChoice
    : DEFAULTS.soundChoice;
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
// The server nests all preferences under `preference`; sound fields live there
// alongside the type toggles. Fall back to the top level so a flat payload (or
// a future shape) still hydrates instead of silently reverting to defaults.
function readServerPrefs(data) {
  if (!data || typeof data !== "object") return null;
  if (data.preference && typeof data.preference === "object") {
    return data.preference;
  }
  return data;
}

export async function hydrateFromServer() {
  try {
    const data = await apiRequest(ENDPOINT);
    const server = readServerPrefs(data);
    if (server) {
      state = normalize({ ...state, ...server });
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
