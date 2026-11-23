import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPotensi,
  depthClass,
  isTsunamiPotential,
  isTsunamiTermination,
  maxTone,
  officialTone,
  parseDirasakanMaxMmi,
  parseVolcanoLevel,
  toneFromMagnitude,
  toneRank,
  toTone,
  tsunamiLevelFromHeight,
  TONE_LABEL,
  TSUNAMI_LEVEL_ADVICE,
  type Tone,
} from '../severity';

test('every source vocabulary found in the codebase maps onto one tone', () => {
  const table: Array<[string, Tone]> = [
    // Status payload / AI engine (English scale)
    ['NORMAL', 'rutin'],
    ['ADVISORY', 'rutin'],
    ['ELEVATED', 'meningkat'],
    ['HIGH', 'tinggi'],
    ['CRITICAL', 'kritis'],
    // Live event severity
    ['LOW', 'rutin'],
    ['MEDIUM', 'meningkat'],
    // Agency priority
    ['STANDBY', 'rutin'],
    ['URGENT', 'tinggi'],
    ['IMMEDIATE', 'kritis'],
    // Drill presets, PVMBG wording, station state
    ['WASPADA', 'meningkat'],
    ['LEVEL III (SIAGA)', 'tinggi'],
    ['Level IV (Awas)', 'kritis'],
    ['LEVEL I (NORMAL)', 'rutin'],
    ['OPERATIONAL', 'rutin'],
    ['stable', 'rutin'],
  ];
  for (const [raw, expected] of table) {
    assert.equal(toTone(raw), expected, `toTone(${JSON.stringify(raw)})`);
  }
});

test('the mapping is total: unrecognised values are unknown, never routine', () => {
  for (const raw of ['', null, undefined, 'MONITORING', 'SPIKE', 'TSUNAMI ALERT', 'BMKG LIVE TELEMETRY', 'UNKNOWN']) {
    assert.equal(toTone(raw), 'unknown', `toTone(${JSON.stringify(raw)})`);
  }
  // Whole-word matching: "HIGHLIGHT" is not "HIGH".
  assert.equal(toTone('HIGHLIGHT'), 'unknown');
});

test('unknown outranks routine when tones are combined', () => {
  assert.equal(maxTone(), 'rutin');
  assert.equal(maxTone('rutin', 'unknown'), 'unknown');
  assert.equal(maxTone('unknown', 'meningkat'), 'meningkat');
  assert.equal(maxTone('tinggi', 'kritis', 'meningkat'), 'kritis');
  assert.ok(toneRank('kritis') > toneRank('tinggi'));
  assert.ok(toneRank('tinggi') > toneRank('meningkat'));
  assert.ok(toneRank('unknown') > toneRank('rutin'));
});

test('tone labels never reuse an official alert-level word', () => {
  const official = ['NORMAL', 'WASPADA', 'SIAGA', 'AWAS', 'AMAN'];
  for (const label of Object.values(TONE_LABEL)) {
    assert.ok(!official.includes(label), `${label} is an official word`);
  }
});

test('magnitude emphasis uses one set of tiers', () => {
  assert.equal(toneFromMagnitude(4.9), 'rutin');
  assert.equal(toneFromMagnitude(5.0), 'meningkat');
  assert.equal(toneFromMagnitude(6.0), 'tinggi');
  assert.equal(toneFromMagnitude(7.0), 'kritis');
  assert.equal(toneFromMagnitude(Number.NaN), 'unknown');
  assert.equal(toneFromMagnitude(0), 'unknown');
});

test('tsunami height maps to the InaTEWS warning levels at their boundaries', () => {
  assert.equal(tsunamiLevelFromHeight(0), null);
  assert.equal(tsunamiLevelFromHeight(Number.NaN), null);
  assert.equal(tsunamiLevelFromHeight(0.49), 'waspada');
  assert.equal(tsunamiLevelFromHeight(0.5), 'siaga');
  assert.equal(tsunamiLevelFromHeight(2.99), 'siaga');
  assert.equal(tsunamiLevelFromHeight(3.0), 'awas');
  assert.equal(officialTone('awas'), 'kritis');
  assert.equal(officialTone('normal'), 'rutin');
  assert.equal(TSUNAMI_LEVEL_ADVICE.awas, 'Evakuasi menyeluruh');
});

