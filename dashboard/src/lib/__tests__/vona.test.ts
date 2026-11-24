import test from 'node:test';
import assert from 'node:assert/strict';
import { INDONESIAN_VOLCANOES } from '../volcanoData';
import {
  VONA_MAP_WINDOW_MS,
  catalogueVolcanoForVona,
  latestVonaFor,
  parseVonaDirection,
  parseVonaPage,
  readVonaText,
  vonaArchiveUrl,
  vonaCodeFor,
  vonaMapArrow,
  vonaReadState,
  type VonaNotice,
} from '../vona';

/** A button of MAGMA's per-volcano list, as the VONA page writes it. */
function codeButton(code: string, label: string): string {
  return `<a href="https://magma.esdm.go.id/v1/vona?code=${code}" type="button" class="btn btn-sm btn-primary mg-b-10">${label}</a>`;
}

function dayHeader(label: string): string {
  return `<div class="timeline-item timeline-day">
                    <div class="timeline-time">&nbsp;</div>
                    <div class="timeline-body">
                        <p class="timeline-date">${label}</p>
                    </div>
                </div>`;
}

/** One notice, as MAGMA's VONA timeline writes it. */
function notice(fields: { utc: string; color: string; title: string; observatory: string; text: string; href: string }): string {
  const colorClass: Record<string, string> = { Green: 'btn-success', Yellow: 'bg-yellow', Orange: 'btn-warning', Red: 'btn-danger' };
  return `<div class="timeline-item">
                    <div class="timeline-time"><small>${fields.utc}</small>
                        <a href="#" class="btn btn-sm ${colorClass[fields.color] ?? 'btn-secondary'}">${fields.color}</a>
                    </div>
                    <div class="timeline-body">
                        <p class="timeline-title"><a href="#">${fields.title}</a></p>
                        <p class="timeline-author"><a href="#">Petugas Pos</a>, ${fields.observatory} - 16 hours ago
                        </p>
                        <p class="timeline-text">${fields.text}</p>
                        <a class="card-link m-b-10" href="${fields.href}">View</a>
                    </div>
                </div>`;
}

const SEMERU_TEXT = 'Eruption at 0130 UTC (0830 local). Ash-cloud is not observed. Ash-cloud is not observed..';
const DUKONO_TEXT =
  'Eruption with volcanic ash cloud at 0923 UTC (1823 local). Best estimate of ash-cloud top is around 6358 FT (1987 M) above sea level or 2880 FT (900 M) above summit. May be higher than what can be observed clearly. Source of height data: ground observer. Ash cloud moving to east. Volcanic ash is observed to be gray to dark. The intensity of volcanic ash is observed to be thick..';
const IBU_TEXT =
  'Eruption with volcanic ash cloud at 0712 UTC (1612 local). Best estimate of ash-cloud top is around 5520 FT (1725 M) above sea level or 1280 FT (400 M) above summit. May be higher than what can be observed clearly. Source of height data: ground observer. Ash cloud moving to southeast. Volcanic ash is observed to be gray. The intensity of volcanic ash is observed to be thick..';
const LEWOTOLOK_TEXT =
  'Eruption with volcanic ash cloud at 2101 UTC (0501 local). Best estimate of ash-cloud top is around 6154 FT (1923 M) above sea level or 1600 FT (500 M) above summit. May be higher than what can be observed clearly. Source of height data: ground observer. Ash cloud moving from west to northwest. Volcanic ash is observed to be white to gray. The intensity of volcanic ash is observed from medium to thick..';

