import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acknowledgeNotice,
  isNoticeInForce,
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
