import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acknowledgeNotice,
  findTsunamiStatement,
  isNoticeInForce,
  isSameQuake,
  NOTICE_HOLD_MS,
  NOTICE_RETIRE_MS,
  quakeKey,
  updateTsunamiNotice,
} from '../tsunamiNotice';
import type { BMKGGempaDetail, SeismicEvent } from '../types';

const ORIGIN = Date.parse('2026-11-16T02:00:00Z');
const MINUTE = 60_000;

const MAINSHOCK: BMKGGempaDetail = {
  Tanggal: '16 Nov 2026',
  Jam: '09:00:00 WIB',
  DateTime: new Date(ORIGIN).toISOString(),
  Coordinates: '-7.90,108.90',
  Lintang: '7.90 LS',
  Bujur: '108.90 BT',
  Magnitude: '7.4',
  Kedalaman: '12 km',
  Wilayah: '110 km BaratDaya CILACAP-JATENG',
  Potensi: 'Peringatan dini berpotensi TSUNAMI untuk wilayah Jawa Selatan',
};

const AFTERSHOCK: BMKGGempaDetail = {
  ...MAINSHOCK,
  DateTime: new Date(ORIGIN + 9 * MINUTE).toISOString(),
  Jam: '09:09:00 WIB',
  Coordinates: '-7.95,108.80',
  Magnitude: '5.1',
  Potensi: 'Tidak berpotensi tsunami',
};

test('a tsunami-potential statement creates an active notice keyed by the earthquake', () => {
  const notice = updateTsunamiNotice(null, MAINSHOCK, [], ORIGIN + 3 * MINUTE);
  assert.ok(notice);
  assert.equal(notice.status, 'active');
  assert.equal(notice.key, quakeKey(MAINSHOCK));
  assert.equal(notice.statement, MAINSHOCK.Potensi);
  assert.equal(notice.firstSeenMs, ORIGIN + 3 * MINUTE);
  assert.equal(isNoticeInForce(notice), true);
});

test('an aftershock replacing the feed does not clear the warning', () => {
  const seen = updateTsunamiNotice(null, MAINSHOCK, [], ORIGIN + 3 * MINUTE);
  const afterAftershock = updateTsunamiNotice(seen, AFTERSHOCK, [], ORIGIN + 10 * MINUTE);
  assert.ok(afterAftershock);
  assert.equal(afterAftershock.status, 'unconfirmed');
  assert.equal(afterAftershock.key, quakeKey(MAINSHOCK));
  assert.equal(afterAftershock.quake.Magnitude, '7.4');
  // Still treated as possibly in force, and the last time the feed carried it is kept.
  assert.equal(isNoticeInForce(afterAftershock), true);
  assert.equal(afterAftershock.lastSeenMs, ORIGIN + 3 * MINUTE);
});

test('polling the same statement keeps one notice and its first-seen time', () => {
  const first = updateTsunamiNotice(null, MAINSHOCK, [], ORIGIN + 3 * MINUTE);
  const second = updateTsunamiNotice(first, MAINSHOCK, [], ORIGIN + 4 * MINUTE);
  assert.ok(second);
  assert.equal(second.firstSeenMs, ORIGIN + 3 * MINUTE);
  assert.equal(second.lastSeenMs, ORIGIN + 4 * MINUTE);
  assert.equal(second.status, 'active');
});

test('after the hold period the notice turns to "check BMKG" instead of vanishing or going green', () => {
  const seen = updateTsunamiNotice(null, MAINSHOCK, [], ORIGIN + 3 * MINUTE);
  const moved = updateTsunamiNotice(seen, AFTERSHOCK, [], ORIGIN + 10 * MINUTE);
  const late = updateTsunamiNotice(moved, AFTERSHOCK, [], ORIGIN + NOTICE_HOLD_MS + MINUTE);
  assert.ok(late);
  assert.equal(late.status, 'expired');
  assert.equal(isNoticeInForce(late), false);

  // A statement still on the feed long after the quake is also not shown as a live warning.
  const stillOnFeed = updateTsunamiNotice(null, MAINSHOCK, [], ORIGIN + NOTICE_HOLD_MS + MINUTE);
  assert.equal(stillOnFeed?.status, 'expired');

  // A day later the notice is history.
  assert.equal(updateTsunamiNotice(late, AFTERSHOCK, [], ORIGIN + NOTICE_RETIRE_MS + MINUTE), null);
});

