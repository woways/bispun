let audioContext = null;
let unlocked = false;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  return audioContext;
}

export async function unlockUiSound() {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    unlocked = ctx.state === "running";
    return unlocked;
  } catch {
    return false;
  }
}

function tone(ctx, frequency, start, duration, gain = 0.045) {
  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume);
  volume.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

async function playPattern(kind) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    if (ctx.state !== "running") return;
    unlocked = true;
    const now = ctx.currentTime + 0.01;
    if (kind === "chat") {
      tone(ctx, 660, now, 0.11, 0.04);
      tone(ctx, 880, now + 0.1, 0.14, 0.035);
    } else {
      tone(ctx, 740, now, 0.12, 0.04);
      tone(ctx, 988, now + 0.12, 0.16, 0.035);
    }
  } catch {
    // Browsers can block audio until the first user gesture. The global unlock
    // listener in ClientPortal will enable later sounds without interrupting UX.
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