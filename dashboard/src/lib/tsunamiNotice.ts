/**
 * Latches BMKG's tsunami-potential statement for the live (non-drill) view.
 *
 * The public feed only carries the latest earthquake. A small aftershock
 * replaces a tsunamigenic mainshock within minutes, while BMKG's warning stays
 * in force until it issues the termination bulletin. So once the statement has
 * been seen it is never dropped just because the feed moved on:
 *
 *   active        the feed still carries the statement
 *   unconfirmed   the feed has moved on; the warning may still be in force
 *   ended         BMKG text stating the warning has ended was observed
 *   acknowledged  the operator recorded that BMKG ended the warning
 *   expired       more than six hours since the earthquake — check BMKG
 *
 * Nothing here estimates heights, zones or arrival times. Those exist only in
 * BMKG's bulletins.
 */

import type { BMKGGempaDetail, SeismicEvent } from './types';
import { classifyPotensi } from './severity';
import { formatWibDate, formatWibTime, toMillis } from './time';

export type TsunamiNoticeStatus = 'active' | 'unconfirmed' | 'ended' | 'acknowledged' | 'expired';

export interface TsunamiNotice {
  /** Event identity: origin time and coordinates. */
  key: string;
  quake: BMKGGempaDetail;
  /** BMKG's statement, verbatim. */
  statement: string;
  originMs: number | null;
  firstSeenMs: number;
  /** Last poll in which the feed still carried the statement. */
  lastSeenMs: number;
  status: TsunamiNoticeStatus;
}

/** How long a statement is treated as possibly in force after the earthquake. */
export const NOTICE_HOLD_MS = 6 * 60 * 60 * 1000;
/** After this long the notice is history and leaves the screen. */
export const NOTICE_RETIRE_MS = 24 * 60 * 60 * 1000;

export function quakeKey(quake: Pick<BMKGGempaDetail, 'DateTime' | 'Coordinates'>): string {
  return `${quake.DateTime || ''}|${(quake.Coordinates || '').replace(/\s+/g, '')}`;
}

/** True while the warning must be treated as possibly in force. */
export function isNoticeInForce(notice: TsunamiNotice | null): notice is TsunamiNotice {
  return notice !== null && (notice.status === 'active' || notice.status === 'unconfirmed');
}

function detailFromRecent(event: SeismicEvent): BMKGGempaDetail {
  const south = event.latitude < 0;
  return {
    Tanggal: formatWibDate(event.timestamp),
    Jam: formatWibTime(event.timestamp),
    DateTime: event.timestamp,
    Coordinates: `${event.latitude},${event.longitude}`,
    Lintang: `${Math.abs(event.latitude).toFixed(2)} ${south ? 'LS' : 'LU'}`,
    Bujur: `${Math.abs(event.longitude).toFixed(2)} BT`,
    Magnitude: event.magnitude.toFixed(1),
    Kedalaman: `${Math.round(event.depth)} km`,
    Wilayah: event.fault_zone,
    Potensi: event.potensi || '',
  };
}

/** The freshest real BMKG record that currently states tsunami potential, if any. */
function findPositive(latest: BMKGGempaDetail | null, recent: SeismicEvent[]): BMKGGempaDetail | null {
  if (latest && !latest.seeded && classifyPotensi(latest.Potensi) === 'tsunami') return latest;
  const candidates = (recent || [])
    .filter((event) => !event.seeded && classifyPotensi(event.potensi) === 'tsunami')
    .sort((a, b) => (toMillis(b.timestamp) ?? 0) - (toMillis(a.timestamp) ?? 0));
  return candidates.length > 0 ? detailFromRecent(candidates[0]) : null;
}

function heldTooLong(originMs: number | null, firstSeenMs: number, nowMs: number): boolean {
  return nowMs - (originMs ?? firstSeenMs) > NOTICE_HOLD_MS;
}

/**
 * Advances the latch with the newest feed contents. Pure: the same inputs give
 * the same notice, so polling can call it as often as it likes.
 */
export function updateTsunamiNotice(
  previous: TsunamiNotice | null,
  latest: BMKGGempaDetail | null,
  recent: SeismicEvent[],
  nowMs: number
): TsunamiNotice | null {
  const positive = findPositive(latest, recent);

  if (positive) {
    const key = quakeKey(positive);
    const originMs = toMillis(positive.DateTime);
    const same = previous !== null && previous.key === key;
    const firstSeenMs = same ? previous.firstSeenMs : nowMs;
    let status: TsunamiNoticeStatus = 'active';
    if (same && previous.status === 'acknowledged') status = 'acknowledged';
    else if (heldTooLong(originMs, firstSeenMs, nowMs)) status = 'expired';
    return { key, quake: positive, statement: positive.Potensi, originMs, firstSeenMs, lastSeenMs: nowMs, status };
  }

  if (!previous) return null;

  if (nowMs - (previous.originMs ?? previous.firstSeenMs) > NOTICE_RETIRE_MS) return null;

  if (previous.status === 'acknowledged' || previous.status === 'ended') return previous;

  const terminated =
    latest !== null && !latest.seeded && classifyPotensi(latest.Potensi) === 'ended';
  if (terminated) return { ...previous, status: 'ended' };

  if (heldTooLong(previous.originMs, previous.firstSeenMs, nowMs)) {
    return previous.status === 'expired' ? previous : { ...previous, status: 'expired' };
  }

  return previous.status === 'unconfirmed' ? previous : { ...previous, status: 'unconfirmed' };
}

/** Operator records that BMKG has ended the warning. The notice stays visible, in grey. */
export function acknowledgeNotice(notice: TsunamiNotice): TsunamiNotice {
  return { ...notice, status: 'acknowledged' };
}