const PAGE = [
  '<html><body><div class="card"><div class="card-body">',
  codeButton('AGU', 'Agung (138)'),
  codeButton('KRA', 'Anak Krakatau (612)'),
  codeButton('DUK', 'Dukono (1210)'),
  codeButton('IBU', 'Ibu (3088)'),
  codeButton('LEW', 'Ili Lewotolok (313)'),
  codeButton('LWK', 'Lewotobi Laki-laki (1569)'),
  codeButton('LWP', 'Lewotobi Perempuan (2)'),
  codeButton('MAR', 'Marapi (319)'),
  codeButton('MER', 'Merapi (73)'),
  codeButton('SMR', 'Semeru (10469)'),
  codeButton('SIN', 'Sinabung (1011)'),
  codeButton('SOR', 'Sorikmarapi (28)'),
  '</div></div>',
  '<div class="card pd-30"><div class="mg-b-30"><div class="ui pagination menu">',
  '<a class="btn btn-sm btn-outline-secondary mg-l-5" href="https://magma.esdm.go.id/v1/vona?page=2">2</a>',
  '</div></div><div class="timeline-group">',
  dayHeader('Today'),
  notice({
    utc: '2026-11-24 01:30:00 UTC',
    color: 'Orange',
    title: 'Semeru - 20261124/0130Z',
    observatory: 'Semeru Volcano Observatory',
    text: SEMERU_TEXT,
    href: 'https://magma.esdm.go.id/v1/vona/23288?signature=7cd06c9b5fb48316',
  }),
  dayHeader('23rd of November 2026, 1 day ago'),
  notice({
    utc: '2026-11-23 09:23:00 UTC',
    color: 'Orange',
    title: 'Dukono - 20261123/0923Z',
    observatory: 'Dukono Volcano Observatory',
    text: DUKONO_TEXT,
    href: 'https://magma.esdm.go.id/v1/vona/23282?signature=6a5ac66aadddefd3',
  }),
  notice({
    utc: '2026-11-23 07:12:00 UTC',
    color: 'Orange',
    title: 'Ibu - 20261123/0712Z',
    observatory: 'Ibu Volcano Observatory',
    text: IBU_TEXT,
    href: 'https://magma.esdm.go.id/v1/vona/23281?signature=14599ec78ef98005',
  }),
  dayHeader('22nd of November 2026, 2 days ago'),
  notice({
    utc: '2026-11-22 21:01:00 UTC',
    color: 'Orange',
    title: 'Ili Lewotolok - 20261122/2101Z',
    observatory: 'Ili Lewotolok Volcano Observatory',
    text: LEWOTOLOK_TEXT,
    href: 'https://magma.esdm.go.id/v1/vona/23270?signature=fdf96bf52f59b8e2',
  }),
  notice({
    utc: '2026-11-22 10:00:00 UTC',
    color: 'Yellow',
    title: 'Lewotobi Perempuan - 20261122/1000Z',
    observatory: 'Lewotobi Volcano Observatory',
    text: 'Increasing in volcanic activity. Ash-cloud is not observed. Ash-cloud is not observed..',
    href: 'https://magma.esdm.go.id/v1/vona/23260?signature=aa',
  }),
  notice({
    utc: '2026-11-22 07:35:00 UTC',
    color: 'Orange',
    title: 'Semeru - 20261122/0735Z',
    observatory: 'Semeru Volcano Observatory',
    text: 'Eruption with volcanic ash cloud at 0735 UTC (1435 local). Ash cloud moving to north-northeast.',
    href: 'https://magma.esdm.go.id/v1/vona/23259?signature=bb',
  }),
  notice({
    utc: '2026-11-21 13:07:00 UTC',
    color: 'Red',
    title: 'Krakatau - 20261121/1307Z',
    observatory: 'Anak Krakatau Volcano Observatory',
    text: 'Eruption with volcanic ash cloud at 1307 UTC (2007 local). Ash cloud moving from southwest, west to northwest.',
    href: 'https://magma.esdm.go.id/v1/vona/23250?signature=cc&amp;expires=1',
  }),
  notice({
    utc: '2026-11-20 02:49:00 UTC',
    color: 'Purple',
    title: 'Sinabung - 20261120/0249Z',
    observatory: 'Sinabung Volcano Observatory',
    text: 'Eruption with volcanic ash cloud at 0249 UTC (0949 local). Ash cloud moving to the summit.',
    href: 'https://example.test/v1/vona/999',
  }),
  '</div>',
  // The pagination below the list and the colour-code legend beside it follow the last notice.
  '<div class="mg-t-30"><div class="ui pagination menu"><a class="btn btn-sm btn-outline-secondary mg-l-5" href="https://magma.esdm.go.id/v1/vona?page=2">2</a></div></div>',
  '</div><div class="col-lg-3 mg-t-20 mg-lg-t-0"><div class="card"><div class="card-body">',
  '<h5 class="card-title">VONA Color Code</h5><button class="btn btn-sm btn-success mg-b-10">Green</button>',
  '<p class="card-text tx-thin">Volcano is in normal, non-eruptive state.</p>',
  '<button class="btn btn-sm btn-danger mg-b-10">Red</button><a href="https://example.test/">View</a>',
  '</div></div></div></body></html>',
].join('\n');

