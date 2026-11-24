import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAge,
  formatClockStamp,
  formatCountdown,
  formatDecimal,
  formatDuration,
  formatRowStamp,
  formatScenarioClock,
  formatTPlus,
  formatUtcTime,
  formatWibDate,
  formatWibDateTime,
  formatWibTime,
  hoursBetween,
  toDate,
  toMillis,
} from '../time';

const ORIGIN = '2026-11-16T06:21:30Z'; // 13:21:30 WIB

test('wall-clock strings are pinned to WIB with colons, whatever the host zone is', () => {
  assert.equal(formatWibTime(ORIGIN), '13:21:30 WIB');
  assert.equal(formatWibTime(ORIGIN, { seconds: false }), '13:21 WIB');
  assert.equal(formatUtcTime(ORIGIN), '06:21:30 UTC');
  // 17:30 UTC is already the next calendar day in Jakarta, and midnight must read 00, not 24.
  assert.equal(formatWibTime('2026-11-16T17:00:05Z'), '00:00:05 WIB');
  assert.equal(formatWibDate('2026-11-16T17:30:00Z'), '17 Nov 2026');
  assert.equal(formatWibDateTime(ORIGIN), '16 Nov 2026, 13:21 WIB');
});

test('unusable timestamps render placeholders instead of "Invalid Date"', () => {
  assert.equal(toDate('not a date'), null);
  assert.equal(toDate(''), null);
  assert.equal(toMillis(undefined), null);
  assert.equal(formatWibTime(null), '--:--:-- WIB');
  assert.equal(formatWibTime('nope', { seconds: false }), '--:-- WIB');
  assert.equal(formatUtcTime(undefined), '--:--:-- UTC');
  assert.equal(formatWibDate('nope'), '—');
  assert.equal(formatAge('nope', ORIGIN), '—');
  assert.equal(formatTPlus(null, ORIGIN), 'T+ --:--:--');
});

test('formatAge steps through seconds, minutes, hours and days', () => {
  const at = (offsetMs: number) => new Date(Date.parse(ORIGIN) + offsetMs);
  assert.equal(formatAge(ORIGIN, at(4_000)), 'baru saja');
  assert.equal(formatAge(ORIGIN, at(40_000)), '40 dtk lalu');
  assert.equal(formatAge(ORIGIN, at(12 * 60_000 + 59_000)), '12 mnt lalu');
  assert.equal(formatAge(ORIGIN, at(3 * 3_600_000 + 10)), '3 jam lalu');
  assert.equal(formatAge(ORIGIN, at(5 * 86_400_000 + 3_600_000)), '5 hari lalu');
  // A feed timestamp slightly ahead of the browser clock is "just now", never a negative age.
  assert.equal(formatAge(ORIGIN, at(-30_000)), 'baru saja');
});

test('formatTPlus runs as a clock for a day, then switches to days and hours', () => {
  const at = (offsetMs: number) => new Date(Date.parse(ORIGIN) + offsetMs);
  assert.equal(formatTPlus(ORIGIN, at(0)), 'T+ 00:00:00');
  assert.equal(formatTPlus(ORIGIN, at(12 * 60_000 + 34_000)), 'T+ 00:12:34');
  assert.equal(formatTPlus(ORIGIN, at(23 * 3_600_000 + 59 * 60_000 + 59_000)), 'T+ 23:59:59');
  assert.equal(formatTPlus(ORIGIN, at(3 * 86_400_000 + 4 * 3_600_000)), 'T+ 3 hari 4 jam');
  assert.equal(formatTPlus(ORIGIN, at(2 * 86_400_000 + 20 * 60_000)), 'T+ 2 hari');
  assert.equal(formatTPlus(ORIGIN, at(-5_000)), 'T+ 00:00:00');
});