test('BMKG termination text and operator acknowledgement end the warning without removing it', () => {
  const seen = updateTsunamiNotice(null, MAINSHOCK, [], ORIGIN + 3 * MINUTE);
  const termination: BMKGGempaDetail = { ...MAINSHOCK, Potensi: 'Peringatan dini tsunami dinyatakan telah berakhir' };
  const ended = updateTsunamiNotice(seen, termination, [], ORIGIN + 130 * MINUTE);
  assert.equal(ended?.status, 'ended');
  assert.equal(isNoticeInForce(ended), false);

  assert.ok(seen);
  const acknowledged = acknowledgeNotice(seen);
  assert.equal(acknowledged.status, 'acknowledged');
  // The feed still carrying the old statement does not undo the acknowledgement.
  assert.equal(updateTsunamiNotice(acknowledged, MAINSHOCK, [], ORIGIN + 20 * MINUTE)?.status, 'acknowledged');
});

test('a new tsunamigenic earthquake replaces the previous notice', () => {
  const seen = updateTsunamiNotice(null, MAINSHOCK, [], ORIGIN + 3 * MINUTE);
  const second: BMKGGempaDetail = {
    ...MAINSHOCK,
    DateTime: new Date(ORIGIN + 40 * MINUTE).toISOString(),
    Coordinates: '-8.40,109.60',
    Magnitude: '7.1',
  };
  const replaced = updateTsunamiNotice(seen, second, [], ORIGIN + 43 * MINUTE);
  assert.equal(replaced?.key, quakeKey(second));
  assert.equal(replaced?.firstSeenMs, ORIGIN + 43 * MINUTE);
  assert.equal(replaced?.status, 'active');
});

test('placeholder records never create a notice; a statement on the recent list does', () => {
  assert.equal(updateTsunamiNotice(null, { ...MAINSHOCK, seeded: true }, [], ORIGIN + MINUTE), null);
  assert.equal(updateTsunamiNotice(null, AFTERSHOCK, [], ORIGIN + 10 * MINUTE), null);

  const listed: SeismicEvent = {
    type: 'SEISMIC',
    magnitude: 7.4,
    depth: 12,
    frequency: 0,
    count: 1,
    latitude: -7.9,
    longitude: 108.9,
    mmi: 0,
    pga: 0,
    fault_zone: '110 km BaratDaya CILACAP-JATENG',
    timestamp: new Date(ORIGIN).toISOString(),
    potensi: 'Berpotensi tsunami',
  };
  const fromList = updateTsunamiNotice(null, AFTERSHOCK, [listed], ORIGIN + 10 * MINUTE);
  assert.ok(fromList);
  assert.equal(fromList.status, 'active');
  assert.equal(fromList.quake.Magnitude, '7.4');
  assert.equal(fromList.statement, 'Berpotensi tsunami');
});

/** The mainshock as it reads once it is only on BMKG's M ≥ 5 list. */
const MAINSHOCK_LISTED: SeismicEvent = {
  type: 'SEISMIC',
  magnitude: 7.4,
  depth: 12,
  frequency: 0,
  count: 1,
  latitude: -7.9,
  longitude: 108.9,
  mmi: 0,
  pga: 0,
  fault_zone: '110 km BaratDaya CILACAP-JATENG',
  timestamp: new Date(ORIGIN).toISOString(),
  potensi: 'Peringatan dini berpotensi TSUNAMI untuk wilayah Jawa Selatan',
};

