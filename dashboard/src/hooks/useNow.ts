'use client';

import { useEffect, useState } from 'react';

/**
 * Current time (epoch ms), refreshed on an interval.
 *
 * Returns null until the component has mounted, so server-rendered markup and
 * the first client render agree — render a placeholder while it is null. Keep
 * it in small leaf components: every tick re-renders the component that calls it.
 */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
