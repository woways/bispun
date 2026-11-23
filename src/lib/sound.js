import { getSoundEnabled, getVolume, getSoundChoice } from "./notificationPrefs";

let audioContext = null;
let unlocked = false;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  return audioContext;
}

function tone(ctx, frequency, start, duration, gain = 0.12, type = "sine") {
  // Scale this tone's peak gain by the user's volume preference (0..1). At
  // volume = 1 the multiplier is 1, so the relative gains/patterns are byte-for-
  // byte unchanged for existing users. exponentialRampToValueAtTime requires a
  // strictly-positive target, so when the scaled peak would collapse to ~0
  // (volume at/near 0) we simply don't emit this tone.
  const scaledGain = gain * Math.min(1, Math.max(0, getVolume()));
  if (scaledGain <= 0.0001) return;

  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(scaledGain, start + 0.01);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume);
  volume.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.04);
}

export async function unlockUiSound() {
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === "suspended") await ctx.resume();

    if (ctx.state === "running" && !unlocked) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.02);
    }

    unlocked = ctx.state === "running";
    return unlocked;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Notification sound catalogue.
//
// Each entry schedules a short, fully synthesized pattern (no audio files) via
// the shared `tone()` helper, so gains stay scaled by the user's volume
// preference and peak well below 1.0 (no clipping). The user picks one in
// Settings; the key is stored in notificationPrefs as `soundChoice`. "classic"
// reproduces the original notification pattern byte-for-byte, so existing users
// hear no change unless they choose otherwise.
// ---------------------------------------------------------------------------
const DEFAULT_NOTIFICATION_SOUND = "classic";

export const NOTIFICATION_SOUNDS = [
  {
    key: "classic",
    label: "Classic",
    play: (ctx, now) => {
      tone(ctx, 740, now, 0.14, 0.3, "triangle");
      tone(ctx, 990, now + 0.13, 0.16, 0.28, "triangle");
      tone(ctx, 1240, now + 0.29, 0.18, 0.24, "triangle");
    },
  },
  {
    key: "chime",
    label: "Chime",
    play: (ctx, now) => {
      tone(ctx, 880, now, 0.16, 0.3, "sine");
      tone(ctx, 1320, now + 0.14, 0.24, 0.26, "sine");
    },
  },
  {
    key: "ping",
    label: "Ping",
    play: (ctx, now) => {
      tone(ctx, 1480, now, 0.12, 0.3, "sine");
    },
  },
  {
    key: "bell",
    label: "Bell",
    play: (ctx, now) => {
      tone(ctx, 1046.5, now, 0.32, 0.3, "sine");
      tone(ctx, 1568, now + 0.02, 0.36, 0.16, "sine");
    },
  },
  {
    key: "marimba",
    label: "Marimba",
    play: (ctx, now) => {
      tone(ctx, 1318, now, 0.12, 0.28, "sine");
      tone(ctx, 1046, now + 0.1, 0.12, 0.26, "sine");
      tone(ctx, 880, now + 0.2, 0.16, 0.24, "sine");
    },
  },
  {
    key: "pulse",
    label: "Pulse",
    play: (ctx, now) => {
      tone(ctx, 660, now, 0.1, 0.3, "triangle");
      tone(ctx, 660, now + 0.16, 0.12, 0.28, "triangle");
    },
  },
  {
    key: "rise",
    label: "Rise",
    play: (ctx, now) => {
      tone(ctx, 587, now, 0.1, 0.28, "sine");
      tone(ctx, 784, now + 0.1, 0.1, 0.28, "sine");
      tone(ctx, 1046, now + 0.2, 0.18, 0.26, "sine");
    },
  },
  {
    key: "alert",
    label: "Alert",
    play: (ctx, now) => {
      tone(ctx, 988, now, 0.1, 0.26, "square");
      tone(ctx, 988, now + 0.16, 0.1, 0.24, "square");
      tone(ctx, 988, now + 0.32, 0.12, 0.22, "square");
    },
  },
];

// Lightweight list for the Settings picker (no play fns leaked to the UI).
export function getNotificationSounds() {
  return NOTIFICATION_SOUNDS.map(({ key, label }) => ({ key, label }));
}

function findNotificationSound(key) {
  return (
    NOTIFICATION_SOUNDS.find((sound) => sound.key === key) ||
    NOTIFICATION_SOUNDS.find((sound) => sound.key === DEFAULT_NOTIFICATION_SOUND)
  );
}

async function playPattern(kind) {
  // Muted: the user turned notification sound off. Return before touching the
  // AudioContext so nothing plays (unlock logic is unaffected — see below).
  if (!getSoundEnabled()) return false;

  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === "suspended") await ctx.resume();
    if (ctx.state !== "running") return false;

    unlocked = true;
    const now = ctx.currentTime + 0.01;

    if (kind === "chat") {
      // Louder, short WhatsApp-style incoming-message chime (original Bispun
      // pattern, not the proprietary WhatsApp audio file). Gains raised for
      // clear audibility on laptop speakers; tones stay sequential and peak
      // well below 1.0 so there is no clipping/distortion.
      tone(ctx, 880, now, 0.13, 0.34, "sine");
      tone(ctx, 1175, now + 0.1, 0.17, 0.3, "sine");
      tone(ctx, 1320, now + 0.22, 0.15, 0.22, "triangle");
    } else {
      // System notification: play the user's chosen sound (defaults to the
      // original rising three-step pattern via "classic").
      findNotificationSound(getSoundChoice()).play(ctx, now);
    }

    return true;
  } catch {
    return false;
  }
}

// Audition a specific notification sound on demand (Settings preview button).
// Deliberately bypasses the soundEnabled gate so the user can hear each option
// while deciding, but still honors the volume preference via tone().
export async function previewNotificationSound(key) {
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === "suspended") await ctx.resume();
    if (ctx.state !== "running") return false;

    unlocked = true;
    findNotificationSound(key).play(ctx, ctx.currentTime + 0.01);
    return true;
  } catch {
    return false;
  }
}

export function playChatSound() {
  return playPattern("chat");
}

export function playNotificationSound() {
  return playPattern("notification");
}

export function isUiSoundUnlocked() {
  return unlocked;
}