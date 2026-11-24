/**
 * Images PVMBG publishes per volcano on MAGMA Indonesia, besides the eruption reports:
 *
 *   Live Seismogram   one drum-plot image per monitoring station
 *   Kamera Gunung Api the latest frame of each observation camera (a thumbnail)
 *
 * Both pages embed their images in the HTML as base64. This module only reads those cards
 * and matches them to the dashboard's volcano catalogue; nothing is generated here, and an
 * image is always handed on with MAGMA's own label for it.
 */

/** One card of a MAGMA media page. */
export interface MagmaMediaCard {
  /** Volcano name as MAGMA writes it: "Semeru". */
  volcano: string;
  /** What follows the name on the card: a station code ("LEKR_EHZ_VG_00") or a camera name ("Pos PGA"). */
  detail: string;
  /** The image, as the `data:` URI MAGMA embeds. */
  image: string;
}

export type VolcanoMediaState =
  /** MAGMA has it and it is in the response. */
  | 'available'
  /** The page is still being read (it is several megabytes and slow); ask again shortly. */
  | 'loading'
  /** The page was read and lists nothing for this volcano. */
  | 'unlisted'
  /** The page could not be read. */
  | 'failed';

export interface VolcanoMediaResponse {
  /** Catalogue name the media was looked up for. */
  volcano: string;
  seismogram: {
    /** MAGMA's label for the card, verbatim: "Semeru - LEKR_EHZ_VG_00". */
    label: string;
    station: string;
    image: string;
    /** When the page carrying this image was read (ISO). */
    fetched_at: string;
  } | null;
  seismogram_state: VolcanoMediaState;
  cameras: Array<{
    /** MAGMA's label for the card, verbatim: "Semeru - Pos PGA". */
    label: string;
    camera: string;
    image: string;
    fetched_at: string;
  }>;
  cameras_state: VolcanoMediaState;
}

/** Raster formats only: an embedded SVG could carry script, and none of these pages uses one. */
const DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** A camera thumbnail is a few kilobytes and a seismogram well under 100 kB; anything far larger is not one. */
const MAX_IMAGE_CHARS = 600_000;

const CARD =
  /<img class="img-fit-cover" src="(data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+)"[^>]*>\s*<div class="card-footer">[\s\S]{0,1200}?<small class="text-right">([^<]+)<\/small>/g;

/**
 * Reads the image cards of MAGMA's "Live Seismogram" or "Kamera Gunung Api" page. A card
 * whose label or image is not in the expected shape is skipped rather than repaired.
 */
export function parseMagmaMediaCards(html: string): MagmaMediaCard[] {
  const cards: MagmaMediaCard[] = [];
  for (const match of html.matchAll(CARD)) {
    const image = match[1];
    const label = match[2].replace(/\s+/g, ' ').trim();
    const separator = label.indexOf(' - ');
    if (separator <= 0 || image.length > MAX_IMAGE_CHARS || !DATA_IMAGE.test(image)) continue;
    const volcano = label.slice(0, separator).trim();
    const detail = label.slice(separator + 3).trim();
    if (!volcano || !detail) continue;
    cards.push({ volcano, detail, image });
  }
  return cards;
}

function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * MAGMA files the seismic station of the Lewotobi twin volcanoes under "Lewotobi
 * Perempuan"; the catalogue lists the erupting peak, Lewotobi Laki-laki. The card is used
 * for it with MAGMA's label shown as written, so the station is never renamed.
 */
const SEISMOGRAM_ALIASES: Record<string, string> = {
  lewotobilakilaki: 'lewotobiperempuan',
};

/** The first seismogram card MAGMA lists for a catalogue volcano, if any. */
export function findSeismogramCard(cards: MagmaMediaCard[], catalogueName: string): MagmaMediaCard | null {
  const key = nameKey(catalogueName);
  return (
    cards.find((card) => nameKey(card.volcano) === key) ??
    cards.find((card) => nameKey(card.volcano) === SEISMOGRAM_ALIASES[key]) ??
    null
  );
}

/** The camera cards MAGMA lists for a catalogue volcano, in MAGMA's order. */
export function findCameraCards(cards: MagmaMediaCard[], catalogueName: string, limit = 4): MagmaMediaCard[] {
  const key = nameKey(catalogueName);
  return cards.filter((card) => nameKey(card.volcano) === key).slice(0, limit);
}

/** MAGMA's own wording for a card: "Semeru - LEKR_EHZ_VG_00". */
export function mediaCardLabel(card: MagmaMediaCard): string {
  return `${card.volcano} - ${card.detail}`;
}