test('the same earthquake keeps one identity when it moves from the latest report to the list', () => {
  // "-7.90,108.90" on the latest report, "-7.9,108.9" once rebuilt from the list's numbers.
  assert.equal(quakeKey(MAINSHOCK), quakeKey({ DateTime: MAINSHOCK.DateTime, Coordinates: '-7.9,108.9' }));
  assert.equal(quakeKey(MAINSHOCK), quakeKey({ DateTime: '2026-11-16T09:00:00+07:00', Coordinates: ' -7.90, 108.90 ' }));

  const seen = updateTsunamiNotice(null, MAINSHOCK, [], ORIGIN + 3 * MINUTE);
  assert.ok(seen);
  const acknowledged = acknowledgeNotice(seen);
  const moved = updateTsunamiNotice(acknowledged, AFTERSHOCK, [MAINSHOCK_LISTED], ORIGIN + 10 * MINUTE);
  assert.ok(moved);
  // Not a new warning: the operator's record and the first-seen time survive.
  assert.equal(moved.key, seen.key);
  assert.equal(moved.status, 'acknowledged');
  assert.equal(moved.firstSeenMs, ORIGIN + 3 * MINUTE);
});

test('revised parameters do not turn one earthquake into a second warning', () => {
  const revised: BMKGGempaDetail = {
    ...MAINSHOCK,
    DateTime: new Date(ORIGIN + 20_000).toISOString(),
    Coordinates: '-7.96,108.84',
    Magnitude: '7.2',
  };
  assert.equal(isSameQuake(MAINSHOCK, revised), true);
  assert.equal(isSameQuake(MAINSHOCK, AFTERSHOCK), false);
  assert.equal(isSameQuake(MAINSHOCK, { ...MAINSHOCK, Coordinates: '-3.10,101.20' }), false);

  const seen = updateTsunamiNotice(null, MAINSHOCK, [], ORIGIN + 3 * MINUTE);
  const updated = updateTsunamiNotice(seen, revised, [], ORIGIN + 6 * MINUTE);
  assert.ok(seen && updated);
  assert.equal(updated.key, seen.key);
  assert.equal(updated.firstSeenMs, seen.firstSeenMs);
  // The card shows BMKG's current parameters.
  assert.equal(updated.quake.Magnitude, '7.2');
});

test('a statement older than a day is history even while BMKG still lists the earthquake', () => {
  const longAfter = ORIGIN + NOTICE_RETIRE_MS + MINUTE;
  // A fresh page load must not re-create the card from a weeks-old list entry.
  assert.equal(updateTsunamiNotice(null, AFTERSHOCK, [MAINSHOCK_LISTED], longAfter), null);
  assert.equal(updateTsunamiNotice(null, MAINSHOCK, [], longAfter), null);

  const seen = updateTsunamiNotice(null, MAINSHOCK, [], ORIGIN + 3 * MINUTE);
  assert.equal(updateTsunamiNotice(seen, AFTERSHOCK, [MAINSHOCK_LISTED], longAfter), null);
});

test('"last seen on the feed" is the payload\'s fetch time, not the clock tick', () => {
  const seen = updateTsunamiNotice(null, MAINSHOCK, [], ORIGIN + 3 * MINUTE, ORIGIN + 3 * MINUTE);
  // Polls fail for ten minutes; the page keeps handing over the payload it fetched at +3.
  const ticking = updateTsunamiNotice(seen, MAINSHOCK, [], ORIGIN + 13 * MINUTE, ORIGIN + 3 * MINUTE);
  assert.ok(ticking);
  assert.equal(ticking.lastSeenMs, ORIGIN + 3 * MINUTE);
  assert.equal(ticking.status, 'active');
  // A fresh payload advances it; a fetch time ahead of the clock is clamped.
  assert.equal(updateTsunamiNotice(ticking, MAINSHOCK, [], ORIGIN + 14 * MINUTE, ORIGIN + 14 * MINUTE)?.lastSeenMs, ORIGIN + 14 * MINUTE);
  assert.equal(updateTsunamiNotice(null, MAINSHOCK, [], ORIGIN + 5 * MINUTE, ORIGIN + 9 * MINUTE)?.lastSeenMs, ORIGIN + 5 * MINUTE);
});

