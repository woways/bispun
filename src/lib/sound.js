import { getSoundEnabled, getVolume } from "./notificationPrefs";

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
      // System notification: a distinct, brighter three-step rising tone, louder
      // than before so it is not missed, still clean (no clipping).
      tone(ctx, 740, now, 0.14, 0.3, "triangle");
      tone(ctx, 990, now + 0.13, 0.16, 0.28, "triangle");
      tone(ctx, 1240, now + 0.29, 0.18, 0.24, "triangle");
    }

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