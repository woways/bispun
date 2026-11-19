// Notification preference logic (backend half) — pure, DB-free helpers so the
// contract can be unit-tested without a database or HTTP layer.
//
// One contract (#11): all notification preferences live on
// UserNotificationPreference and are served by GET/PATCH
// /api/client/notifications/preferences. This adds SOUND preferences
// (soundEnabled, volume) alongside the existing type toggles WITHOUT changing
// their shape or authorization.

// Boolean type-toggle fields a client may PATCH. Unchanged from the original
// route whitelist — listed here so the sanitizer is the single source of truth.
export const BOOLEAN_PREFERENCE_FIELDS = Object.freeze([
  "inAppEnabled",
  "emailEnabled",
  "smsEnabled",
  "leadUpdates",
  "admissionUpdates",
  "billingUpdates",
  "supportUpdates",
  "systemUpdates",
]);

// Defaults MUST match the frontend defaults (src/lib/notificationPrefs.js) and
// the Prisma column defaults, so a user with no stored row behaves identically
// on web, native, and after a logout/login round-trip.
export const SOUND_DEFAULTS = Object.freeze({ soundEnabled: true, volume: 1 });

// ---------------------------------------------------------------------------
// #11 server-side SOUND persistence — DEFERRED (approval-gated).
//
// The soundEnabled/volume columns only exist after migration 0011
// (prisma/pending-migrations/0011_add_notification_sound_prefs.sql), which is
// NOT applied to Production. Until it is, we must never let Prisma write those
// columns, or the notification-preferences PATCH would fail against the live DB.
//
// This flag isolates ONLY the DB write. The read path (projectSoundPrefs) still
// returns safe defaults, and the frontend keeps its per-device localStorage
// fallback, so NO existing behavior changes. The full #11 logic below is kept
// intact: re-enable by (1) applying 0011, (2) restoring the two fields in
// prisma/schema.prisma, (3) `npm run prisma:generate`, (4) flipping this flag.
export const SOUND_PERSISTENCE_ENABLED = false;

// Drop the DB-backed sound fields from a sanitized patch while persistence is
// gated off, so the Prisma upsert never references columns absent in Production.
// A no-op once SOUND_PERSISTENCE_ENABLED is true.
export function gateSoundPersistence(data) {
  if (SOUND_PERSISTENCE_ENABLED) return data;
  const { soundEnabled, volume, ...rest } = data || {};
  return rest;
}

// Coerce an arbitrary value into a volume in [0, 1]. Returns null when the
// value is not a finite number, so callers can distinguish "not provided /
// invalid" (skip) from a real 0.
export function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// Build the Prisma update payload from an arbitrary request body. Only fields
// that are PRESENT and VALID are included, so a partial PATCH (e.g. the sound
// control sending just { soundEnabled, volume }) never clears the type toggles,
// and a types-only PATCH never clears the sound settings.
export function sanitizePreferencePatch(body) {
  const src = body && typeof body === "object" ? body : {};
  const data = {};

  for (const field of BOOLEAN_PREFERENCE_FIELDS) {
    if (typeof src[field] === "boolean") data[field] = src[field];
  }

  if (typeof src.soundEnabled === "boolean") {
    data.soundEnabled = src.soundEnabled;
  }

  if (src.volume !== undefined && src.volume !== null) {
    const v = clampVolume(src.volume);
    if (v !== null) data.volume = v;
  }

  return data;
}

// Project a (possibly null / pre-migration) stored record into the sound half
// of the API response, defaulting safely for missing or invalid values.
export function projectSoundPrefs(record) {
  const soundEnabled =
    typeof record?.soundEnabled === "boolean"
      ? record.soundEnabled
      : SOUND_DEFAULTS.soundEnabled;

  let volume = SOUND_DEFAULTS.volume;
  if (record?.volume !== undefined && record?.volume !== null) {
    const clamped = clampVolume(record.volume);
    if (clamped !== null) volume = clamped;
  }

  return { soundEnabled, volume };
}
