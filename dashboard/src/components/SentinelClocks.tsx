'use client';

import { useNow } from '@/hooks/useNow';
import { scenarioSeconds, type DrillPhase } from '@/lib/drillScenarios';
import {
  formatAge,
  formatScenarioClock,
  formatTPlus,
  formatUtcTime,
  formatWibTime,
  type TimeInput,
} from '@/lib/time';

/*
 * Every ticking piece of text lives in one of these leaf components, so a tick
 * re-renders a few characters instead of the page (and the map with it).
 * Each renders a placeholder until mounted to keep server and client markup equal.
 */

/** Wall clock in WIB, with UTC on wide screens. */
export function WallClock() {
  const now = useNow(1000);
  return (
    <span className="t-data inline-flex items-center gap-2 text-[var(--text-secondary)]">
      <time className="text-[var(--text-primary)]">{formatWibTime(now)}</time>
      <span aria-hidden="true" className="hidden text-[var(--text-muted)] xl:inline">
        /
      </span>
      <time className="hidden xl:inline">{formatUtcTime(now)}</time>
    </span>
  );
}

/** Coarse age ("3 jam lalu"); refreshes twice a minute, never per second. */
export function EventAge({ at, className }: { at: TimeInput; className?: string }) {
  const now = useNow(30_000);
  return <span className={className}>{now === null ? '—' : formatAge(at, now)}</span>;
}

/** Running "T+ 00:12:34" since an event; use only where seconds matter. */
export function EventElapsed({ since, className }: { since: TimeInput; className?: string }) {
  const now = useNow(1000);
  return (
    <span className={className} aria-hidden="true">
      {now === null ? 'T+ --:--:--' : formatTPlus(since, now)}
    </span>
  );
}

/** Drill clock in scenario time ("T+03:12"), running inside the current phase. */
export function ScenarioClock({
  phase,
  phaseEnteredAtMs,
  className,
}: {
  phase: Pick<DrillPhase, 'phaseNumber' | 'tPlusMin'>;
  phaseEnteredAtMs: number;
  className?: string;
}) {
  const now = useNow(1000);
  const seconds = now === null ? phase.tPlusMin * 60 : scenarioSeconds(phase, phaseEnteredAtMs, now);
  return (
    <span className={className} aria-hidden="true">
      {formatScenarioClock(seconds)}
    </span>
  );
}

/** Scenario seconds for components that need the number, not the text. */
export function useScenarioSeconds(
  phase: Pick<DrillPhase, 'phaseNumber' | 'tPlusMin'>,
  phaseEnteredAtMs: number
): number {
  const now = useNow(1000);
  return now === null ? phase.tPlusMin * 60 : scenarioSeconds(phase, phaseEnteredAtMs, now);
}
