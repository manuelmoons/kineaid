/** Sound, vibration and screen wake lock for the workout player. */

let ctx: AudioContext | null = null;

/** Must be called from a user gesture once (e.g. the Start button) so iOS allows audio. */
export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function beep(kind: 'tick' | 'go' | 'done' = 'go') {
  const settings = { tick: { f: 660, d: 0.08 }, go: { f: 880, d: 0.18 }, done: { f: 1046, d: 0.45 } }[kind];
  try {
    if (ctx) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = settings.f;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + settings.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + settings.d);
    }
  } catch {
    /* ignore */
  }
  try {
    navigator.vibrate?.(kind === 'done' ? [200, 100, 200] : kind === 'go' ? 150 : 40);
  } catch {
    /* ignore */
  }
}

type WakeLockSentinelLike = { release: () => Promise<void> };

/** Keeps the screen on while mounted; re-acquires after the tab becomes visible again. */
export function keepScreenOn(): () => void {
  let lock: WakeLockSentinelLike | null = null;
  let stopped = false;
  const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } };
  const acquire = async () => {
    try {
      if (!stopped && nav.wakeLock && document.visibilityState === 'visible') lock = await nav.wakeLock.request('screen');
    } catch {
      /* not supported or denied */
    }
  };
  const onVisible = () => document.visibilityState === 'visible' && acquire();
  void acquire();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    void lock?.release().catch(() => undefined);
  };
}