const NOW = Date.parse('2026-11-24T02:10:00Z');
const HOUR_MS = 60 * 60 * 1000;

function byVolcano(notices: VonaNotice[], title: string): VonaNotice {
  const found = notices.find((item) => item.volcano === title);
  assert.ok(found, `no notice for ${title}`);
  return found;
}

test('parseVonaPage reads each notice in page order and skips the day headers', () => {
  const { notices, volcanoes } = parseVonaPage(PAGE);
  assert.deepEqual(
    notices.map((item) => `${item.id}|${item.volcano}|${item.catalogue_name}`),
    [
      '23288|Semeru|Semeru',
      '23282|Dukono|Dukono',
      '23281|Ibu|Ibu',
      '23270|Ili Lewotolok|Ili Lewotolok',
      '23260|Lewotobi Perempuan|null',
      '23259|Semeru|Semeru',
      '23250|Krakatau|Anak Krakatau',
      'sinabung-202611200249|Sinabung|Sinabung',
    ]
  );
  assert.deepEqual(volcanoes.slice(0, 3), [
    { code: 'AGU', name: 'Agung' },
    { code: 'KRA', name: 'Anak Krakatau' },
    { code: 'DUK', name: 'Dukono' },
  ]);
  assert.equal(volcanoes.length, 12);
});

