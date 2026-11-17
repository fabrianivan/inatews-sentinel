'use client';

import { useCallback, useEffect, useRef } from 'react';

export function useAlertAudio(isMuted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const lastPlayedRef = useRef<number>(0);

  const playChime = useCallback(
    (severity: 'critical' | 'high' = 'critical') => {
      if (isMuted || typeof window === 'undefined') return;
      const nowMs = Date.now();
      // Cooldown 4s so rapid state ticks don't overlap chimes
      if (nowMs - lastPlayedRef.current < 4000) return;
      lastPlayedRef.current = nowMs;

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;

        if (!ctxRef.current) {
          ctxRef.current = new AudioCtx();
        }
        const ctx = ctxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const freqs = severity === 'critical' ? [523.25, 659.25, 783.99] : [440, 554.37];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const startAt = ctx.currentTime + idx * 0.14;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, startAt);

          gain.gain.setValueAtTime(0.0001, startAt);
          gain.gain.exponentialRampToValueAtTime(0.09, startAt + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.24);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startAt);
          osc.stop(startAt + 0.26);
        });
      } catch {
        // Ignore audio errors if blocked by browser policy
      }
    },
    [isMuted]
  );

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  return { playChime };
}
