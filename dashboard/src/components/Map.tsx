'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronDown, ChevronUp, CircleHelp, Eye, EyeOff, Layers, RotateCcw, X } from 'lucide-react';
import type {
  BMKGGempaDetail,
  LifecyclePhase,
  LiveEvent,
  RealtimeEarthquakesData,
  SeismicEvent,
  VolcanoEruption,
} from '@/lib/types';
import { findDrillPhase, findDrillScenario, type CoastalZoneEstimate } from '@/lib/drillScenarios';
import {
  OFFICIAL_LEVEL_LABEL,
  TONE_LABEL,
  classifyPotensi,
  officialTone,
  parseVolcanoLevel,
  toneFromMagnitude,
  toneRank,
  tsunamiLevelFromHeight,
  type Tone,
  type VolcanoLevelInfo,
} from '@/lib/severity';
import { formatDecimal, formatWibDateTime, toMillis } from '@/lib/time';
import {
  ASH_TRAJECTORY_DISCLAIMER,
  INDONESIAN_VOLCANOES,
  countEruptionReports,
  findVolcanoLocation,
  getVolcanicAshTrajectory,
  type VolcanoLocation,
} from '@/lib/volcanoData';

/**
 * Hide map labels that collide with a higher-priority label so the map stays legible
 * at national zoom levels. Elements opt in with `data-declutter="<priority>"`.
 */
function declutterMapLabels(container: HTMLElement) {
  // Marker bodies (e.g. volcano badges) are fixed obstacles: never hidden, but labels avoid them.
  const obstacles = Array.from(container.querySelectorAll<HTMLElement>('[data-declutter-fixed]')).map((el) => ({
    el,
    rect: el.getBoundingClientRect(),
  }));
  const items = Array.from(container.querySelectorAll<HTMLElement>('[data-declutter]'));
  items.sort((a, b) => Number(b.dataset.declutter) - Number(a.dataset.declutter));
  const placed: DOMRect[] = [];
  const PAD = 2;
  const hits = (r: DOMRect, p: DOMRect) =>
    r.left < p.right + PAD && r.right > p.left - PAD && r.top < p.bottom + PAD && r.bottom > p.top - PAD;
  for (const el of items) {
    el.style.visibility = '';
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const collides =
      placed.some((p) => hits(r, p)) ||
      obstacles.some((o) => o.rect.width > 0 && !o.el.contains(el) && !el.contains(o.el) && hits(r, o.rect));
    if (collides) el.style.visibility = 'hidden';
    else placed.push(r);
  }
}

/** What the quake layer draws, as a string: equal strings mean nothing on the layer would change. */
function quakeContentKey(data: RealtimeEarthquakesData | null | undefined): string {
  if (!data) return '';
  const item = (quake: SeismicEvent) => `${quake.timestamp}:${quake.magnitude}:${quake.seeded ? 1 : 0}`;
  const latest = data.latest_bmkg;
  return [
    latest ? `${latest.DateTime}:${latest.Magnitude}:${latest.Potensi}:${latest.seeded ? 1 : 0}` : '-',
    (data.recent_bmkg ?? []).map(item).join(','),
    (data.recent_usgs ?? []).map(item).join(','),
  ].join('|');
}

export interface DrillScenarioMapData {
  id: string;
  name: string;
  faultZone: string;
  magnitude: number;
  depth: number;
  lat: number;
  lon: number;
  /** The scenario's maximum height (m), as its zone table states it. */
  tsunamiHeight: number;
  /** Height at the current phase (m). Only sizes the decorative wave rings; never printed. */
  waveHeight?: number;
}

/** Pixels of the map covered by the page's floating HUD, measured from each edge. */
export interface MapViewInsets {
  /** Masthead, drill strip and the pill row. */
  top: number;
  /** Inspector column, warning card or volcano panel, when shown beside the map. */
  right: number;
  /** Pixels covered from the bottom by a sheet (the volcano panel on phones). */
  bottom?: number;
}

const NO_INSETS: MapViewInsets = { top: 0, right: 0 };

function bottomInset(map: L.Map, insets: MapViewInsets): number {
  // Never more than the map leaves below the top inset: a target always gets a place on screen.
  const available = Math.max(0, map.getSize().y - insets.top - 48);
  return Math.round(Math.min(available, Math.max(0, insets.bottom ?? 0)));
}

/**
 * The map centre that puts `target` in the middle of the part of the map the HUD leaves
 * open, at `zoom`.
 */
function centerInOpenArea(map: L.Map, target: L.LatLngExpression, zoom: number, insets: MapViewInsets): L.LatLng {
  const size = map.getSize();
  const openWidth = Math.max(0, size.x - insets.right);
  const openHeight = Math.max(0, size.y - insets.top - bottomInset(map, insets));
  const targetX = openWidth / 2;
  const targetY = insets.top + openHeight / 2;
  return map.unproject(map.project(target, zoom).subtract([targetX - size.x / 2, targetY - size.y / 2]), zoom);
}

/** Padding that keeps a fitted view clear of the HUD. */
function insetPadding(
  map: L.Map,
  insets: MapViewInsets
): Pick<L.FitBoundsOptions, 'paddingTopLeft' | 'paddingBottomRight'> {
  return { paddingTopLeft: [0, insets.top], paddingBottomRight: [insets.right, bottomInset(map, insets)] };
}