test('a notice keeps its official wording and states only what it says', () => {
  const { notices } = parseVonaPage(PAGE);

  const semeru = notices[0];
  assert.equal(semeru.issued_at, '2026-11-24T01:30:00.000Z');
  assert.equal(semeru.color_code, 'ORANGE');
  assert.equal(semeru.text, SEMERU_TEXT);
  assert.equal(semeru.ash_observed, false);
  assert.equal(semeru.ash_top_asl_m, null);
  assert.equal(semeru.ash_top_above_summit_m, null);
  assert.equal(semeru.ash_direction, null);
  assert.equal(semeru.observatory, 'Semeru Volcano Observatory');
  assert.equal(semeru.url, 'https://magma.esdm.go.id/v1/vona/23288?signature=7cd06c9b5fb48316');

  const dukono = byVolcano(notices, 'Dukono');
  assert.equal(dukono.text, DUKONO_TEXT);
  assert.equal(dukono.ash_observed, true);
  assert.equal(dukono.ash_top_asl_m, 1987);
  assert.equal(dukono.ash_top_above_summit_m, 900);
  assert.deepEqual(dukono.ash_direction, {
    sentence: 'Ash cloud moving to east.',
    phrase: 'east',
    label: 'timur',
    bearing: 90,
    bearings: [90],
  });

  const ibu = byVolcano(notices, 'Ibu');
  assert.equal(ibu.ash_direction?.label, 'tenggara');
  assert.equal(ibu.ash_direction?.bearing, 135);
  assert.equal(ibu.ash_top_asl_m, 1725);

  // Several directions: the list as MAGMA wrote it, and no single bearing invented from it.
  const lewotolok = byVolcano(notices, 'Ili Lewotolok');
  assert.deepEqual(lewotolok.ash_direction, {
    sentence: 'Ash cloud moving from west to northwest.',
    phrase: 'from west to northwest',
    label: 'barat hingga barat laut',
    bearing: null,
    bearings: [270, 315],
  });

  const perempuan = byVolcano(notices, 'Lewotobi Perempuan');
  assert.equal(perempuan.color_code, 'YELLOW');
  assert.equal(perempuan.ash_observed, false);

  const krakatau = byVolcano(notices, 'Krakatau');
  assert.equal(krakatau.color_code, 'RED');
  assert.equal(krakatau.url, 'https://magma.esdm.go.id/v1/vona/23250?signature=cc&expires=1');
  assert.equal(krakatau.ash_direction?.label, 'barat daya, barat hingga barat laut');
  assert.deepEqual(krakatau.ash_direction?.bearings, [225, 270, 315]);

  // An unknown colour word, a link off MAGMA and a direction that is not a compass point are not passed on as values.
  const sinabung = byVolcano(notices, 'Sinabung');
  assert.equal(sinabung.color_code, null);
  assert.equal(sinabung.url, null);
  assert.equal(sinabung.ash_observed, true);
  assert.deepEqual(sinabung.ash_direction, {
    sentence: 'Ash cloud moving to the summit.',
    phrase: 'summit',
    label: null,
    bearing: null,
    bearings: [],
  });
});

test('a page of another shape yields nothing rather than a guess', () => {
  assert.deepEqual(parseVonaPage(''), { notices: [], volcanoes: [] });
  assert.deepEqual(parseVonaPage('<html><body><p>Maintenance</p></body></html>'), { notices: [], volcanoes: [] });
  // A notice without a title names no volcano and is skipped.
  const untitled = '<div class="timeline-item"><div class="timeline-time"><small>2026-11-24 01:30:00 UTC</small></div><p class="timeline-text">Eruption.</p></div>';
  assert.deepEqual(parseVonaPage(untitled).notices, []);
});

test('a notice time comes from the page, or from its date-time group, never from the clock', () => {
  const fromTitle = parseVonaPage(
    notice({ utc: 'unknown', color: 'Orange', title: 'Ibu - 20261123/0712Z', observatory: 'Ibu Volcano Observatory', text: IBU_TEXT, href: '#' })
  ).notices[0];
  assert.equal(fromTitle.issued_at, '2026-11-23T07:12:00.000Z');
  assert.equal(fromTitle.id, 'ibu-202611230712');

  const noTime = parseVonaPage(
    notice({ utc: '2026-11-23 25:12:00 UTC', color: 'Orange', title: 'Ibu', observatory: 'Ibu Volcano Observatory', text: IBU_TEXT, href: '#' })
  ).notices[0];
  assert.equal(noTime.issued_at, null);
  assert.equal(noTime.id, 'ibu-tanpa-waktu');
});

test('parseVonaDirection renders compass points and leaves anything else as written', () => {
  const read = (phrase: string) => parseVonaDirection(`Ash cloud moving ${phrase}.`, phrase);
  assert.deepEqual(
    [read('to east'), read('to the north-northeast'), read('to West-Southwest'), read('to NW')].map((item) => [
      item.phrase,
      item.label,
      item.bearing,
    ]),
    [
      ['east', 'timur', 90],
      ['north-northeast', 'utara-timur laut', 22.5],
      ['West-Southwest', 'barat-barat daya', 247.5],
      ['NW', 'barat laut', 315],
    ]
  );
  assert.equal(read('from north to northwest').label, 'utara hingga barat laut');
  assert.deepEqual(read('from north to northwest').bearings, [0, 315]);
  assert.equal(read('to east and southeast').label, 'timur dan tenggara');
  assert.equal(read('to east and southeast').bearing, null);
  // "from east" alone would say where the cloud came from: no rendering, no bearing.
  assert.deepEqual(read('from east'), { sentence: 'Ash cloud moving from east.', phrase: 'from east', label: null, bearing: null, bearings: [] });
  assert.equal(read('toward the crater rim').label, null);
  assert.equal(read('vertically').label, null);
});

