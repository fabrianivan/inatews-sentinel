import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DRILL_PHASE_NUMBER,
  DRILL_PHASES,
  DRILL_SCENARIOS,
  PD1_LATENCY_MIN,
  findDrillPhase,
  findDrillScenario,
  formatApproxMinutes,
  nextArrival,
  nextDrillPhaseNumber,
  scenarioOriginMs,
  scenarioSeconds,
  warningLeadMin,
  zoneArrivals,
} from '../drillScenarios';
import { applyTsunamiToStations, SEEDED_IOC_STATIONS } from '../telemetry';
import type { TsunamiScenario } from '../types';

test('scenario summary fields are derived from the zone table and cannot disagree with it', () => {
  assert.equal(DRILL_SCENARIOS.length, 4);
  for (const scenario of DRILL_SCENARIOS) {
    assert.ok(scenario.zones.length >= 4, `${scenario.id} needs at least four coastal zones`);
    const etas = scenario.zones.map((zone) => zone.etaMin);
    const heights = scenario.zones.map((zone) => zone.heightM);

    assert.deepEqual(etas, [...etas].sort((a, b) => a - b), `${scenario.id} zones are in arrival order`);
    assert.equal(scenario.evacuationWindowMin, Math.min(...etas));
    assert.equal(scenario.tsunamiHeight, Math.max(...heights));
    assert.deepEqual(scenario.affectedZones, scenario.zones.map((zone) => zone.name));
    assert.equal(new Set(scenario.affectedZones).size, scenario.zones.length, `${scenario.id} zone names are unique`);

    for (const zone of scenario.zones) {
      assert.ok(zone.etaMin > 0 && zone.heightM > 0, `${zone.name} has a positive ETA and height`);
      assert.ok(zone.lat > -12 && zone.lat < 7 && zone.lon > 94 && zone.lon < 142, `${zone.name} is inside Indonesia`);
    }
  }
});

test('every scenario still drives at least one tide gauge in the ocean panel', () => {
  // applyTsunamiToStations matches station keywords against the zone names, so renaming a zone
  // can silently leave the drill with no gauge reacting.
  for (const scenario of DRILL_SCENARIOS) {
    const tsunami: TsunamiScenario = {
      active: true,
      detection_time: '2026-11-16T03:00:00Z',
      sensor_id: scenario.sensorId,
      wave_anomaly: scenario.tsunamiHeight,
      affected_zones: scenario.affectedZones,
      response_actions: [],
      severity: 'CRITICAL',
      timestamp: '2026-11-16T03:00:00Z',
    };
    const reacting = applyTsunamiToStations(SEEDED_IOC_STATIONS, tsunami).filter((station) => station.isAnomaly);
    assert.ok(reacting.length > 0, `${scenario.id} reaches no seeded tide gauge`);
  }
});

test('phases follow the official warning sequence in scenario time', () => {
  assert.deepEqual(
    DRILL_PHASES.map((phase) => phase.phaseName),
    ['KONDISI_LATAR', 'GEMPA_UTAMA', 'PD1', 'PD2', 'PD3', 'PD4']
  );
  assert.deepEqual(DRILL_PHASES.map((phase) => phase.phaseNumber), [1, 2, 3, 4, 5, 6]);
  const offsets = DRILL_PHASES.map((phase) => phase.tPlusMin);
  assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b));
  assert.deepEqual(
    DRILL_PHASES.map((phase) => phase.bulletin),
    [null, null, 'PD-1', 'PD-2', 'PD-3', 'PD-4']
  );

  for (const phase of DRILL_PHASES) {
    // Nothing tsunami-related can be on screen before the mainshock.
    if (!phase.mainshockOccurred) {
      assert.equal(phase.tsunamiActive, false, phase.phaseName);
      assert.ok(phase.tPlusMin < 0, phase.phaseName);
    }
  }
  assert.equal(findDrillPhase(2).tPlusMin, 0);
  assert.equal(findDrillPhase(3).tPlusMin, PD1_LATENCY_MIN);
  // The threat is in force from the mainshock and is only ended by PD-4.
  assert.deepEqual(
    DRILL_PHASES.map((phase) => phase.tsunamiActive),
    [false, true, true, true, true, false]
  );
});

