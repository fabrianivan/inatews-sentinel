import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTone, TONE_SILENT, type ToneMemory, type ToneSituation } from '../alertTone';

const HOUR = 3_600_000;
const T0 = Date.parse('2026-11-16T02:00:00Z');

const attention = (rank: number, eventMs = 0, known = true): ToneSituation => ({
  known,
  rank,
  identity: 'attention',
  eventMs,
});
const notice = (key: string): ToneSituation => ({ known: true, rank: 2, identity: `notice:${key}`, eventMs: 0 });

/** Feeds a sequence of situations and returns which of them sounded. */
function run(situations: ToneSituation[], start: ToneMemory = TONE_SILENT): boolean[] {
  let memory = start;
  return situations.map((situation) => {
    const step = advanceTone(memory, situation);
    memory = step.memory;
    return step.play;
  });
}

test('the tone sounds once when the level reaches TINGGI, not on every poll', () => {
  assert.deepEqual(run([attention(0), attention(1, T0), attention(1, T0), attention(1, T0)]), [false, true, false, false]);
});

test('a failed poll that recovers on the same earthquake does not sound again', () => {
  const unknown = attention(0, 0, false);
  assert.deepEqual(run([attention(1, T0), unknown, unknown, attention(1, T0)]), [true, false, false, false]);
  // Loading at start-up is the same "unknown": the first known reading still sounds.
  assert.deepEqual(run([unknown, attention(1, T0)]), [false, true]);
});

test('a warning ending is not an alert', () => {
  // The operator records that BMKG ended the warning while the earthquake is still inside 24 hours.
  assert.deepEqual(run([notice('a'), attention(1, T0)]), [true, false]);
  // The level easing a step, then returning to routine, stays silent too.
  assert.deepEqual(run([attention(1, T0), attention(0), attention(0)]), [true, false, false]);
});

test('a newer event at the same level, or a different warning, sounds again', () => {
  assert.deepEqual(run([attention(1, T0), attention(1, T0 + HOUR)]), [true, true]);
  // The newest event leaving the feed is not a new event.
  assert.deepEqual(run([attention(1, T0 + HOUR), attention(1, T0)]), [true, false]);
  assert.deepEqual(run([notice('a'), notice('a'), notice('b')]), [true, false, true]);
  // After easing, the next escalation sounds.
  assert.deepEqual(run([attention(1, T0), attention(0), attention(1, T0 + 5 * HOUR)]), [true, false, true]);
});

test('a statement outranks the attention level', () => {
  assert.deepEqual(run([attention(1, T0), notice('a')]), [true, true]);
});
