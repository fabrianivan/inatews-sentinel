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
  /** Event identity, fixed when the notice is created. */
  key: string;
  quake: BMKGGempaDetail;
  /** BMKG's statement, verbatim. */
  statement: string;
  originMs: number | null;
  firstSeenMs: number;
  /** When the last payload that still carried the statement was fetched. */
  lastSeenMs: number;
  status: TsunamiNoticeStatus;
}

/** How long a statement is treated as possibly in force after the earthquake. */
export const NOTICE_HOLD_MS = 6 * 60 * 60 * 1000;
/** After this long the notice is history and leaves the screen. */
export const NOTICE_RETIRE_MS = 24 * 60 * 60 * 1000;

/** Two records are one earthquake when their origins and epicentres are this close. */
const SAME_QUAKE_TIME_MS = 3 * 60 * 1000;
const SAME_QUAKE_DEGREES = 0.5;

function parseCoordinates(text: string | null | undefined): { lat: number; lon: number } | null {
  const parts = (text || '').split(',');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

/**
 * Canonical identity of an earthquake: origin time and epicentre to 0.01°. The
 * same event reads "-7.90,108.90" on the latest report and "-7.9,108.9" once it
 * is rebuilt from the M ≥ 5 list, so the raw strings are never compared.
 */
export function quakeKey(quake: Pick<BMKGGempaDetail, 'DateTime' | 'Coordinates'>): string {
  const originMs = toMillis(quake.DateTime);
  const coords = parseCoordinates(quake.Coordinates);
  const time = originMs === null ? (quake.DateTime || '').trim() : new Date(originMs).toISOString();
  const place = coords
    ? `${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}`
    : (quake.Coordinates || '').replace(/\s+/g, '');
  return `${time}|${place}`;
}

/** True when two records describe one earthquake, allowing for BMKG revising its parameters. */
export function isSameQuake(
  a: Pick<BMKGGempaDetail, 'DateTime' | 'Coordinates'>,
  b: Pick<BMKGGempaDetail, 'DateTime' | 'Coordinates'>
): boolean {
  const timeA = toMillis(a.DateTime);
  const timeB = toMillis(b.DateTime);
  if (timeA === null || timeB === null) return quakeKey(a) === quakeKey(b);
  if (Math.abs(timeA - timeB) > SAME_QUAKE_TIME_MS) return false;
  const placeA = parseCoordinates(a.Coordinates);
  const placeB = parseCoordinates(b.Coordinates);
  if (!placeA || !placeB) return true;
  return (
    Math.abs(placeA.lat - placeB.lat) <= SAME_QUAKE_DEGREES &&
    Math.abs(placeA.lon - placeB.lon) <= SAME_QUAKE_DEGREES
  );
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

/**
 * The freshest real BMKG record that states tsunami potential and is no older
 * than `maxAgeMs`, read from the latest report and the M ≥ 5 list alike — the
 * statement outlives the latest report, which an aftershock replaces within
 * minutes. BMKG's termination text on the latest report closes every earlier
 * statement. Placeholder records never count.
 *
 * The default window is the hold period, which is what a caller without a
 * latch (the server-side status and summaries) should treat as "may still be
 * in force". A record with no usable origin time cannot be aged and is kept.
 */
export function findTsunamiStatement(
  latest: BMKGGempaDetail | null | undefined,
  recent: SeismicEvent[] | null | undefined,
  nowMs: number,
  maxAgeMs: number = NOTICE_HOLD_MS
): BMKGGempaDetail | null {
  const withinWindow = (originMs: number | null) => originMs === null || nowMs - originMs <= maxAgeMs;

  if (latest && !latest.seeded) {
    const kind = classifyPotensi(latest.Potensi);
    if (kind === 'ended') return null;
    if (kind === 'tsunami' && withinWindow(toMillis(latest.DateTime))) return latest;
  }

  const listed = (recent || [])
    .filter(
      (event) =>
        !event.seeded && classifyPotensi(event.potensi) === 'tsunami' && withinWindow(toMillis(event.timestamp))
    )
    .sort((a, b) => (toMillis(b.timestamp) ?? 0) - (toMillis(a.timestamp) ?? 0));
  return listed.length > 0 ? detailFromRecent(listed[0]) : null;
}

function ageMs(originMs: number | null, firstSeenMs: number, nowMs: number): number {
  return nowMs - (originMs ?? firstSeenMs);
}

/**
 * Advances the latch with the newest feed contents. Pure: the same inputs give
 * the same notice, so polling can call it as often as it likes.
 *
 * `observedAtMs` is when the payload was fetched. Between polls, and while
 * polls fail, the caller keeps passing the last payload it has; stamping "seen
 * on the feed" with the wall clock would then claim an observation that never
 * happened.
 */
export function updateTsunamiNotice(
  previous: TsunamiNotice | null,
  latest: BMKGGempaDetail | null,
  recent: SeismicEvent[],
  nowMs: number,
  observedAtMs: number = nowMs
): TsunamiNotice | null {
  const seenAtMs = Math.min(observedAtMs, nowMs);
  const realLatest = latest && !latest.seeded ? latest : null;
  const terminated = realLatest !== null && classifyPotensi(realLatest.Potensi) === 'ended';
  // Anything older than the retire window is history, even while BMKG's list still carries it.
  const positive = findTsunamiStatement(latest, recent, nowMs, NOTICE_RETIRE_MS);

  if (positive) {
    const same = previous !== null && isSameQuake(previous.quake, positive);
    const originMs = toMillis(positive.DateTime);
    const firstSeenMs = same ? previous.firstSeenMs : seenAtMs;
    let status: TsunamiNoticeStatus = 'active';
    // Neither BMKG's termination nor the operator's record is undone by the old text still being listed.
    if (same && (previous.status === 'acknowledged' || previous.status === 'ended')) status = previous.status;
    else if (ageMs(originMs, firstSeenMs, nowMs) > NOTICE_HOLD_MS) status = 'expired';
    return {
      key: same ? previous.key : quakeKey(positive),
      quake: positive,
      statement: positive.Potensi,
      originMs,
      firstSeenMs,
      lastSeenMs: same ? Math.max(previous.lastSeenMs, seenAtMs) : seenAtMs,
      status,
    };
  }

  if (!previous) return null;

  const age = ageMs(previous.originMs, previous.firstSeenMs, nowMs);
  if (age > NOTICE_RETIRE_MS) return null;

  if (previous.status === 'acknowledged' || previous.status === 'ended') return previous;

  if (terminated) return { ...previous, status: 'ended' };

  if (age > NOTICE_HOLD_MS) {
    return previous.status === 'expired' ? previous : { ...previous, status: 'expired' };
  }

  // A payload with no real BMKG record means the feed is down, not that it moved on to
  // another earthquake: the notice stays as it was last observed.
  const feedSpoke = realLatest !== null || (recent || []).some((event) => !event.seeded);
  if (!feedSpoke) return previous;

  return previous.status === 'unconfirmed' ? previous : { ...previous, status: 'unconfirmed' };
}

/** Operator records that BMKG has ended the warning. The notice stays visible, in grey. */
export function acknowledgeNotice(notice: TsunamiNotice): TsunamiNotice {
  return { ...notice, status: 'acknowledged' };
}