test('volcano levels are parsed, and an unreadable status is not turned into Level I', () => {
  assert.deepEqual(parseVolcanoLevel('LEVEL III (SIAGA)'), {
    level: 'siaga',
    roman: 'III',
    label: 'Level III · Siaga',
  });
  assert.equal(parseVolcanoLevel('LEVEL IV (AWAS)')?.roman, 'IV');
  assert.equal(parseVolcanoLevel('Level II')?.level, 'waspada');
  assert.equal(parseVolcanoLevel('Waspada')?.roman, 'II');
  assert.equal(parseVolcanoLevel('LEVEL I (NORMAL)')?.level, 'normal');
  assert.equal(parseVolcanoLevel(''), null);
  assert.equal(parseVolcanoLevel('tidak ada data'), null);
});

test('tsunami potential is read from BMKG free text without being silenced by a stray "tidak"', () => {
  assert.equal(isTsunamiPotential('Peringatan dini berpotensi TSUNAMI untuk wilayah Jawa Selatan'), true);
  assert.equal(isTsunamiPotential('Tidak berpotensi tsunami'), false);
  assert.equal(isTsunamiPotential('Gempa ini dirasakan untuk diteruskan pada masyarakat'), false);
  assert.equal(isTsunamiPotential(''), false);
  assert.equal(isTsunamiPotential(null), false);
  // A later, unrelated "tidak" must not cancel the warning.
  assert.equal(isTsunamiPotential('Berpotensi tsunami. Tidak ada laporan kerusakan.'), true);
  // A termination notice is not a statement of potential.
  assert.equal(isTsunamiPotential('Peringatan dini berpotensi tsunami dinyatakan telah berakhir'), false);
  assert.equal(isTsunamiTermination('Peringatan Dini Tsunami dinyatakan telah berakhir'), true);
  assert.equal(isTsunamiTermination('Gempa susulan berakhir'), false);
});

test('classifyPotensi separates the kinds of BMKG remark', () => {
  assert.equal(classifyPotensi('Berpotensi TSUNAMI untuk diteruskan pada masyarakat'), 'tsunami');
  assert.equal(classifyPotensi('Peringatan dini tsunami telah berakhir'), 'ended');
  assert.equal(classifyPotensi('Tidak berpotensi tsunami'), 'no-tsunami');
  assert.equal(classifyPotensi('Gempa ini dirasakan untuk diteruskan pada masyarakat'), 'other');
  // Mentions tsunami but fits no known form: the UI must say "periksa BMKG", not "no tsunami".
  assert.equal(classifyPotensi('Informasi tsunami menyusul'), 'unclear');
  assert.equal(classifyPotensi('   '), 'empty');
  assert.equal(classifyPotensi(undefined), 'empty');
});

test('the highest felt intensity is read from the Dirasakan text', () => {
  assert.equal(parseDirasakanMaxMmi('III Tanggamus'), 3);
  assert.equal(parseDirasakanMaxMmi('II-III Kupang, IV Soe'), 4);
  assert.equal(parseDirasakanMaxMmi('VII Aesesa, VI Bajawa, V Ende'), 7);
  assert.equal(parseDirasakanMaxMmi('II Tahuna'), 2);
  assert.equal(parseDirasakanMaxMmi('-'), null);
  assert.equal(parseDirasakanMaxMmi(''), null);
  assert.equal(parseDirasakanMaxMmi(undefined), null);
  // "MMI" itself is not a numeral.
  assert.equal(parseDirasakanMaxMmi('Skala MMI belum tersedia'), null);
});

test('depth classes follow the BMKG boundaries', () => {
  assert.equal(depthClass(10), 'dangkal');
  assert.equal(depthClass(60), 'menengah');
  assert.equal(depthClass(300), 'menengah');
  assert.equal(depthClass(323), 'dalam');
});
