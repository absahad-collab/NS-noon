let audioCtx: AudioContext | null = null;
let permAsked = false;

export function getAudioContext(): AudioContext | null {
  return audioCtx;
}

export function isAudioReady(): boolean {
  return !!(audioCtx && audioCtx.state === 'running');
}

export function unlockAudio(): void {
  try {
    if (!audioCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  } catch {
    // Ignore audio context errors
  }
  try {
    if (!permAsked && 'Notification' in window && Notification.permission === 'default') {
      permAsked = true;
      const p = Notification.requestPermission();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch {
    // Ignore notification permission errors
  }
}

function playTones(
  count: number,
  freq: number,
  vol: number,
  stepSec: number,
  durSec: number
): void {
  try {
    unlockAudio();
    const ctx = audioCtx;
    if (!ctx) return;

    const schedule = () => {
      try {
        const t0 = ctx.currentTime;
        for (let i = 0; i < count; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'square';
          o.frequency.setValueAtTime(freq, t0 + i * stepSec);
          g.gain.setValueAtTime(vol, t0 + i * stepSec);
          g.gain.exponentialRampToValueAtTime(0.01, t0 + i * stepSec + durSec);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(t0 + i * stepSec);
          o.stop(t0 + i * stepSec + durSec);
        }
      } catch {
        // Ignore
      }
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(schedule).catch(() => {});
    } else {
      schedule();
    }
  } catch {
    // Ignore
  }
}

export function beep(n = 3): void {
  playTones(n, 1000, 0.25, 0.25, 0.2);
}

export function buzz(count = 3): void {
  try {
    if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 600]);
  } catch {
    // Ignore
  }
  playTones(count, 1200, 0.6, 0.22, 0.18);
}

export function notify(title: string, body: string): void {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, tag: title });
    }
  } catch {
    // Ignore
  }
}