test('readVonaText settles nothing the notice leaves open', () => {
  assert.equal(readVonaText('Increasing in volcanic activity.').ash_observed, null);
  assert.equal(readVonaText('Eruption with volcanic ash cloud at 0101 UTC (0801 local). Ash-cloud is not observed.').ash_observed, null);
  const heightOnly = readVonaText('Best estimate of ash-cloud top is around 9,843 FT (3,000 M) above sea level.');
  assert.equal(heightOnly.ash_observed, true);
  assert.equal(heightOnly.ash_top_asl_m, 3000);
  assert.equal(heightOnly.ash_top_above_summit_m, null);
  assert.equal(heightOnly.ash_direction, null);
});

/** Every volcano MAGMA lists on its VONA page (November 2026). */
const MAGMA_VONA_NAMES = [
  'Agung', 'Ambang', 'Anak Krakatau', 'Anak Ranakah', 'Arjuno Welirang', 'Awu', 'Banda Api', 'Batur', 'Batutara',
  'Bromo', 'Bur Ni Telong', 'Ciremai', 'Colo', 'Dempo', 'Dieng', 'Dukono', 'Ebulobo', 'Egon', 'Galunggung',
  'Gamalama', 'Gamkonora', 'Gede', 'Guntur', 'Ibu', 'Ijen', 'Ile Werung', 'Ili Boleng', 'Ili Lewotolok', 'Inielika',
  'Inierie', 'Iya', 'Kaba', 'Karangetang', 'Kelimutu', 'Kelud', 'Kerinci', 'Kie Besi', 'Lamongan', 'Lereboleng',
  'Lewotobi Laki-laki', 'Lewotobi Perempuan', 'Lokon', 'Mahawu', 'Marapi', 'Merapi', 'Papandayan', 'Peut Sague',
  'Raung', 'Rinjani', 'Rokatenda', 'Ruang', 'Salak', 'Sangeangapi', 'Semeru', 'Seulawah Agam', 'Sinabung', 'Sirung',
  'Slamet', 'Soputan', 'Sorikmarapi', 'Sumbing', 'Sundoro', 'Talang', 'Tambora', 'Tandikat', 'Tangkoko',
  'Tangkuban Parahu', 'Wurlali',
];

test('VONA names map onto the catalogue by name, never by resemblance', () => {
  const catalogueNames = new Set(INDONESIAN_VOLCANOES.map((volcano) => volcano.name));
  for (const name of MAGMA_VONA_NAMES) {
    const expected = catalogueNames.has(name) ? name : null;
    assert.equal(catalogueVolcanoForVona(name, MAGMA_VONA_NAMES)?.name ?? null, expected, name);
  }
  // Every catalogue volcano has a VONA archive under its own name.
  for (const volcano of INDONESIAN_VOLCANOES) {
    assert.ok(MAGMA_VONA_NAMES.includes(volcano.name), volcano.name);
  }

  assert.equal(catalogueVolcanoForVona('Sorikmarapi'), null);
  assert.equal(catalogueVolcanoForVona('Krakatau')?.name, 'Anak Krakatau');
  assert.equal(catalogueVolcanoForVona('G. Semeru')?.name, 'Semeru');
  assert.equal(catalogueVolcanoForVona('Lewotobi Laki Laki')?.name, 'Lewotobi Laki-laki');
  assert.equal(catalogueVolcanoForVona('Lewotolok')?.name, 'Ili Lewotolok');
  // The catalogue lists Lewotobi Perempuan as an alias; MAGMA files its VONAs separately.
  assert.equal(catalogueVolcanoForVona('Lewotobi Perempuan', MAGMA_VONA_NAMES), null);
  assert.equal(catalogueVolcanoForVona('Lewotobi Perempuan')?.name, 'Lewotobi Laki-laki');
  assert.equal(catalogueVolcanoForVona(''), null);
  assert.equal(catalogueVolcanoForVona('a'), null);
});

