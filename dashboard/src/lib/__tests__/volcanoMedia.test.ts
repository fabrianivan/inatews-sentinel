import test from 'node:test';
import assert from 'node:assert/strict';
import { findCameraCards, findSeismogramCard, mediaCardLabel, parseMagmaMediaCards } from '../volcanoMedia';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8=';

/** A card as MAGMA's "Live Seismogram" and "Kamera Gunung Api" pages write it. */
function card(image: string, label: string): string {
  return `
            <div class="card card-blog-overlay">
                <img class="img-fit-cover" src="${image}" alt="">
                <div class="card-footer">
                    <small class="mg-r-10"><a href="" class="view" data-uuid="11" data-url="https://magma.esdm.go.id/v1/gunung-api/live-seismogram?expires=1&amp;signature=abc" style="cursor: pointer;">View</a></small>
                    <small class="text-right">${label}</small>
                </div>
            </div>`;
}

const PAGE = [
  '<div class="card-columns column-count-3">',
  card(PNG, 'Agung - TMKS_EHZ_VG_00'),
  card(PNG, 'Anak Krakatau - KRTJ_HHZ_VG_01'),
  card(PNG, 'Dieng - SLR1_EHZ_VG_00'),
  card(PNG, 'Dieng - TBG_EHZ_VG_00'),
  card(PNG, 'Lewotobi Perempuan - WLR_EHZ_VG_00'),
  card(JPG, 'Semeru - Pos PGA'),
  card(JPG, 'Semeru - Besuk Kobokan'),
  // Not images the dashboard will pass on: a scriptable format, and a label without a station.
  card('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'Merapi - SVG_EHZ'),
  card(PNG, 'Tanpa pemisah'),
  '</div>',
].join('');

test('parseMagmaMediaCards reads each card with its own label and image', () => {
  const cards = parseMagmaMediaCards(PAGE);
  assert.deepEqual(
    cards.map((item) => `${item.volcano}|${item.detail}`),
    [
      'Agung|TMKS_EHZ_VG_00',
      'Anak Krakatau|KRTJ_HHZ_VG_01',
      'Dieng|SLR1_EHZ_VG_00',
      'Dieng|TBG_EHZ_VG_00',
      'Lewotobi Perempuan|WLR_EHZ_VG_00',
      'Semeru|Pos PGA',
      'Semeru|Besuk Kobokan',
    ]
  );
  assert.equal(cards[0].image, PNG);
  assert.equal(cards[5].image, JPG);
  assert.equal(mediaCardLabel(cards[1]), 'Anak Krakatau - KRTJ_HHZ_VG_01');

  // A page of another shape yields nothing rather than a guess.
  assert.deepEqual(parseMagmaMediaCards('<html><body><img src="https://example.test/a.png"></body></html>'), []);
  assert.deepEqual(parseMagmaMediaCards(''), []);
});

test('cards are matched to catalogue volcanoes by name, never by resemblance', () => {
  const cards = parseMagmaMediaCards(PAGE);

  assert.equal(findSeismogramCard(cards, 'Agung')?.detail, 'TMKS_EHZ_VG_00');
  assert.equal(findSeismogramCard(cards, 'anak krakatau')?.detail, 'KRTJ_HHZ_VG_01');
  // "Marapi" must not pick up "Merapi", and a volcano MAGMA does not list has no card.
  assert.equal(findSeismogramCard(cards, 'Marapi'), null);
  assert.equal(findSeismogramCard(cards, 'Merapi'), null);

  // The Lewotobi twins share one station, filed under the other peak: used, with MAGMA's label intact.
  const lewotobi = findSeismogramCard(cards, 'Lewotobi Laki-laki');
  assert.ok(lewotobi);
  assert.equal(mediaCardLabel(lewotobi), 'Lewotobi Perempuan - WLR_EHZ_VG_00');

  assert.deepEqual(findCameraCards(cards, 'Semeru').map((item) => item.detail), ['Pos PGA', 'Besuk Kobokan']);
  assert.deepEqual(findCameraCards(cards, 'Semeru', 1).map((item) => item.detail), ['Pos PGA']);
  assert.deepEqual(findCameraCards(cards, 'Lewotobi Laki-laki'), []);
});