test('durations and countdowns never go negative', () => {
  assert.equal(formatDuration(0), '00:00:00');
  assert.equal(formatDuration(3_725_000), '01:02:05');
  assert.equal(formatDuration(-1), '00:00:00');
  assert.equal(formatDuration(Number.NaN), '00:00:00');
  assert.equal(formatCountdown(118_000), '01:58');
  // A countdown shows the second it is still inside: 0.2 s left reads 00:01, not 00:00.
  assert.equal(formatCountdown(200), '00:01');
  assert.equal(formatCountdown(0), '00:00');
  assert.equal(formatCountdown(-9_000), '00:00');
  assert.equal(formatCountdown(3_600_000 + 61_000), '1:01:01');
});

test('formatScenarioClock is signed around the mainshock', () => {
  assert.equal(formatScenarioClock(-300), 'T−05:00');
  assert.equal(formatScenarioClock(-0.4), 'T−00:01');
  assert.equal(formatScenarioClock(0), 'T+00:00');
  assert.equal(formatScenarioClock(492.9), 'T+08:12');
  assert.equal(formatScenarioClock(7200), 'T+2:00:00');
  assert.equal(formatScenarioClock(Number.NaN), 'T+00:00');
});

test('hoursBetween is fractional and clamps reversed or unusable ranges to zero', () => {
  assert.equal(hoursBetween(ORIGIN, '2026-11-16T09:51:30Z'), 3.5);
  assert.equal(hoursBetween('2026-11-16T09:51:30Z', ORIGIN), 0);
  assert.equal(hoursBetween('nope', ORIGIN), 0);
});

test('a timestamp without a zone is read as UTC, not as the host zone', () => {
  // IOC publishes "2026-11-16 01:00:00" meaning UTC; 01:00 UTC is 08:00 in Jakarta.
  assert.equal(toMillis('2026-11-16 01:00:00'), Date.parse('2026-11-16T01:00:00Z'));
  assert.equal(formatWibTime('2026-11-16 01:00:00'), '08:00:00 WIB');
  assert.equal(toMillis('2026-11-16T01:00'), Date.parse('2026-11-16T01:00:00Z'));
  // An explicit offset is honoured as written.
  assert.equal(toMillis('2026-11-16T08:00:00+07:00'), Date.parse('2026-11-16T01:00:00Z'));
});

test('dates use fixed Indonesian month abbreviations', () => {
  assert.equal(formatWibDate('2026-05-03T03:00:00Z'), '03 Mei 2026');
  assert.equal(formatWibDate('2026-08-17T03:00:00Z'), '17 Agu 2026');
  assert.equal(formatWibDate('2026-10-28T03:00:00Z', { year: false }), '28 Okt');
});

test('row stamps carry an age within a day and a date beyond it', () => {
  const now = '2026-11-16T10:21:30Z';
  assert.equal(formatRowStamp('2026-11-16T07:05:00Z', now), '3 jam lalu · 14:05 WIB');
  assert.equal(formatRowStamp('2026-11-04T07:05:00Z', now), '04 Nov · 14:05 WIB');
  assert.equal(formatRowStamp('nope', now), '—');
});

test('clock stamps stay short for today and gain a date beyond a day', () => {
  const now = '2026-11-16T10:21:30Z';
  assert.equal(formatClockStamp('2026-11-16T07:05:00Z', now), '14:05 WIB');
  assert.equal(formatClockStamp('2026-11-04T07:05:00Z', now), '04 Nov · 14:05 WIB');
  // Without a reference time (before mount) only the clock is shown.
  assert.equal(formatClockStamp('2026-11-04T07:05:00Z', null), '14:05 WIB');
  assert.equal(formatClockStamp('nope', now), '—');
});

test('display numbers use the Indonesian decimal comma', () => {
  assert.equal(formatDecimal(6.1), '6,1');
  assert.equal(formatDecimal(12, 1), '12,0');
  assert.equal(formatDecimal(0.48, 2), '0,48');
  assert.equal(formatDecimal(Number.NaN), '—');
});
