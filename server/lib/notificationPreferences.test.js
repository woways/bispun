import { test } from "node:test";
import assert from "node:assert/strict";

import {
  clampVolume,
  sanitizePreferencePatch,
  gateSoundPersistence,
  projectSoundPrefs,
  SOUND_DEFAULTS,
  SOUND_PERSISTENCE_ENABLED,
} from "./notificationPreferences.js";

test("clampVolume keeps valid values and bounds out-of-range", () => {
  assert.equal(clampVolume(0), 0);
  assert.equal(clampVolume(1), 1);
  assert.equal(clampVolume(0.42), 0.42);
  assert.equal(clampVolume(-0.5), 0); // below floor -> 0
  assert.equal(clampVolume(2), 1); // above ceiling -> 1
  assert.equal(clampVolume("0.25"), 0.25); // numeric string coerced
});

test("clampVolume returns null for genuinely non-numeric input (so it is skipped)", () => {
  assert.equal(clampVolume("loud"), null);
  assert.equal(clampVolume(NaN), null);
  assert.equal(clampVolume(undefined), null); // Number(undefined) === NaN
  assert.equal(clampVolume({}), null);
  // Edge: Number(null) === 0, so clampVolume(null) === 0. This is harmless
  // because sanitizePreferencePatch and projectSoundPrefs both reject null
  // BEFORE calling clampVolume (see the null-guard tests below).
  assert.equal(clampVolume(null), 0);
});

test("sanitize: sound-only PATCH never clears the type toggles", () => {
  const data = sanitizePreferencePatch({ soundEnabled: false, volume: 0.5 });
  assert.deepEqual(data, { soundEnabled: false, volume: 0.5 });
  // No type-toggle key is present, so the upsert leaves them untouched.
  for (const k of [
    "inAppEnabled",
    "leadUpdates",
    "admissionUpdates",
    "billingUpdates",
    "supportUpdates",
    "systemUpdates",
  ]) {
    assert.ok(!(k in data), `${k} must not be in a sound-only patch`);
  }
});

test("sanitize: types-only PATCH never clears the sound settings", () => {
  const data = sanitizePreferencePatch({ leadUpdates: false, inAppEnabled: true });
  assert.deepEqual(data, { leadUpdates: false, inAppEnabled: true });
  assert.ok(!("soundEnabled" in data));
  assert.ok(!("volume" in data));
});

test("sanitize: invalid/missing fields are dropped, volume is clamped", () => {
  assert.deepEqual(sanitizePreferencePatch({ soundEnabled: "yes" }), {}); // non-boolean dropped
  assert.deepEqual(sanitizePreferencePatch({ volume: "x" }), {}); // non-number dropped
  assert.deepEqual(sanitizePreferencePatch({ volume: 5 }), { volume: 1 }); // clamped
  assert.deepEqual(sanitizePreferencePatch({ volume: -1 }), { volume: 0 }); // clamped
  assert.deepEqual(sanitizePreferencePatch({ volume: null }), {}); // null guarded -> skipped
  assert.deepEqual(sanitizePreferencePatch({ soundEnabled: null }), {}); // null guarded -> skipped
  assert.deepEqual(sanitizePreferencePatch({ leadUpdates: "no" }), {}); // non-boolean toggle dropped
});

test("sanitize: non-object body yields an empty (no-op) patch", () => {
  assert.deepEqual(sanitizePreferencePatch(null), {});
  assert.deepEqual(sanitizePreferencePatch(undefined), {});
  assert.deepEqual(sanitizePreferencePatch("nope"), {});
  assert.deepEqual(sanitizePreferencePatch(42), {});
});

test("gate: #11 persistence is deferred (flag off) until migration 0011", () => {
  // Guards the approval-gated state: the DB write must stay isolated so Prisma
  // never references the not-yet-migrated soundEnabled/volume columns.
  assert.equal(SOUND_PERSISTENCE_ENABLED, false);
});

test("gate: strips sound fields but preserves type toggles while deferred", () => {
  const sanitized = sanitizePreferencePatch({
    soundEnabled: false,
    volume: 0.5,
    leadUpdates: true,
    inAppEnabled: false,
  });
  // sanitizer still produces the full #11 shape (feature preserved) ...
  assert.deepEqual(sanitized, {
    leadUpdates: true,
    inAppEnabled: false,
    soundEnabled: false,
    volume: 0.5,
  });
  // ... but the gate drops the DB-backed sound fields so the upsert is safe.
  const gated = gateSoundPersistence(sanitized);
  assert.deepEqual(gated, { leadUpdates: true, inAppEnabled: false });
  assert.ok(!("soundEnabled" in gated));
  assert.ok(!("volume" in gated));
});

test("gate: handles empty / nullish input without throwing", () => {
  assert.deepEqual(gateSoundPersistence({}), {});
  assert.deepEqual(gateSoundPersistence(null), {});
  assert.deepEqual(gateSoundPersistence(undefined), {});
});

test("project: existing-data compatibility — a null/pre-migration row uses defaults", () => {
  assert.deepEqual(projectSoundPrefs(null), {
    soundEnabled: SOUND_DEFAULTS.soundEnabled,
    volume: SOUND_DEFAULTS.volume,
  });
  assert.deepEqual(projectSoundPrefs({ inAppEnabled: true }), {
    soundEnabled: true,
    volume: 1,
  });
});

test("project: stored sound values are returned and clamped", () => {
  assert.deepEqual(projectSoundPrefs({ soundEnabled: false, volume: 0.3 }), {
    soundEnabled: false,
    volume: 0.3,
  });
  // Defensive: a corrupt stored value is clamped on the way out.
  assert.deepEqual(projectSoundPrefs({ soundEnabled: true, volume: 9 }), {
    soundEnabled: true,
    volume: 1,
  });
  // Missing volume -> default; explicit false preserved.
  assert.deepEqual(projectSoundPrefs({ soundEnabled: false }), {
    soundEnabled: false,
    volume: 1,
  });
});