test('a payload with no real BMKG record is an outage, not the feed moving on', () => {
  const seen = updateTsunamiNotice(null, MAINSHOCK, [], ORIGIN + 3 * MINUTE);
  assert.ok(seen);
  const placeholder: BMKGGempaDetail = { ...AFTERSHOCK, seeded: true };
  const seededList: SeismicEvent[] = [{ ...MAINSHOCK_LISTED, potensi: undefined, seeded: true }];

  const duringOutage = updateTsunamiNotice(seen, placeholder, seededList, ORIGIN + 10 * MINUTE);
  assert.equal(duringOutage?.status, 'active');
  assert.equal(duringOutage?.lastSeenMs, ORIGIN + 3 * MINUTE);
  assert.equal(updateTsunamiNotice(seen, null, [], ORIGIN + 10 * MINUTE)?.status, 'active');

  // Time still passes during an outage: the hold period and the retire window apply.
  assert.equal(updateTsunamiNotice(seen, null, [], ORIGIN + NOTICE_HOLD_MS + MINUTE)?.status, 'expired');
  assert.equal(updateTsunamiNotice(seen, null, [], ORIGIN + NOTICE_RETIRE_MS + MINUTE), null);
});

test('BMKG\'s termination text outranks the original statement still on the list, and stays', () => {
  const seen = updateTsunamiNotice(null, MAINSHOCK, [MAINSHOCK_LISTED], ORIGIN + 3 * MINUTE);
  const termination: BMKGGempaDetail = { ...MAINSHOCK, Potensi: 'Peringatan dini tsunami dinyatakan telah berakhir' };
  const ended = updateTsunamiNotice(seen, termination, [MAINSHOCK_LISTED], ORIGIN + 130 * MINUTE);
  assert.equal(ended?.status, 'ended');

  // The feed then moves on to an aftershock while the list keeps the old text.
  const later = updateTsunamiNotice(ended, AFTERSHOCK, [MAINSHOCK_LISTED], ORIGIN + 140 * MINUTE);
  assert.equal(later?.status, 'ended');
  assert.equal(isNoticeInForce(later), false);
});

test('findTsunamiStatement reads the list as well as the latest report, within the hold period', () => {
  const now = ORIGIN + 10 * MINUTE;
  assert.equal(findTsunamiStatement(MAINSHOCK, [], now)?.Magnitude, '7.4');
  // An aftershock is now the latest report; the mainshock's statement is only on the list.
  const fromList = findTsunamiStatement(AFTERSHOCK, [MAINSHOCK_LISTED], now);
  assert.equal(fromList?.Magnitude, '7.4');
  assert.equal(fromList?.Potensi, MAINSHOCK_LISTED.potensi);

  assert.equal(findTsunamiStatement(AFTERSHOCK, [], now), null);
  assert.equal(findTsunamiStatement({ ...MAINSHOCK, seeded: true }, [{ ...MAINSHOCK_LISTED, seeded: true }], now), null);
  assert.equal(findTsunamiStatement(null, undefined, now), null);

  // Past the hold period a caller without a latch stops treating it as in force…
  const late = ORIGIN + NOTICE_HOLD_MS + MINUTE;
  assert.equal(findTsunamiStatement(MAINSHOCK, [MAINSHOCK_LISTED], late), null);
  // …unless it asks for a longer window.
  assert.equal(findTsunamiStatement(MAINSHOCK, [], late, NOTICE_RETIRE_MS)?.Magnitude, '7.4');

  // BMKG's termination on the latest report closes the statement on the list too.
  const termination: BMKGGempaDetail = { ...MAINSHOCK, Potensi: 'Peringatan dini tsunami dinyatakan telah berakhir' };
  assert.equal(findTsunamiStatement(termination, [MAINSHOCK_LISTED], now), null);
});