interface MapProps {
  activityLevel?: number;
  tsunamiActive?: boolean;
  isSimulasi?: boolean;
  phase?: LifecyclePhase | null;
  events?: LiveEvent[];
  realQuakes?: RealtimeEarthquakesData | null;
  focusCoords?: { lat: number; lon: number } | null;
  volcanoes?: VolcanoEruption[];
  selectedVolcano?: string | null;
  drillScenarioData?: DrillScenarioMapData | null;
  theme?: 'dark' | 'light';
  floatingHud?: boolean;
  className?: string;
  /** Let the latest-quake marker pulse. Off by default: nothing on the map moves in the routine state. */
  emphasizeLatest?: boolean;
  /** What the page's HUD covers, so the overview, fly-to targets and popups stay in the open part. */
  viewInsets?: MapViewInsets;
  /** A volcano marker was picked; the page shows its panel. */
  onSelectVolcano?: (name: string) => void;
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

interface MapPalette {
  /** Faults, illustrations and events too old to earn a tone colour. */
  neutral: string;
  tone: Record<Tone, string>;
  drill: string;
}

/**
 * Leaflet's vector layers take literal colours, not CSS variables, so these
 * mirror the tokens in globals.css — change the two together. HTML markers and
 * popups read the variables directly and need no entry here.
 */
const MAP_PALETTE: Record<'dark' | 'light', MapPalette> = {
  dark: {
    neutral: '#94a3b8', // --tone-unknown
    tone: {
      unknown: '#94a3b8', // --tone-unknown
      rutin: '#cbd5e1', // --tone-rutin
      meningkat: '#eab308', // --tone-meningkat-border
      tinggi: '#f97316', // --tone-tinggi-border
      kritis: '#ef4444', // --tone-kritis-border
    },
    drill: '#8b5cf6', // --drill-border
  },
  light: {
    neutral: '#475569', // --tone-unknown
    tone: {
      unknown: '#475569', // --tone-unknown
      rutin: '#334155', // --tone-rutin
      meningkat: '#a16207', // --tone-meningkat-border
      tinggi: '#ea580c', // --tone-tinggi-border
      kritis: '#dc2626', // --tone-kritis-border
    },
    drill: '#7c3aed', // --drill-border
  },
};

/** Slate tokens for HTML markers whose event no longer earns a tone colour. */
const NEUTRAL_TONE: Tone = 'unknown';

/** Mirrors the thresholds of `toneFromMagnitude`, for the legend. */
const MAGNITUDE_KEY: { tone: Tone; range: string }[] = [
  { tone: 'rutin', range: '< M5' },
  { tone: 'meningkat', range: 'M5–5,9' },
  { tone: 'tinggi', range: 'M6–6,9' },
  { tone: 'kritis', range: '≥ M7' },
];

// ---------------------------------------------------------------------------
// Static reference layers
// ---------------------------------------------------------------------------

/** Sabang to Merauke, Rote to Miangas. */
const INDONESIA_BOUNDS: L.LatLngBoundsLiteral = [
  [-11.0, 95.0],
  [6.1, 141.0],
];

type FaultLayerKey = 'sundaMegathrust' | 'javaTrench' | 'paluKoro' | 'regionalFaults';
type LayerKey = FaultLayerKey | 'volcanoes' | 'ash' | 'stations' | 'buoys';

const FAULT_LAYER_KEYS: FaultLayerKey[] = ['sundaMegathrust', 'javaTrench', 'paluKoro', 'regionalFaults'];

// Schematic traces of the major tectonic systems, for orientation only
const FAULT_SYSTEMS: { layer: FaultLayerKey; name: string; kind: string; coords: [number, number][] }[] = [
  {
    layer: 'sundaMegathrust',
    name: 'Megathrust Sunda (segmen Sumatra)',
    kind: 'Zona subduksi',
    coords: [
      [5.5, 93.5],
      [3.0, 95.5],
      [1.0, 97.2],
      [-1.0, 99.0],
      [-2.5, 99.8],
      [-4.5, 102.0],
      [-6.0, 104.0],
    ],
  },
  {
    layer: 'javaTrench',
    name: 'Palung Jawa (megathrust selatan Jawa)',
    kind: 'Zona subduksi',
    coords: [
      [-6.8, 105.2],
      [-8.0, 107.2],
      [-9.1, 109.5],
      [-9.8, 112.5],
      [-10.5, 115.5],
      [-11.0, 118.0],
    ],
  },
  {
    layer: 'paluKoro',
    name: 'Sesar Palu-Koro',
    kind: 'Sesar geser mendatar',
    coords: [
      [0.8, 119.6],
      [-0.18, 119.85],
      [-0.9, 119.87],
      [-1.8, 120.3],
      [-2.8, 120.8],
    ],
  },
  {
    layer: 'regionalFaults',
    name: 'Busur subduksi Banda & sesar naik Flores',
    kind: 'Zona subduksi dan sesar naik',
    coords: [
      [-8.2, 118.5],
      [-8.0, 121.5],
      [-7.5, 125.0],
      [-5.5, 128.5],
      [-4.0, 131.5],
    ],
  },
  {
    layer: 'regionalFaults',
    name: 'Sesar transform Sorong (Papua)',
    kind: 'Sesar transform',
    coords: [
      [-1.2, 130.5],
      [-1.1, 133.0],
      [-1.6, 136.5],
      [-2.5, 140.7],
    ],
  },
];

// Reference positions from a static list — the map has no live station status
const SEISMIC_STATIONS: { id: string; name: string; pos: [number, number] }[] = [
  { id: 'LEM', name: 'Lembang (Jawa Barat)', pos: [-6.83, 107.62] },
  { id: 'JATS', name: 'Jatiluhur (Jawa Barat)', pos: [-6.52, 107.41] },
  { id: 'CBJI', name: 'Cibinong (Jawa Barat)', pos: [-6.49, 106.85] },
  { id: 'KLI', name: 'Kotabumi (Lampung)', pos: [-4.83, 104.88] },
  { id: 'PDSI', name: 'Padang (Sumatra Barat)', pos: [-0.95, 100.35] },
  { id: 'BKB', name: 'Bukittinggi (Sumatra Barat)', pos: [-0.3, 100.37] },
  { id: 'YOGI', name: 'Yogyakarta (DIY)', pos: [-7.78, 110.37] },
  { id: 'PLAI', name: 'Palu (Sulawesi Tengah)', pos: [-0.9, 119.87] },
  { id: 'MNI', name: 'Manado (Sulawesi Utara)', pos: [1.48, 124.84] },
  { id: 'AAI', name: 'Ambon (Maluku)', pos: [-3.7, 128.18] },
  { id: 'BND', name: 'Banda Aceh (Aceh)', pos: [5.55, 95.32] },
  { id: 'JAY', name: 'Jayapura (Papua)', pos: [-2.53, 140.72] },
];

// Illustrative buoy points — not an official list, and no reading is attached to them
const TSUNAMI_BUOYS: { id: string; name: string; pos: [number, number] }[] = [
  { id: 'BUOY-INA-01', name: 'Selat Sunda / Sebesi', pos: [-5.95, 105.48] },
  { id: 'BUOY-INA-02', name: 'Lepas pantai Mentawai', pos: [-1.15, 100.12] },
  { id: 'BUOY-INA-03', name: 'Samudra Hindia, selatan Cilacap', pos: [-7.95, 109.1] },
  { id: 'BUOY-INA-04', name: 'Teluk Palu / Pantoloan', pos: [-0.72, 119.86] },
  { id: 'BUOY-INA-05', name: 'Samudra Hindia, barat Aceh', pos: [5.62, 95.15] },
  { id: 'BUOY-INA-06', name: 'Selatan Pangandaran', pos: [-7.78, 108.65] },
];

type SwatchKind = 'fault' | 'volcano' | 'ash' | 'station' | 'buoy';

const LAYER_ROWS: { key: LayerKey; label: string; swatch: SwatchKind }[] = [
  { key: 'sundaMegathrust', label: 'Megathrust Sunda', swatch: 'fault' },
  { key: 'javaTrench', label: 'Palung Jawa', swatch: 'fault' },
  { key: 'paluKoro', label: 'Sesar Palu-Koro', swatch: 'fault' },
  { key: 'regionalFaults', label: 'Busur Banda & Sesar Sorong', swatch: 'fault' },
  { key: 'volcanoes', label: 'Gunung api (katalog PVMBG)', swatch: 'volcano' },
  { key: 'ash', label: 'Sebaran abu (ilustrasi)', swatch: 'ash' },
  { key: 'stations', label: 'Stasiun seismik (referensi)', swatch: 'station' },
  { key: 'buoys', label: 'Pelampung tsunami (ilustrasi)', swatch: 'buoy' },
];

function allLayers(visible: boolean): Record<LayerKey, boolean> {
  return {
    sundaMegathrust: visible,
    javaTrench: visible,
    paluKoro: visible,
    regionalFaults: visible,
    volcanoes: visible,
    ash: visible,
    stations: visible,
    buoys: visible,
  };
}

// ---------------------------------------------------------------------------
// HTML helpers — markers and popups are plain HTML handed to Leaflet
// ---------------------------------------------------------------------------

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

const MAP_LABEL_STYLE =
  'white-space:nowrap;background:var(--surface-1);color:var(--text-primary);border:1px solid var(--border-strong);border-radius:6px;padding:1px 6px;font-size:11px;line-height:16px;font-weight:600;';

const POPUP_TITLE = 't-body font-semibold';
// Same metrics as .tone-chip, without a tone
const NEUTRAL_BADGE =
  'inline-flex min-h-6 items-center whitespace-nowrap rounded-full border border-[var(--border-strong)] px-2.5 text-[11px] font-bold tracking-[0.05em] text-[var(--text-primary)]';

function popupHtml(rows: string[], minWidthClass = 'min-w-[200px]'): string {
  return `<div class="flex ${minWidthClass} flex-col gap-1">${rows.filter(Boolean).join('')}</div>`;
}

function metaRow(html: string): string {
  return `<span class="t-meta">${html}</span>`;
}

function formatCoords(lat: number, lon: number): string {
  const latText = `${formatDecimal(Math.abs(lat), 2)}°${lat >= 0 ? 'LU' : 'LS'}`;
  const lonText = `${formatDecimal(Math.abs(lon), 2)}°${lon >= 0 ? 'BT' : 'BB'}`;
  return `${latText}, ${lonText}`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------------------------------------------------------------------------
// Earthquakes
// ---------------------------------------------------------------------------

interface MapQuake {
  lat: number;
  lon: number;
  magnitude: number | null;
  depthKm: number | null;
  place: string;
  timestampMs: number | null;
  /** Built-in placeholder, not something a feed reported. */
  seeded: boolean;
}

/** Feeds send numbers either as numbers or as text such as "5.2" or "10 km". */
function readNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Position from the normalised fields, or from BMKG's own "Coordinates" / "Lintang" + "Bujur". */
function readPosition(q: Record<string, unknown>): [number, number] | null {
  let lat = typeof q.latitude === 'number' ? q.latitude : NaN;
  let lon = typeof q.longitude === 'number' ? q.longitude : NaN;
  if ((Number.isNaN(lat) || Number.isNaN(lon)) && typeof q.Coordinates === 'string') {
    const parts = q.Coordinates.split(',');
    if (parts.length === 2) {
      lat = parseFloat(parts[0]);
      lon = parseFloat(parts[1]);
    }
  }
  if ((Number.isNaN(lat) || Number.isNaN(lon)) && typeof q.Lintang === 'string' && typeof q.Bujur === 'string') {
    lat = parseFloat(q.Lintang);
    if (q.Lintang.includes('LS')) lat = -Math.abs(lat);
    lon = parseFloat(q.Bujur);
    if (q.Bujur.includes('BB')) lon = -Math.abs(lon);
  }
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
}

/**
 * Reads an earthquake in either shape the feeds deliver (normalised event or
 * BMKG record). Missing values stay missing: nothing is filled with a default.
 */
function readQuake(item: unknown): MapQuake | null {
  const q = item as Record<string, unknown>;
  const position = readPosition(q);
  if (!position) return null;
  const magnitude = readNumber(q.magnitude ?? q.Magnitude);
  const time = q.timestamp ?? q.DateTime;
  return {
    lat: position[0],
    lon: position[1],
    magnitude: magnitude !== null && magnitude > 0 ? magnitude : null,
    depthKm: readNumber(q.depth ?? q.Kedalaman),
    place: String(q.fault_zone || q.Wilayah || q.place || ''),
    timestampMs: typeof time === 'string' || typeof time === 'number' ? toMillis(time) : null,
    seeded: q.seeded === true,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Age decides how loud an event is drawn: full strength and a tone colour for
 * the first day, then fading neutral. An event with no usable time is treated
 * as old — it cannot be shown as current.
 */
function ageEmphasis(timestampMs: number | null, nowMs: number): { opacity: number; fresh: boolean } {
  if (timestampMs === null) return { opacity: 0.3, fresh: false };
  const age = nowMs - timestampMs;
  if (age < DAY_MS) return { opacity: 1, fresh: true };
  if (age < 3 * DAY_MS) return { opacity: 0.6, fresh: false };
  return { opacity: 0.3, fresh: false };
}

/** Circle radius in pixels: M4 ≈ 6, M5 ≈ 9, M6 ≈ 13, M7 ≈ 18, M8 ≈ 24. */
function quakeRadius(magnitude: number | null): number {
  if (magnitude === null) return 5;
  return 4 + Math.max(0, magnitude - 3) ** 1.6 * 1.5;
}

function magnitudeText(magnitude: number | null): string {
  return magnitude === null ? 'M tidak tersedia' : `M ${formatDecimal(magnitude)}`;
}

/** Tone-coloured only while the event is fresh; a plain badge otherwise. */
function magnitudeBadge(magnitude: number | null, tone: Tone | null): string {
  const text = magnitudeText(magnitude);
  return tone
    ? `<span class="tone-chip" data-tone="${tone}">${text}</span>`
    : `<span class="${NEUTRAL_BADGE}">${text}</span>`;
}

function popupHeader(badge: string, sourceTag: string): string {
  return `<div class="flex items-center justify-between gap-3">${badge}<span class="t-micro">${escapeHtml(sourceTag)}</span></div>`;
}

function quakePopupHtml(quake: MapQuake, source: 'BMKG' | 'USGS', tone: Tone | null): string {
  return popupHtml([
    popupHeader(magnitudeBadge(quake.magnitude, tone), quake.seeded ? 'Data contoh' : source),
    `<strong class="${POPUP_TITLE}">${escapeHtml(quake.place || 'Lokasi tidak tersedia')}</strong>`,
    metaRow(
      quake.depthKm === null ? 'Kedalaman tidak tersedia' : `Kedalaman ${formatDecimal(quake.depthKm, 0)} km`
    ),
    metaRow(quake.timestampMs === null ? 'Waktu tidak tersedia' : formatWibDateTime(quake.timestampMs)),
    metaRow(formatCoords(quake.lat, quake.lon)),
    quake.seeded ? metaRow(`Data contoh bawaan — bukan laporan ${source}.`) : '',
  ]);
}

function latestQuakePopupHtml(detail: BMKGGempaDetail, quake: MapQuake, tone: Tone | null): string {
  const when =
    quake.timestampMs !== null
      ? formatWibDateTime(quake.timestampMs)
      : escapeHtml([detail.Tanggal, detail.Jam].filter(Boolean).join(' · ') || 'Waktu tidak tersedia');
  // "Potensi" is BMKG's sentence, so it is quoted; a placeholder record has no BMKG statement to quote.
  const potensiKind = quake.seeded ? 'empty' : classifyPotensi(detail.Potensi);
  const flagged = potensiKind === 'tsunami' && tone !== null;
  const potensi =
    potensiKind === 'empty'
      ? ''
      : `<span class="t-meta${flagged ? ' tone-text font-semibold' : ''}"${flagged ? ' data-tone="kritis"' : ''}>BMKG: “${escapeHtml(detail.Potensi)}”</span>`;
  return popupHtml(
    [
      popupHeader(
        magnitudeBadge(quake.magnitude, tone),
        quake.seeded ? 'Data contoh' : 'Gempa terkini · BMKG'
      ),
      `<strong class="${POPUP_TITLE}">${escapeHtml(detail.Wilayah || 'Lokasi tidak tersedia')}</strong>`,
      metaRow(detail.Kedalaman ? `Kedalaman ${escapeHtml(detail.Kedalaman)}` : 'Kedalaman tidak tersedia'),
      metaRow(when),
      potensi,
      quake.seeded ? metaRow('Data contoh bawaan — bukan laporan terbaru BMKG.') : '',
    ],
    'min-w-[220px]'
  );
}

/** The latest event is told apart by shape — a ringed dot with a label — so it needs no colour or motion. */
function latestQuakeIcon(quake: MapQuake, tone: Tone | null, pulse: boolean): L.DivIcon {
  return L.divIcon({
    className: 'latest-gempa-hero-icon',
    html: `
      <div data-declutter-fixed data-tone="${tone ?? NEUTRAL_TONE}" style="position:relative;width:36px;height:36px;">
        ${pulse ? '<span style="position:absolute;inset:0;border-radius:50%;background:var(--tone-solid);opacity:0.45;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></span>' : ''}
        <span style="position:absolute;inset:4px;border-radius:50%;border:2px solid var(--tone);"></span>
        <span style="position:absolute;inset:10px;border-radius:50%;background:var(--tone-solid);border:2px solid var(--text-primary);"></span>
        <span data-declutter="115" style="position:absolute;top:100%;left:50%;transform:translateX(-50%);${MAP_LABEL_STYLE}">
          ${quake.seeded ? 'Contoh' : 'Terkini'} · ${magnitudeText(quake.magnitude)}
        </span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

// ---------------------------------------------------------------------------
// Volcanoes
// ---------------------------------------------------------------------------

interface VolcanoMarkerEntry {
  volcano: VolcanoLocation;
  marker: L.Marker;
  level: VolcanoLevelInfo | null;
  tone: Tone;
  selected: boolean;
  /** Eruption reports for this volcano in the loaded list (placeholders excluded). */
  reportCount: number;
}

function isSelectedVolcano(volcano: VolcanoLocation, selected: string | null): boolean {
  if (!selected) return false;
  const wanted = selected.toLowerCase();
  const name = volcano.name.toLowerCase();
  return wanted.includes(name) || name.includes(wanted);
}

/**
 * The level shown on the map is the built-in catalogue's, not a live PVMBG status, so it
 * is never worded as a quotation of the agency; every place that prints it adds "katalog".
 */
function volcanoLevelText(level: VolcanoLevelInfo | null): string {
  return level ? level.label : 'Level tidak diketahui';
}

/**
 * Badge with the level numeral, so the level reads without colour. Level I and
 * an unknown level come out slate through the tone tokens; selection is the
 * accent outline, never a severity colour.
 */
function volcanoIcon(entry: Omit<VolcanoMarkerEntry, 'marker'>): L.DivIcon {
  const labelPriority = entry.selected ? 120 : 60 + toneRank(entry.tone) * 10;
  return L.divIcon({
    className: 'volcano-map-marker',
    html: `
      <div data-declutter-fixed data-tone="${entry.tone}" style="position:relative;display:flex;align-items:center;justify-content:center;gap:3px;width:40px;height:24px;border-radius:12px;background:var(--surface-1);border:2px solid var(--tone);color:var(--tone);cursor:pointer;${entry.selected ? 'outline:2px solid var(--accent);outline-offset:2px;' : ''}">
        <svg width="10" height="9" viewBox="0 0 10 9" aria-hidden="true"><path d="M5 0 10 9H0z" fill="currentColor"/></svg>
        <span style="font-family:var(--font-mono);font-size:11px;font-weight:700;line-height:1;">${entry.level?.roman ?? '?'}</span>
        ${entry.reportCount > 0 ? '<span aria-hidden="true" style="position:absolute;top:-4px;right:-4px;width:9px;height:9px;border-radius:9999px;background:var(--info);border:2px solid var(--surface-1);"></span>' : ''}
        <span data-declutter="${labelPriority}" style="position:absolute;top:100%;left:50%;margin-top:3px;transform:translateX(-50%);${MAP_LABEL_STYLE}">
          ${escapeHtml(entry.volcano.name)}
        </span>
      </div>
    `,
    iconSize: [40, 24],
    iconAnchor: [20, 12],
  });
}

function volcanoZIndex(tone: Tone, selected: boolean): number {
  return selected ? 900 : 500 + toneRank(tone) * 50;
}

// ---------------------------------------------------------------------------
// Drill
// ---------------------------------------------------------------------------

const DRILL_VALUE_NOTE = 'Nilai latihan, bukan hasil pemodelan maupun peringatan resmi.';

function drillZoneTone(zone: CoastalZoneEstimate): Tone {
  const level = tsunamiLevelFromHeight(zone.heightM);
  return level ? officialTone(level) : 'unknown';
}

function drillZonePopupHtml(zone: CoastalZoneEstimate): string {
  const level = tsunamiLevelFromHeight(zone.heightM);
  const levelText = level ? `tingkat ${OFFICIAL_LEVEL_LABEL[level]} (latihan)` : 'tingkat tidak ditentukan (latihan)';
  return popupHtml(
    [
      '<span class="drill-chip self-start">Simulasi · latihan</span>',
      `<strong class="${POPUP_TITLE}">${escapeHtml(zone.name)}</strong>`,
      metaRow(`Gelombang pertama ≈ ${zone.etaMin} mnt setelah gempa utama`),
      metaRow(
        `Tinggi maks. ≈ ${formatDecimal(zone.heightM)} m — <span class="tone-text font-semibold" data-tone="${drillZoneTone(zone)}">${levelText}</span>`
      ),
      metaRow(DRILL_VALUE_NOTE),
    ],
    'min-w-[220px]'
  );
}

/** Static badge under the zone point. The estimate is fixed text: no countdown runs inside Leaflet. */
function drillZoneIcon(zone: CoastalZoneEstimate, arrivalOrder: number): L.DivIcon {
  return L.divIcon({
    className: 'tsunami-eta-badge',
    html: `
      <div data-declutter="${140 - arrivalOrder}" data-tone="${drillZoneTone(zone)}" style="position:absolute;top:10px;left:0;transform:translateX(-50%);display:inline-flex;align-items:center;gap:6px;${MAP_LABEL_STYLE}border:1px dashed var(--drill-border);">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--tone-solid);border:1px solid var(--tone-border);"></span>
        ${escapeHtml(zone.name)} · ≈ ${zone.etaMin} mnt
        <span style="color:var(--drill);">· latihan</span>
      </div>
    `,
    iconSize: [0, 0],
  });
}

function drillEpicenterPopupHtml(
  drill: DrillScenarioMapData,
  phaseLabel: string | null,
  tsunamiActive: boolean
): string {
  const cell = (label: string, value: string) =>
    `<div class="flex flex-col"><span class="t-micro">${label}</span><span class="font-mono font-semibold text-[var(--text-primary)]">${value}</span></div>`;
  return popupHtml(
    [
      '<span class="drill-chip self-start">Simulasi · latihan</span>',
      `<strong class="t-heading">Episenter skenario: ${escapeHtml(drill.name)}</strong>`,
      metaRow(`Zona sumber: ${escapeHtml(drill.faultZone)}`),
      `<div class="t-meta grid grid-cols-2 gap-x-3 gap-y-1">
        ${cell('Magnitudo', `M ${formatDecimal(drill.magnitude)}`)}
        ${cell('Kedalaman', `${formatDecimal(drill.depth, 0)} km`)}
        ${tsunamiActive ? cell('Tinggi maks. skenario', `≈ ${formatDecimal(drill.tsunamiHeight)} m`) : ''}
        ${phaseLabel ? cell('Tahap latihan', escapeHtml(phaseLabel)) : ''}
      </div>`,
      metaRow(DRILL_VALUE_NOTE),
    ],
    'min-w-[230px]'
  );
}

// ---------------------------------------------------------------------------
// Legend swatches
// ---------------------------------------------------------------------------

function LayerSwatch({ kind }: { kind: SwatchKind }) {
  switch (kind) {
    case 'fault':
      return <span aria-hidden="true" className="w-4 shrink-0 border-t-2 border-dashed border-[var(--text-muted)]" />;
    case 'volcano':
      return (
        <svg aria-hidden="true" viewBox="0 0 10 9" className="h-2.5 w-4 shrink-0 text-[var(--text-muted)]">
          <path d="M5 0 10 9H0z" fill="currentColor" />
        </svg>
      );
    case 'ash':
      return (
        <span aria-hidden="true" className="mx-0.5 h-3 w-3 shrink-0 rounded-sm border border-dashed border-[var(--text-muted)]" />
      );
    case 'station':
      return <span aria-hidden="true" className="mx-1 h-2 w-2 shrink-0 bg-[var(--text-muted)]" />;
    case 'buoy':
      return <span aria-hidden="true" className="mx-0.5 h-3 w-3 shrink-0 rounded-full border-2 border-[var(--info)]" />;
  }
}

/** An eye for a layer that is shown, a struck-through eye for one that is hidden. */
function LayerVisibility({ shown }: { shown: boolean }) {
  return shown ? (
    <Eye className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
  ) : (
    <EyeOff className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
  );
}

/** One row of the map key: a drawn symbol, then what it means. */
function KeyRow({ symbol, children }: { symbol: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span aria-hidden="true" className="flex w-14 shrink-0 items-center justify-center gap-1">
        {symbol}
      </span>
      <span className="t-meta min-w-0">{children}</span>
    </li>
  );
}

/** A quake circle as the map draws it (neutral colour unless a tone is given). */
function KeyCircle({
  size,
  opacity = 1,
  tone,
  ring = false,
  dashed = false,
}: {
  size: number;
  opacity?: number;
  tone?: Tone;
  ring?: boolean;
  dashed?: boolean;
}) {
  return (
    <span
      data-tone={tone}
      className="inline-block shrink-0 rounded-full border-[1.5px]"
      style={{
        width: size,
        height: size,
        opacity,
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: tone ? 'var(--tone-solid)' : 'var(--text-muted)',
        background: ring ? 'transparent' : tone ? 'var(--tone-solid)' : 'color-mix(in srgb, var(--text-muted) 45%, transparent)',
      }}
    />
  );
}

/**
 * How to read the map, behind the "?" on the map: every symbol drawn as the map draws it,
 * so the key is read by looking, with a few words each.
 */
function MapKey({ isSimulasi, onClose }: { isSimulasi: boolean; onClose: () => void }) {
  return (
    <div id="map-key" role="dialog" aria-label="Cara membaca peta" className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 pl-1">
        <span className="t-micro text-[var(--text-primary)]">Cara membaca peta</span>
        <button type="button" onClick={onClose} aria-label="Tutup keterangan peta" className="icon-btn">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <ul className="mt-2 flex min-h-0 flex-col gap-2 overflow-y-auto border-t border-[var(--border-hairline)] pt-2.5 pr-1">
        <KeyRow
          symbol={
            <>
              <KeyCircle size={8} />
              <KeyCircle size={12} />
              <KeyCircle size={17} />
            </>
          }
        >
          Gempa — makin besar, makin kuat (magnitudo)
        </KeyRow>
        <KeyRow
          symbol={
            <>
              <KeyCircle size={12} />
              <KeyCircle size={12} opacity={0.6} />
              <KeyCircle size={12} opacity={0.3} />
            </>
          }
        >
          Makin pudar, makin lama: &lt; 24 jam · &lt; 72 jam · lebih lama
        </KeyRow>
        <li>
          <p className="t-meta pl-1">Warna hanya untuk gempa &lt; 24 jam — skala prioritas tidak resmi:</p>
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            {MAGNITUDE_KEY.map((entry) => (
              <span key={entry.tone} className="t-meta inline-flex items-center gap-1.5">
                <KeyCircle size={11} tone={entry.tone} />
                <span className="tone-text font-semibold" data-tone={entry.tone}>
                  {TONE_LABEL[entry.tone]}
                </span>
                <span className="text-[var(--text-muted)]">{entry.range}</span>
              </span>
            ))}
          </div>
        </li>
        <KeyRow symbol={<KeyCircle size={14} ring />}>Cincin kosong — gempa versi USGS</KeyRow>
        <KeyRow symbol={<KeyCircle size={14} dashed />}>Garis putus-putus — data contoh, bukan laporan</KeyRow>
        <KeyRow
          symbol={
            <span
              className="relative inline-flex h-[20px] w-[34px] items-center justify-center gap-[3px] rounded-[10px] border-2 bg-[var(--surface-1)] text-[var(--text-secondary)]"
              style={{ borderColor: 'var(--text-muted)' }}
            >
              <svg width="8" height="7" viewBox="0 0 10 9">
                <path d="M5 0 10 9H0z" fill="currentColor" />
              </svg>
              <span className="font-mono text-[10px] font-bold leading-none">II</span>
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border-2 border-[var(--surface-1)] bg-[var(--info)]" />
            </span>
          }
        >
          Gunung api: I–IV = tingkat aktivitas PVMBG dari katalog, bukan pembacaan langsung — verifikasi di MAGMA.
          Titik biru = ada laporan erupsi MAGMA.
        </KeyRow>
        {isSimulasi && (
          <KeyRow symbol={<span className="drill-chip">Latihan</span>}>
            Garis ungu, lingkaran pesisir dan label ≈ menit adalah nilai latihan, bukan hasil pemodelan.
          </KeyRow>
        )}
      </ul>
    </div>
  );
}

export default function Map({
  tsunamiActive = false,
  isSimulasi = false,
  phase,
  realQuakes,
  focusCoords,
  volcanoes = [],
  selectedVolcano = null,
  drillScenarioData = null,
  theme = 'dark',
  floatingHud = false,
  className = '',
  emphasizeLatest = false,
  viewInsets = NO_INSETS,
  onSelectVolcano,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const darkBaseLayerRef = useRef<L.Layer | null>(null);
  const lightBaseLayerRef = useRef<L.Layer | null>(null);
  const basemapModeRef = useRef<'tactical' | 'custom'>('tactical');
  const faultLayersRef = useRef<Record<FaultLayerKey, L.LayerGroup> | null>(null);
  const stationLayerRef = useRef<L.LayerGroup | null>(null);
  const buoyLayerRef = useRef<L.LayerGroup | null>(null);
  const quakeLayerRef = useRef<L.LayerGroup | null>(null);
  const volcanoLayerRef = useRef<L.LayerGroup | null>(null);
  const volcanoMarkersRef = useRef<VolcanoMarkerEntry[]>([]);
  const ashLayerRef = useRef<L.LayerGroup | null>(null);
  const drillLayerRef = useRef<L.LayerGroup | null>(null);
  const lastDrillIdRef = useRef<string | null>(null);
  // True until someone moves the map: while it holds, the whole archipelago is kept in frame.
  const overviewRef = useRef(true);
  // Read by handlers that outlive a render (resize, reset, focus).
  const insetsRef = useRef(viewInsets);
  // What the last volcano flight was for: which volcano, and how much of the map was covered.
  const lastFlightRef = useRef<{ name: string | null; right: number; bottom: number }>({
    name: null,
    right: 0,
    bottom: 0,
  });
  // The volcano a flight is under way to, until the map settles.
  const flyingToRef = useRef<string | null>(null);
  const [cursorCoords, setCursorCoords] = useState<string | null>(null);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState<boolean>(true);
  /** The map key behind the "?" — opening it folds the layer list away, and the other way round. */
  const [isKeyOpen, setIsKeyOpen] = useState(false);
  const layersControlRef = useRef<HTMLDivElement | null>(null);
  const [activeLayer, setActiveLayer] = useState<Record<LayerKey, boolean>>(() => allLayers(true));

  // The key is a popup: a press anywhere else on the page, or Escape, puts it away.
  useEffect(() => {
    if (!isKeyOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!layersControlRef.current?.contains(event.target as Node)) setIsKeyOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsKeyOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isKeyOpen]);

  // Markers call the latest callbacks through refs, so a new function identity
  // from the parent never rebuilds the markers or closes an open popup.
  const onSelectVolcanoRef = useRef(onSelectVolcano);
  useEffect(() => {
    onSelectVolcanoRef.current = onSelectVolcano;
  });

  // Every poll hands over fresh arrays, usually with the same content. Layers are rebuilt
  // only when the content changes — otherwise the popup a user just opened would be torn
  // down by the next poll. The hour bucket lets age-based fading catch up without a redraw
  // on every poll.
  const quakeSignature = useMemo(
    () => `${quakeContentKey(realQuakes)}#${Math.floor(Date.now() / 3_600_000)}`,
    [realQuakes]
  );
  // Markers only show whether a volcano has reports, so they are rebuilt when that changes.
  const volcanoSignature = useMemo(
    () =>
      INDONESIAN_VOLCANOES.map((volcano) => `${volcano.name}:${countEruptionReports(volcano, volcanoes)}`).join('|'),
    [volcanoes]
  );
  const realQuakesRef = useRef(realQuakes);
  const volcanoesRef = useRef(volcanoes);
  useEffect(() => {
    realQuakesRef.current = realQuakes;
    volcanoesRef.current = volcanoes;
  });

  const drill = isSimulasi ? drillScenarioData : null;
  const drillPhase = phase ? findDrillPhase(phase.phase_number) : null;
  const mainshockOccurred = drillPhase?.mainshockOccurred ?? true;
  const drillPhaseLabel = drillPhase?.shortLabel ?? null;

  // 1. Initialize Leaflet Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    // minZoom 3 and half-step zoom let the whole archipelago fit a phone-width map
    const map = L.map(container, {
      minZoom: 3,
      maxZoom: 13,
      // Quarter steps: the overview is fitted between the HUD's columns, where half a zoom
      // level is the difference between filling the open area and leaving a third of it empty.
      zoomSnap: 0.25,
      zoomControl: false,
    });
    overviewRef.current = true;
    map.fitBounds(INDONESIA_BOUNDS, { animate: false, ...insetPadding(map, insetsRef.current) });

    // Tactical Theme-Synced Basemaps (ESRI Dark/Light Canvas + Reference Labels — zero API key required)
    const darkMatterLayer = L.layerGroup([
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri, HERE, Garmin · BMKG',
          maxZoom: 16,
        }
      ),
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
        }
      ),
    ]);

