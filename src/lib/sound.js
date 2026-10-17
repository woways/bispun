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
  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume);
  volume.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

export async function unlockUiSound() {
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === "suspended") await ctx.resume();

    // Warm up audio output during a real user gesture. Some browsers report a
    // running AudioContext but keep later sounds silent until audio is touched
    // once from that gesture.
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
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === "suspended") await ctx.resume();
    if (ctx.state !== "running") return false;

    unlocked = true;
    const now = ctx.currentTime + 0.01;

    if (kind === "chat") {
      // Soft professional two-tone chat chime: warm, brief, and distinct.
      tone(ctx, 620, now, 0.18, 0.085, "sine");
      tone(ctx, 820, now + 0.16, 0.22, 0.075, "sine");
    } else {
      // Keep system notifications slightly brighter so users can tell them apart.
      tone(ctx, 780, now, 0.15, 0.13, "triangle");
      tone(ctx, 1040, now + 0.14, 0.2, 0.11, "triangle");
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