test('lookups fall back to the defaults, and the last phase wraps to the first', () => {
  assert.equal(findDrillScenario('mentawai').id, 'mentawai');
  assert.equal(findDrillScenario('does-not-exist').id, 'sunda-strait');
  assert.equal(findDrillScenario(null).id, 'sunda-strait');
  assert.equal(findDrillPhase(99).phaseNumber, DEFAULT_DRILL_PHASE_NUMBER);
  assert.equal(findDrillPhase(DEFAULT_DRILL_PHASE_NUMBER).bulletin, 'PD-1');
  assert.equal(nextDrillPhaseNumber(1), 2);
  assert.equal(nextDrillPhaseNumber(6), 1);
});

test('the scenario clock anchors T0 from the phase offset and never runs into the next phase', () => {
  const enteredAt = Date.parse('2026-11-16T03:00:00Z');
  const pd1 = findDrillPhase(3); // starts at T+03:00
  assert.equal(scenarioOriginMs(pd1, enteredAt), enteredAt - 3 * 60_000);
  // Before the mainshock T0 lies in the future.
  assert.equal(scenarioOriginMs(findDrillPhase(1), enteredAt), enteredAt + 10 * 60_000);

  assert.equal(scenarioSeconds(pd1, enteredAt, enteredAt), 180);
  assert.equal(scenarioSeconds(pd1, enteredAt, enteredAt + 72_000), 252);
  // PD-2 starts at T+10:00, so PD-1 left running stops at T+09:59.
  assert.equal(scenarioSeconds(pd1, enteredAt, enteredAt + 3_600_000), 599);
  // The background phase stops one second before the mainshock.
  assert.equal(scenarioSeconds(findDrillPhase(1), enteredAt, enteredAt + 3_600_000), -1);
  // The last phase has no upper bound; a clock set back never goes below the phase start.
  assert.equal(scenarioSeconds(findDrillPhase(6), enteredAt, enteredAt + 60_000), 180 * 60 + 60);
  assert.equal(scenarioSeconds(pd1, enteredAt, enteredAt - 5_000), 180);
});

test('zone estimates count down in scenario time and are marked passed, not "arrived and over"', () => {
  const sunda = findDrillScenario('sunda-strait');

  const atPd1 = zoneArrivals(sunda.zones, 180);
  assert.equal(atPd1[0].zone.name, 'Ujung Kulon, Pandeglang');
  assert.equal(atPd1[0].remainingMs, 4 * 60_000); // ETA 7 min, 3 min elapsed
  assert.equal(atPd1[0].passed, false);
  assert.equal(nextArrival(atPd1)?.zone.name, 'Ujung Kulon, Pandeglang');

  const atPd2 = zoneArrivals(sunda.zones, 600);
  assert.equal(atPd2[0].passed, true);
  assert.equal(nextArrival(atPd2)?.zone.name, 'Kalianda, Lampung Selatan');

  const atPd4 = zoneArrivals(sunda.zones, 180 * 60);
  assert.ok(atPd4.every((arrival) => arrival.passed));
  assert.equal(nextArrival(atPd4), null);
});

test('the official warning barely beats — or misses — the first wave', () => {
  assert.deepEqual(
    DRILL_SCENARIOS.map((scenario) => [scenario.id, warningLeadMin(scenario)]),
    [
      ['sunda-strait', 4],
      ['south-java', 16],
      ['mentawai', 6],
      ['palu-koro', 1],
    ]
  );
  // Near-field case: the nearest coast is reached about when PD-1 goes out.
  const palu = findDrillScenario('palu-koro');
  assert.ok(palu.evacuationWindowMin <= 5);
  const atPd1 = zoneArrivals(palu.zones, PD1_LATENCY_MIN * 60);
  assert.equal(atPd1[0].remainingMs, 60_000);
});

test('estimates are worded in whole minutes, never as a seconds countdown', () => {
  assert.equal(formatApproxMinutes(4 * 60_000), '≈ 4 mnt');
  assert.equal(formatApproxMinutes(3 * 60_000 + 1), '≈ 4 mnt');
  assert.equal(formatApproxMinutes(59_000), '< 1 mnt');
  assert.equal(formatApproxMinutes(0), 'terlampaui');
  assert.equal(formatApproxMinutes(-90_000), 'terlampaui');
  assert.equal(formatApproxMinutes(Number.NaN), 'terlampaui');
});