    const positronLightLayer = L.layerGroup([
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri, HERE, Garmin · BMKG',
          maxZoom: 16,
        }
      ),
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
        }
      ),
    ]);

    // Standard OpenStreetMap fallback layer
    const osmLayer = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors · BMKG',
        maxZoom: 18,
      }
    );

    // High quality ESRI World Imagery
    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri, Maxar, BMKG, USGS',
        maxZoom: 18,
      }
    );

    // ESRI Ocean Bathymetry
    const oceanLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri, NOAA, GEBCO',
        maxZoom: 16,
      }
    );

    // The theme effect below puts the matching tactical basemap on the map
    darkBaseLayerRef.current = darkMatterLayer;
    lightBaseLayerRef.current = positronLightLayer;

    const baseMaps = {
      'Peta Gelap Taktis': darkMatterLayer,
      'Peta Terang Operasional': positronLightLayer,
      'OpenStreetMap': osmLayer,
      'Satelit (ESRI)': satelliteLayer,
      'Batimetri Oseanografi': oceanLayer,
    };
    L.control.layers(baseMaps, undefined, { position: 'topleft' }).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);

    map.on('baselayerchange', (ev) => {
      if (ev.name === 'Peta Gelap Taktis' || ev.name === 'Peta Terang Operasional') {
        basemapModeRef.current = 'tactical';
      } else {
        basemapModeRef.current = 'custom';
      }
    });

    map.on('mousemove', (e) => setCursorCoords(formatCoords(e.latlng.lat, e.latlng.lng)));

    // Fault traces are drawn by the theme effect: their colour follows the theme
    faultLayersRef.current = {
      sundaMegathrust: L.layerGroup().addTo(map),
      javaTrench: L.layerGroup().addTo(map),
      paluKoro: L.layerGroup().addTo(map),
      regionalFaults: L.layerGroup().addTo(map),
    };

    const stationLayer = L.layerGroup().addTo(map);
    SEISMIC_STATIONS.forEach((st) => {
      const stIcon = L.divIcon({
        className: 'station-marker',
        html: `
          <div data-declutter="40" style="display:inline-flex;align-items:center;gap:4px;${MAP_LABEL_STYLE}font-family:var(--font-mono);">
            <span style="width:6px;height:6px;background:var(--text-muted);"></span>
            ${escapeHtml(st.id)}
          </div>
        `,
        iconSize: [56, 20],
        iconAnchor: [28, 10],
      });

      L.marker(st.pos, { icon: stIcon, title: `Stasiun seismik ${st.id}` })
        .addTo(stationLayer)
        .bindPopup(
          popupHtml([
            `<strong class="${POPUP_TITLE}">Stasiun seismik ${escapeHtml(st.id)}</strong>`,
            metaRow(`Lokasi: ${escapeHtml(st.name)}`),
            metaRow('Posisi referensi dari daftar statis — status stasiun tidak tersedia di peta ini.'),
          ])
        );
    });
    stationLayerRef.current = stationLayer;

    const buoyLayer = L.layerGroup().addTo(map);
    TSUNAMI_BUOYS.forEach((buoy) => {
      const buoyIcon = L.divIcon({
        className: 'buoy-marker',
        html: `
          <div style="display:flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:var(--surface-1);border:2px solid var(--info);">
            <span style="width:4px;height:4px;border-radius:50%;background:var(--info);"></span>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      L.marker(buoy.pos, { icon: buoyIcon, title: `Pelampung tsunami ${buoy.id} (ilustrasi)` })
        .addTo(buoyLayer)
        .bindPopup(
          popupHtml([
            `<strong class="${POPUP_TITLE}">${escapeHtml(buoy.id)}</strong>`,
            metaRow(`Pelampung tsunami: ${escapeHtml(buoy.name)}`),
            metaRow('Titik ilustratif, bukan daftar resmi — pembacaan muka laut tidak tersedia di peta ini.'),
          ])
        );
    });
    buoyLayerRef.current = buoyLayer;

    quakeLayerRef.current = L.layerGroup().addTo(map);
    volcanoLayerRef.current = L.layerGroup().addTo(map);
    ashLayerRef.current = L.layerGroup().addTo(map);
    drillLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    // Any direct interaction ends overview mode. Captured, because Leaflet's own
    // controls stop these events from bubbling.
    const leaveOverview = () => {
      overviewRef.current = false;
    };
    const interactionEvents = ['pointerdown', 'wheel', 'keydown'] as const;
    interactionEvents.forEach((type) => container.addEventListener(type, leaveOverview, { capture: true, passive: true }));

    // The container often gets its final size after the first paint (and changes
    // again on rotation); re-fit while the view is still the untouched overview.
    const settleSize = () => {
      map.invalidateSize();
      if (overviewRef.current) map.fitBounds(INDONESIA_BOUNDS, { animate: false, ...insetPadding(map, insetsRef.current) });
    };
    const timer = setTimeout(settleSize, 250);
    window.addEventListener('resize', settleSize);

    // Re-run label decluttering whenever the view or the set of markers changes
    let declutterFrame = 0;
    const scheduleDeclutter = () => {
      cancelAnimationFrame(declutterFrame);
      declutterFrame = requestAnimationFrame(() => declutterMapLabels(map.getContainer()));
    };
    map.on('zoomend moveend', scheduleDeclutter);
    // globals.css compacts volcano badges while the tier is "far" (see .volcano-map-marker)
    const syncZoomTier = () => {
      // Desktop overviews sit between 4.5 and 5.5 and keep the numbered badges; a phone's
      // overview (about 3.5) and a narrow window's (4.25) use the compact dots.
      map.getContainer().dataset.zoomTier = map.getZoom() < 4.5 ? 'far' : 'near';
    };
    map.on('zoomend', syncZoomTier);
    syncZoomTier();
    const markerPaneObserver = new MutationObserver(scheduleDeclutter);
    markerPaneObserver.observe(map.getPane('markerPane')!, { childList: true });
    scheduleDeclutter();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(settleSize);
      resizeObserver.observe(container);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', settleSize);
      interactionEvents.forEach((type) => container.removeEventListener(type, leaveOverview, { capture: true }));
      resizeObserver?.disconnect();
      markerPaneObserver.disconnect();
      cancelAnimationFrame(declutterFrame);
      map.off('zoomend moveend', scheduleDeclutter);
      map.off('zoomend', syncZoomTier);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 1a. Automatically sync Tactical Basemap with Dark/Light theme toggle
  useEffect(() => {
    const map = mapRef.current;
    const darkLayer = darkBaseLayerRef.current;
    const lightLayer = lightBaseLayerRef.current;
    if (!map || !darkLayer || !lightLayer || basemapModeRef.current !== 'tactical') return;

    if (theme === 'light') {
      if (map.hasLayer(darkLayer)) map.removeLayer(darkLayer);
      if (!map.hasLayer(lightLayer)) lightLayer.addTo(map);
    } else {
      if (map.hasLayer(lightLayer)) map.removeLayer(lightLayer);
      if (!map.hasLayer(darkLayer)) darkLayer.addTo(map);
    }
  }, [theme]);

  // 1b. Fault traces: neutral, dashed and still — context, not an alert
  useEffect(() => {
    const layers = faultLayersRef.current;
    if (!layers) return;

    FAULT_LAYER_KEYS.forEach((key) => layers[key].clearLayers());
    FAULT_SYSTEMS.forEach((fault) => {
      L.polyline(fault.coords, {
        color: MAP_PALETTE[theme].neutral,
        weight: 2.5,
        opacity: 0.85,
        dashArray: '8 6',
      })
        .addTo(layers[fault.layer])
        .bindPopup(
          popupHtml([
            `<strong class="${POPUP_TITLE}">${escapeHtml(fault.name)}</strong>`,
            metaRow(escapeHtml(fault.kind)),
            metaRow('Garis skematis untuk orientasi — bukan peta sesar resmi.'),
          ])
        );
    });
  }, [theme]);

  // 1c. Reactive Layer Toggles for Faults, Stations & Buoys
  useEffect(() => {
    const map = mapRef.current;
    const faultLayers = faultLayersRef.current;
    if (!map || !faultLayers) return;

    const toggle = (layer: L.LayerGroup | null, isActive: boolean) => {
      if (!layer) return;
      if (isActive) {
        if (!map.hasLayer(layer)) layer.addTo(map);
      } else if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };

    FAULT_LAYER_KEYS.forEach((key) => toggle(faultLayers[key], activeLayer[key]));
    toggle(stationLayerRef.current, activeLayer.stations);
    toggle(buoyLayerRef.current, activeLayer.buoys);
  }, [activeLayer]);

  // 2. Plot earthquakes: magnitude sets the size, age sets the strength, and
  //    only an event from the last 24 hours gets a tone colour
  useEffect(() => {
    const layer = quakeLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    const palette = MAP_PALETTE[theme];
    const nowMs = Date.now();

    const plot = (items: unknown[] | undefined, source: 'BMKG' | 'USGS') => {
      items?.forEach((item) => {
        const quake = readQuake(item);
        if (!quake) return;
        const { opacity, fresh } = ageEmphasis(quake.timestampMs, nowMs);
        const tone = fresh && !quake.seeded ? toneFromMagnitude(quake.magnitude ?? NaN) : null;
        const color = tone ? palette.tone[tone] : palette.neutral;

        L.circleMarker([quake.lat, quake.lon], {
          radius: quakeRadius(quake.magnitude),
          color,
          weight: 1.5,
          opacity,
          fillColor: color,
          // USGS is drawn as a ring so it stays readable over a BMKG report of the same event
          fillOpacity: (source === 'BMKG' ? 0.45 : 0.1) * opacity,
          dashArray: quake.seeded ? '3 3' : undefined,
        })
          .bindPopup(quakePopupHtml(quake, source, tone))
          .addTo(layer);
      });
    };

    const quakes = realQuakesRef.current;
    plot(quakes?.recent_usgs, 'USGS');
    plot(quakes?.recent_bmkg, 'BMKG');

    const detail = quakes?.latest_bmkg;
    const latest = detail ? readQuake(detail) : null;
    if (detail && latest) {
      const { fresh } = ageEmphasis(latest.timestampMs, nowMs);
      const tone = fresh && !latest.seeded ? toneFromMagnitude(latest.magnitude ?? NaN) : null;
      L.marker([latest.lat, latest.lon], {
        icon: latestQuakeIcon(latest, tone, emphasizeLatest && !latest.seeded),
        title: latest.seeded ? 'Data contoh gempa' : `Gempa terkini BMKG, ${magnitudeText(latest.magnitude)}`,
        zIndexOffset: 1000,
      })
        .bindPopup(latestQuakePopupHtml(detail, latest, tone))
        .addTo(layer);
    }
  }, [quakeSignature, theme, emphasizeLatest]);

  // 3. Plot the volcano catalogue with its PVMBG activity level
  useEffect(() => {
    const layer = volcanoLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    volcanoMarkersRef.current = [];
    if (!activeLayer.volcanoes) return;

    const reports = volcanoesRef.current;
    volcanoMarkersRef.current = INDONESIAN_VOLCANOES.map((volcano) => {
      // One source for the level on every surface: the catalogue. A report's own
      // `alert_level` is not a status PVMBG stated in that report.
      const level = parseVolcanoLevel(volcano.defaultLevel);
      const tone: Tone = level ? officialTone(level.level) : 'unknown';
      const reportCount = countEruptionReports(volcano, reports);
      const state = { volcano, level, tone, selected: false, reportCount };

      const marker = L.marker(volcano.pos, {
        icon: volcanoIcon(state),
        title: `G. ${volcano.name} — ${volcanoLevelText(level)} (katalog)${
          reportCount > 0 ? ` · ${reportCount} laporan erupsi` : ''
        } — buka panel gunung`,
        zIndexOffset: volcanoZIndex(tone, false),
      });

      // No popup: the page's volcano panel shows the picture, the report and the seismogram
      // in one place, so the marker only says which volcano was picked.
      marker.on('click', () => onSelectVolcanoRef.current?.(volcano.name));
      // Leaflet makes the icon focusable with role=button but only popups listen for keys.
      marker.on('keydown', (event: L.LeafletKeyboardEvent) => {
        const key = event.originalEvent.key;
        if (key !== 'Enter' && key !== ' ') return;
        event.originalEvent.preventDefault();
        onSelectVolcanoRef.current?.(volcano.name);
      });
      marker.addTo(layer);

      return { ...state, marker };
    });
  }, [volcanoSignature, activeLayer.volcanoes]);

  // 3a. Selection restyles markers in place
  useEffect(() => {
    volcanoMarkersRef.current.forEach((entry) => {
      const selected = isSelectedVolcano(entry.volcano, selectedVolcano);
      if (selected === entry.selected) return;
      entry.selected = selected;
      entry.marker.setIcon(volcanoIcon(entry));
      entry.marker.setZIndexOffset(volcanoZIndex(entry.tone, selected));
    });
  }, [selectedVolcano, volcanoSignature, activeLayer.volcanoes]);

  // 3.1 Ash fan for the selected volcano — a fixed illustration, never a forecast
  useEffect(() => {
    const layer = ashLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    if (!activeLayer.ash || !selectedVolcano || selectedVolcano === 'BMKG_REGIONAL') return;

    const geo = findVolcanoLocation(selectedVolcano);
    if (!geo) return;

    const ash = getVolcanicAshTrajectory(selectedVolcano);
    const [lat0, lon0] = geo.pos;

    // Fan polygon around the wind azimuth (0 = N, 90 = E, 180 = S, 270 = W)
    const centerAngle = ash.windDirectionDeg;
    const spread = ash.coneSpreadDeg || 45;
    const radiusKm = ash.hazardRadiusKm || 35;
    const radiusDegLat = radiusKm / 111; // 1 deg lat ~ 111 km
    const cosLat = Math.max(0.2, Math.cos((lat0 * Math.PI) / 180));
    const offset = (distanceDeg: number, angleDeg: number): [number, number] => {
      const rad = (angleDeg * Math.PI) / 180;
      return [lat0 + distanceDeg * Math.cos(rad), lon0 + (distanceDeg * Math.sin(rad)) / cosLat];
    };

    const steps = 16;
    const vertices: [number, number][] = [[lat0, lon0]];
    for (let i = 0; i <= steps; i++) {
      vertices.push(offset(radiusDegLat, centerAngle - spread / 2 + spread * (i / steps)));
    }

    const neutral = MAP_PALETTE[theme].neutral;
    const disclaimer = escapeHtml(ASH_TRAJECTORY_DISCLAIMER);
    L.polygon(vertices, {
      color: neutral,
      weight: 1.5,
      opacity: 0.9,
      dashArray: '6 4',
      fillColor: neutral,
      fillOpacity: 0.18,
    })
      .addTo(layer)
      .bindPopup(
        popupHtml(
          [
            `<span class="t-micro">Sebaran abu · ${disclaimer}</span>`,
            `<strong class="${POPUP_TITLE}">G. ${escapeHtml(geo.name)}</strong>`,
            metaRow(`Arah contoh: ${escapeHtml(ash.windDirectionCardinal)} (${ash.windDirectionDeg}°)`),
            metaRow(
              `Angin contoh: ${ash.windSpeedKts} knot (≈ ${Math.round(ash.windSpeedKts * 1.852)} km/jam)`
            ),
            metaRow(`Tinggi kolom contoh: ± ${ash.plumeHeightMeters.toLocaleString('id-ID')} m`),
            metaRow(`Jangkauan gambar: ${radiusKm} km`),
            metaRow('Nilai tetap untuk ilustrasi, bukan prakiraan. Informasi abu resmi: VONA di MAGMA Indonesia (PVMBG).'),
          ],
          'min-w-[230px]'
        )
      );

    // The disclaimer sits on the map itself, not only behind a click
    L.marker(offset(radiusDegLat * 0.6, centerAngle), {
      icon: L.divIcon({
        className: 'ash-wind-arrow',
        html: `<div style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);pointer-events:none;${MAP_LABEL_STYLE}border:1px dashed var(--border-strong);">Abu · ${disclaimer}</div>`,
        iconSize: [0, 0],
      }),
      interactive: false,
      zIndexOffset: 700,
    }).addTo(layer);
  }, [selectedVolcano, activeLayer.ash, theme]);

  // 4. Handle volcano selection camera flyTo: the marker is brought to the middle of the
  //    part of the map the HUD and the volcano panel leave open. It flies when another
  //    volcano is picked, and again when a panel opens over the one already picked (the
  //    marker would otherwise sit underneath it) — never when a panel merely closes, which
  //    would pull the map back from wherever the user has moved it since.
  const { top: insetTop, right: insetRight, bottom: insetBottom = 0 } = viewInsets;
  useEffect(() => {
    const previous = lastFlightRef.current;
    const selectionChanged = previous.name !== selectedVolcano;
    const coveredMore = insetRight > previous.right || insetBottom > previous.bottom;
    lastFlightRef.current = { name: selectedVolcano, right: insetRight, bottom: insetBottom };

    const map = mapRef.current;
    const geo = selectedVolcano ? findVolcanoLocation(selectedVolcano) : null;
    if (!map || !geo || (!selectionChanged && !coveredMore)) return;

    const insets = { top: insetTop, right: insetRight, bottom: insetBottom };
    // A panel that opens while the flight to its volcano is still under way (its height is only
    // known a frame later) re-aims that flight. Otherwise only a marker on screen and now
    // underneath the panel is brought back into view; one the reader has moved away from stays.
    const stillFlying = flyingToRef.current === geo.name;
    if (!selectionChanged && !stillFlying) {
      // A panel opened over the map. Only a marker that is on screen and now underneath it
      // is brought back into view; one the user has scrolled away from is left alone.
      const point = map.latLngToContainerPoint(geo.pos);
      const size = map.getSize();
      const onScreen = point.x >= 0 && point.x <= size.x && point.y >= 0 && point.y <= size.y;
      const inOpenArea =
        point.x <= size.x - insetRight && point.y >= insetTop && point.y <= size.y - bottomInset(map, insets);
      if (!onScreen || inOpenArea) return;
    }

    // Whatever popup is open belongs to something else and would be left behind by the flight.
    map.closePopup();
    overviewRef.current = false;
    flyingToRef.current = geo.name;
    map.once('moveend', () => {
      if (flyingToRef.current === geo.name) flyingToRef.current = null;
    });
    map.flyTo(centerInOpenArea(map, geo.pos, 8, insets), 8, { animate: true, duration: 1.2 });
  }, [selectedVolcano, insetTop, insetRight, insetBottom]);

  // 4b. Keep the HUD's footprint current: refit an untouched overview, and tell Leaflet's
  //     popups where the open part of the map is so auto-pan stops short of the masthead.
  useEffect(() => {
    insetsRef.current = viewInsets;
    // Shared by every popup on the page's one map; instances read these through the prototype.
    L.Popup.mergeOptions({
      autoPanPaddingTopLeft: L.point(12, viewInsets.top + 12),
      autoPanPaddingBottomRight: L.point(viewInsets.right + 12, (viewInsets.bottom ?? 0) + 12),
    });
    const map = mapRef.current;
    if (map && overviewRef.current) {
      map.fitBounds(INDONESIA_BOUNDS, { animate: false, ...insetPadding(map, viewInsets) });
    }
  }, [viewInsets]);

  // 5. Handle external focus request (from LatestQuakeCard / OceanPanel)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCoords) return;
    overviewRef.current = false;
    map.flyTo(centerInOpenArea(map, [focusCoords.lat, focusCoords.lon], 9, insetsRef.current), 9, {
      animate: true,
      duration: 1.5,
    });
  }, [focusCoords]);

  // 6. Drill overlay: scenario epicentre, coastal zones from the drill table and
  //    decorative wavefronts. Everything here is simulation and says so.
  useEffect(() => {
    const layer = drillLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;

    layer.clearLayers();
    if (!drill) {
      lastDrillIdRef.current = null;
      return;
    }

    if (lastDrillIdRef.current !== drill.id) {
      lastDrillIdRef.current = drill.id;
      overviewRef.current = false;
      map.flyTo(centerInOpenArea(map, [drill.lat, drill.lon], 6, insetsRef.current), 6, {
        animate: true,
        duration: 1.3,
      });
    }

    // Before the mainshock there is nothing to draw: an epicentre shown in advance would read as a prediction
    if (!mainshockOccurred) return;

    const palette = MAP_PALETTE[theme];
    const epicenter: [number, number] = [drill.lat, drill.lon];
    const magScale = Math.max(0.85, (drill.magnitude - 6.2) * 0.55);
    const waveFactor = tsunamiActive ? Math.max(1.15, (drill.waveHeight ?? drill.tsunamiHeight) / 10) : 0.75;

    // Source area, in drill violet: simulation chrome, not a severity colour
    L.circle(epicenter, {
      radius: 75000 * magScale,
      color: palette.drill,
      weight: 2,
      opacity: 0.9,
      dashArray: '6 6',
      fillColor: palette.drill,
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(layer);

    // findDrillScenario falls back to the first scenario; never draw its coast for another epicentre
    const scenario = findDrillScenario(drill.id);
    const zones = tsunamiActive && scenario.id === drill.id ? scenario.zones : [];
    zones.forEach((zone, arrivalOrder) => {
      const position: [number, number] = [zone.lat, zone.lon];
      const zoneColor = palette.tone[drillZoneTone(zone)];

      L.circle(position, {
        radius: 24000,
        color: zoneColor,
        weight: 1.5,
        opacity: 0.9,
        fillColor: zoneColor,
        fillOpacity: 0.22,
        interactive: false,
      }).addTo(layer);

      L.polyline([epicenter, position], {
        color: palette.drill,
        weight: 2,
        opacity: 0.8,
        dashArray: '10, 6',
        className: 'tsunami-ray-flow',
        interactive: false,
      }).addTo(layer);

      L.marker(position, {
        icon: drillZoneIcon(zone, arrivalOrder),
        title: `${zone.name} — nilai latihan`,
        zIndexOffset: 820,
      })
        .bindPopup(drillZonePopupHtml(zone))
        .addTo(layer);
    });

    L.marker(epicenter, {
      icon: L.divIcon({
        className: '',
        html: '<div class="drill-epicenter-ping"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      title: 'Episenter skenario (simulasi)',
      zIndexOffset: 900,
    })
      .bindPopup(drillEpicenterPopupHtml(drill, drillPhaseLabel, tsunamiActive))
      .addTo(layer);

    // The moving wavefronts are decoration; the static overlay above carries the information
    if (prefersReducedMotion()) return;

    const ring = (weight: number, dashArray?: string) =>
      L.circle(epicenter, {
        radius: 20000,
        color: palette.drill,
        weight,
        opacity: 0.8,
        dashArray,
        fillColor: palette.drill,
        fillOpacity: 0.04,
        interactive: false,
      }).addTo(layer);

    const pWaveCircle = ring(1.6, '6 6');
    const sWaveCircle = ring(2, '4 4');
    const tsunamiWaveRings = tsunamiActive ? [0, 1, 2].map(() => ring(2.5)) : [];

    const startTime = performance.now();
    let lastFrameTime = 0;
    let rafId = 0;
    const animateWavefronts = (now: number) => {
      if (!document.hidden && now - lastFrameTime >= 36) {
        lastFrameTime = now;
        const elapsed = now - startTime;

        // Fast body waves (P & S)
        const pPhase = (elapsed % 2400) / 2400;
        const sPhase = ((elapsed + 900) % 2800) / 2800;
        pWaveCircle.setRadius(25000 + pPhase * 420000 * magScale);
        pWaveCircle.setStyle({ opacity: Math.max(0.05, 0.78 * (1 - pPhase)) });

        sWaveCircle.setRadius(18000 + sPhase * 280000 * magScale);
        sWaveCircle.setStyle({ opacity: Math.max(0.08, 0.82 * (1 - sPhase)) });

        // Staggered ocean crests
        tsunamiWaveRings.forEach((crest, idx) => {
          const crestPhase = (elapsed / 3600 + idx / 3) % 1;
          const maxRadius = 350000 * magScale * Math.min(1.35, waveFactor);
          crest.setRadius(22000 + crestPhase * maxRadius);
          crest.setStyle({
            opacity: Math.max(0.05, 0.9 * (1 - crestPhase)),
            fillOpacity: Math.max(0.01, 0.14 * (1 - crestPhase)),
            weight: Math.max(1.0, 3.0 * (1 - crestPhase * 0.6)),
          });
        });
      }
      rafId = requestAnimationFrame(animateWavefronts);
    };
    rafId = requestAnimationFrame(animateWavefronts);

    return () => cancelAnimationFrame(rafId);
    // Keyed on the scenario's values, not the object: the parent may hand over an
    // equal object on any render, and restarting here restarts the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    drill?.id,
    drill?.name,
    drill?.faultZone,
    drill?.magnitude,
    drill?.depth,
    drill?.lat,
    drill?.lon,
    drill?.tsunamiHeight,
    drill?.waveHeight,
    tsunamiActive,
    mainshockOccurred,
    drillPhaseLabel,
    theme,
  ]);

  const handleResetOverview = () => {
    const map = mapRef.current;
    if (!map) return;
    overviewRef.current = true;
    map.flyToBounds(INDONESIA_BOUNDS, { duration: 1.2, ...insetPadding(map, insetsRef.current) });
  };

  const activeLayerCount = LAYER_ROWS.filter((row) => activeLayer[row.key]).length;
  const allLayersActive = activeLayerCount === LAYER_ROWS.length;

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-[var(--surface-canvas)] ${className}`}
    >
      {/* Floating map controls (clear of the top strip and the right inspector) */}
      <div
        data-map-control="reset"
        className={`pointer-events-none absolute z-[900] flex items-center gap-2 ${
          floatingHud ? 'bottom-8 right-3 lg:right-[396px]' : 'right-3 top-3'
        }`}
      >
        <div
          title="Koordinat kursor"
          className="hud-solid t-data pointer-events-auto hidden rounded-full px-3 py-1 text-[var(--text-secondary)] sm:block"
        >
          {cursorCoords ?? '—'}
        </div>
        <button
          type="button"
          onClick={handleResetOverview}
          aria-label="Kembalikan peta ke seluruh Indonesia"
          title="Kembalikan peta ke seluruh Indonesia"
          className="hud-solid t-meta pointer-events-auto inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]"
        >
          <RotateCcw className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
          <span className="hidden sm:inline">Reset peta</span>
        </button>
      </div>

      {/* Leaflet DOM container */}
      <div
        ref={mapContainerRef}
        className="relative z-[1] h-full min-h-[380px] w-full"
      />

      {/* Above the map, below the controls: a cropped screenshot of a drill still says what it is */}
      {isSimulasi && <div className="drill-watermark z-[2]" aria-hidden="true" />}

      {/* Layer toggles and the map key behind "?" (clear of the bottom seismograph dock) */}
      <div
        ref={layersControlRef}
        data-map-control="layers"
        className={`hud-solid absolute z-[900] flex flex-col rounded-2xl p-2 ${
          floatingHud
            ? 'bottom-3 left-3 max-h-[calc(100%-var(--map-controls-top)-156px)] lg:bottom-[var(--map-dock-clearance,192px)] lg:left-4 lg:max-h-[calc(100%-var(--map-controls-top)-var(--map-dock-clearance,192px)-144px)]'
            : 'bottom-3 left-3 max-h-[calc(100%-24px)]'
        } ${isKeyOpen ? 'w-[300px] max-w-[calc(100%-24px)]' : isLegendCollapsed ? 'w-auto' : 'w-[272px] max-w-[calc(100%-24px)]'}`}
      >
        {isKeyOpen ? (
          <MapKey isSimulasi={isSimulasi} onClose={() => setIsKeyOpen(false)} />
        ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="t-micro flex items-center gap-1.5 pl-1 text-[var(--text-primary)]">
            <Layers className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
            <span>Lapisan peta</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              title={`${activeLayerCount} dari ${LAYER_ROWS.length} lapisan tampil`}
              className="t-data rounded bg-[var(--surface-2)] px-1.5 text-[var(--text-secondary)]"
            >
              {activeLayerCount}/{LAYER_ROWS.length}
            </span>
            <button
              type="button"
              onClick={() => setIsKeyOpen(true)}
              aria-expanded={false}
              aria-controls="map-key"
              aria-label="Cara membaca peta"
              title="Cara membaca peta"
              className="icon-btn"
            >
              <CircleHelp className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setIsLegendCollapsed((collapsed) => !collapsed)}
              aria-expanded={!isLegendCollapsed}
              aria-controls="map-layer-panel"
              aria-label={isLegendCollapsed ? 'Buka daftar lapisan peta' : 'Ciutkan daftar lapisan peta'}
              className="icon-btn"
            >
              {isLegendCollapsed ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        )}

        {!isKeyOpen && !isLegendCollapsed && (
          <div
            id="map-layer-panel"
            className="mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto border-t border-[var(--border-hairline)] pt-2"
          >
            <button
              type="button"
              aria-pressed={allLayersActive}
              onClick={() => setActiveLayer(allLayers(!allLayersActive))}
              title={allLayersActive ? 'Sembunyikan semua lapisan' : 'Tampilkan semua lapisan'}
              className="t-meta flex min-h-8 shrink-0 items-center justify-between gap-2 rounded-lg px-2 text-left font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <span>Semua lapisan</span>
              <LayerVisibility shown={allLayersActive} />
            </button>
            {LAYER_ROWS.map((row) => {
              const active = activeLayer[row.key];
              return (
                <button
                  key={row.key}
                  type="button"
                  aria-pressed={active}
                  title={active ? `Sembunyikan ${row.label}` : `Tampilkan ${row.label}`}
                  onClick={() => setActiveLayer((layers) => ({ ...layers, [row.key]: !layers[row.key] }))}
                  className={`t-meta flex min-h-8 shrink-0 items-center justify-between gap-2 rounded-lg px-2 text-left transition-colors hover:bg-[var(--surface-2)] ${
                    active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <LayerSwatch kind={row.swatch} />
                    <span className="truncate font-medium">{row.label}</span>
                  </span>
                  <LayerVisibility shown={active} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
