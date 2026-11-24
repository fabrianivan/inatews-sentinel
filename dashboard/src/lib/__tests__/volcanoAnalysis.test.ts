import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveIllustrativeAnalysis, parseReportNumber } from '../volcanoAnalysis';

test('report values are read as numbers, and an absent value stays absent', () => {
  assert.equal(parseReportNumber('34 mm'), 34);
  assert.equal(parseReportNumber('55.54 detik'), 55.54);
  assert.equal(parseReportNumber('22,5 mm'), 22.5);
  assert.equal(parseReportNumber('—'), null);
  assert.equal(parseReportNumber(''), null);
  assert.equal(parseReportNumber(undefined), null);
  assert.equal(parseReportNumber('0 mm'), null);
});

test('estimates are arithmetic on the two report values, in Indonesian number format', () => {
  const analysis = deriveIllustrativeAnalysis({ volcano_name: 'Dukono', amplitude: '34 mm', duration: '55.54 detik' });
  assert.ok(analysis);
  assert.equal(analysis.amplitudeMm, 34);
  assert.equal(analysis.durationSec, 55.54);
  assert.equal(analysis.estimatedPga, '0,109 g');
  assert.equal(analysis.rsamCounts, Math.round(34 * 115 + 55.54 * 12));
  assert.equal(analysis.dominantFrequency, '2,0–3,5 Hz');
  assert.equal(analysis.signalType, 'Gempa letusan sedang (tremor letusan)');
  assert.match(analysis.interpretation, /^Amplitudo 34 mm dengan durasi 55,5 detik lazimnya/);
  assert.match(analysis.interpretation, /rujuk laporan PVMBG\.$/);

  const strong = deriveIllustrativeAnalysis({ volcano_name: 'Semeru', amplitude: '45 mm', duration: '120 detik' });
  assert.equal(strong?.signalType, 'Gempa letusan kuat (tremor eksplosif berenergi tinggi)');
  assert.equal(strong?.dominantFrequency, '1,4–2,2 Hz');
  assert.match(strong?.interpretation ?? '', /konduit kawah G\. Semeru/);

  const weak = deriveIllustrativeAnalysis({ volcano_name: 'Ibu', amplitude: '12 mm', duration: '30 detik' });
  assert.equal(weak?.signalType, 'Gempa hembusan / vulkanik dangkal (VB)');
});

test('a report without an amplitude or a duration gets no estimates — nothing is assumed', () => {
  assert.equal(deriveIllustrativeAnalysis({ volcano_name: 'Semeru', amplitude: '—', duration: '—' }), null);
  assert.equal(deriveIllustrativeAnalysis({ volcano_name: 'Semeru', amplitude: '22 mm', duration: '—' }), null);
  assert.equal(deriveIllustrativeAnalysis({ volcano_name: 'Semeru', amplitude: '', duration: '110 detik' }), null);
});

test('at exactly 40 mm every strong-signal value agrees', () => {
  const analysis = deriveIllustrativeAnalysis({ volcano_name: 'Semeru', amplitude: '40 mm', duration: '90 detik' });
  assert.equal(analysis?.signalType, 'Gempa letusan kuat (tremor eksplosif berenergi tinggi)');
  assert.equal(analysis?.dominantFrequency, '1,4–2,2 Hz');
  assert.match(analysis?.interpretation ?? '', /\(1,4–2,2 Hz\)/);
});