test('vonaCodeFor finds the archive code of a catalogue volcano', () => {
  const { volcanoes } = parseVonaPage(PAGE);
  assert.equal(vonaCodeFor('Semeru', volcanoes)?.code, 'SMR');
  assert.equal(vonaCodeFor('Lewotobi Laki-laki', volcanoes)?.code, 'LWK');
  assert.equal(vonaCodeFor('Anak Krakatau', volcanoes)?.code, 'KRA');
  assert.equal(vonaCodeFor('Marapi', volcanoes)?.code, 'MAR');
  assert.equal(vonaCodeFor('Kelud', volcanoes), null);
  assert.equal(vonaArchiveUrl('SMR'), 'https://magma.esdm.go.id/v1/vona?code=SMR');
});

test('latestVonaFor picks the newest notice of that volcano', () => {
  const { notices } = parseVonaPage(PAGE);
  assert.equal(latestVonaFor('Semeru', notices)?.id, '23288');
  assert.equal(latestVonaFor('Semeru', [...notices].reverse())?.id, '23288');
  assert.equal(latestVonaFor('Lewotobi Laki-laki', notices), null);
  assert.equal(latestVonaFor('Kelud', notices), null);
});

test('vonaReadState calls a copy older than its refresh interval stale', () => {
  const ttl = 120_000;
  assert.equal(vonaReadState(new Date(NOW).toISOString(), NOW, ttl), 'live');
  assert.equal(vonaReadState(new Date(NOW - 119_000).toISOString(), NOW, ttl), 'live');
  assert.equal(vonaReadState(new Date(NOW - 120_000).toISOString(), NOW, ttl), 'stale');
  assert.equal(vonaReadState(null, NOW, ttl), 'error');
  assert.equal(vonaReadState('not a time', NOW, ttl), 'error');
});

test('vonaMapArrow draws only a reported ash direction under six hours old', () => {
  const { notices } = parseVonaPage(PAGE);
  const dukono = byVolcano(notices, 'Dukono');
  const issued = Date.parse('2026-11-23T09:23:00Z');

  assert.deepEqual(vonaMapArrow(dukono, issued + HOUR_MS), {
    bearings: [90],
    title: 'VONA MAGMA · 16:23 WIB · ke timur',
    expiresAtMs: issued + VONA_MAP_WINDOW_MS,
  });
  assert.equal(vonaMapArrow(dukono, issued + VONA_MAP_WINDOW_MS), null);
  assert.equal(vonaMapArrow(dukono, issued - HOUR_MS), null);

  const lewotolok = byVolcano(notices, 'Ili Lewotolok');
  const arrow = vonaMapArrow(lewotolok, Date.parse('2026-11-22T22:00:00Z'));
  assert.deepEqual(arrow?.bearings, [270, 315]);
  assert.equal(arrow?.title, 'VONA MAGMA · 04:01 WIB · ke barat hingga barat laut');

  // No ash reported, or a direction that is not a compass point: nothing to draw.
  assert.equal(vonaMapArrow(notices[0], Date.parse('2026-11-24T02:00:00Z')), null);
  const sinabung = byVolcano(notices, 'Sinabung');
  assert.equal(vonaMapArrow(sinabung, Date.parse('2026-11-20T03:00:00Z')), null);
  assert.equal(vonaMapArrow({ ...dukono, issued_at: null }, issued + HOUR_MS), null);
});
