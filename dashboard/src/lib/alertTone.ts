/**
 * When the alert tone sounds.
 *
 * It marks an escalation: the situation got worse, or a different event now drives it. It
 * stays silent when the situation eases (a warning ends, an earthquake leaves the 24-hour
 * window) and when a feed fails and comes back on the same event — otherwise a flaky
 * connection replays the tone for one earthquake all afternoon.
 */

export interface ToneMemory {
  /** 0 nothing to sound for · 1 attention level TINGGI · 2 tsunami statement or drill threat. */
  rank: number;
  /** What drives it where that has a name: a notice key, a drill phase. */
  identity: string;
  /** Origin time (epoch ms) of the newest event at that rank, where events are what drive it. */
  eventMs: number;
}

export interface ToneSituation extends ToneMemory {
  /** False while the picture is unknown (BMKG feed down): nothing is learned and nothing forgotten. */
  known: boolean;
}

export const TONE_SILENT: ToneMemory = { rank: 0, identity: '', eventMs: 0 };

export function advanceTone(
  last: ToneMemory,
  situation: ToneSituation
): { play: boolean; memory: ToneMemory } {
  if (!situation.known) return { play: false, memory: last };
  const memory: ToneMemory = { rank: situation.rank, identity: situation.identity, eventMs: situation.eventMs };
  if (situation.rank <= 0) return { play: false, memory };
  const escalated = situation.rank > last.rank;
  const differentEvent =
    situation.rank === last.rank &&
    (situation.identity !== last.identity || situation.eventMs > last.eventMs);
  return { play: escalated || differentEvent, memory };
}
