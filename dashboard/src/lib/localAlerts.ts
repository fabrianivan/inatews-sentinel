/**
 * Decides what the reader is notified about, given where they are.
 *
 * Three kinds of event qualify, each from a named source and never from the dashboard's
 * own judgement:
 *
 *   tsunami   BMKG's tsunami-potential statement is in force — always, wherever it is
 *   quake     a BMKG earthquake within the chosen radius, published in the last hour
 *   volcano   a MAGMA eruption report for a volcano within the radius
 *
 * A notification states the fact and its distance; it gives no instruction, no arrival
 * time and no all-clear. The location is used here, in the browser, and nowhere else.
 * Everything in this module is pure: the hook that calls it owns permissions, storage and
 * the clock.
 */

import { shortRegion } from './attention';
import { findPlace } from './places';
import {
  bearingDegrees,
  compassDirection,
  describeOffset,
  distanceKm,
  formatDistance,
  isGeoPoint,
  parseLatLon,
  type GeoPoint,
} from './proximity';
import { formatDecimal, formatWibTime, toMillis } from './time';
import { isNoticeInForce, isSameQuake, quakeKey, type TsunamiNotice } from './tsunamiNotice';
import type { BMKGGempaDetail, SeismicEvent, VolcanoEruption } from './types';
import { findVolcanoLocation } from './volcanoData';

export const RADIUS_OPTIONS_KM = [100, 300, 500, 1000] as const;

export interface LocalAlertSettings {
  enabled: boolean;
  /** Earthquakes and eruptions farther than this from the reader are not notified. */
  radiusKm: number;
  quakes: boolean;
  volcanoes: boolean;
  /**
   * A city the reader chose as their location (an id from `lib/places`), used instead of the
   * browser's position — for a browser that will not give one, or a reader who prefers not to.
   * Null means "ask the browser".
   */
  placeId: string | null;
}

export const DEFAULT_ALERT_SETTINGS: LocalAlertSettings = {
  enabled: false,
  radiusKm: 300,
  quakes: true,
  volcanoes: true,
  placeId: null,
};

export type LocalAlertKind = 'tsunami' | 'quake' | 'volcano';

export interface LocalAlert {
  /** One notification per id, ever. */
  id: string;
  kind: LocalAlertKind;
  title: string;
  body: string;
  /** Stays on screen until dismissed. */
  sticky: boolean;
  /** Time of the event itself (epoch ms). */
  atMs: number;
  /** Distance from the reader, when their location is known. */
  distanceKm: number | null;
  /** Where the event is, so a pop-up can show it on the map. */
  point?: GeoPoint;
  /** Catalogue name, for an eruption: the pop-up opens that volcano's panel. */
  volcanoName?: string;
  /** Alerts sharing a key are held to one per `VOLCANO_QUIET_MS`. */
  throttleKey?: string;
}

export interface LocalAlertInput {
  /** Where the reader is, or null when they have not shared it. */
  location: GeoPoint | null;
  /**
   * How the location is named in the text: a chosen city's name, so a distance is never
   * presented as measured from the reader when it was measured from a city centre.
   * Defaults to "lokasi Anda" (the browser's position).
   */
  locationName?: string | null;
  settings: LocalAlertSettings;
  nowMs: number;
  latest: BMKGGempaDetail | null;
  recent: SeismicEvent[];
  notice: TsunamiNotice | null;
  volcanoReports: VolcanoEruption[];
}

/** An earthquake older than this is news, not an alert. */
export const QUAKE_FRESH_MS = 60 * 60 * 1000;
/** MAGMA files reports some minutes after the eruption, so the window is a little wider. */
export const VOLCANO_FRESH_MS = 2 * 60 * 60 * 1000;
/** An erupting volcano files a report every half hour or so; one notification per volcano in this time. */
export const VOLCANO_QUIET_MS = 6 * 60 * 60 * 1000;
/** Tolerance for an event stamped slightly ahead of this clock. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function isFresh(atMs: number | null, nowMs: number, windowMs: number): atMs is number {
  return atMs !== null && nowMs - atMs <= windowMs && atMs - nowMs <= CLOCK_SKEW_MS;
}

interface QuakeCandidate {
  key: string;
  magnitude: number;
  depth: string;
  region: string;
  originMs: number;
  point: GeoPoint;
  /** BMKG's "Potensi" text, verbatim. */
  remark: string;
  /** BMKG's "Dirasakan" text, verbatim. */
  felt: string;
}

/** Real BMKG earthquakes with a usable time, magnitude and position; the latest report is not repeated from the list. */
function quakeCandidates(latest: BMKGGempaDetail | null, recent: SeismicEvent[]): QuakeCandidate[] {
  const candidates: QuakeCandidate[] = [];
  const realLatest = latest && !latest.seeded ? latest : null;

  if (realLatest) {
    const point = parseLatLon(realLatest.Coordinates);
    const originMs = toMillis(realLatest.DateTime);
    const magnitude = parseFloat(realLatest.Magnitude);
    if (point && originMs !== null && Number.isFinite(magnitude) && magnitude > 0) {
      candidates.push({
        key: quakeKey(realLatest),
        magnitude,
        depth: (realLatest.Kedalaman || '').trim(),
        region: realLatest.Wilayah || '',
        originMs,
        point,
        remark: (realLatest.Potensi || '').trim(),
        felt: (realLatest.Dirasakan || '').trim(),
      });
    }
  }

  for (const event of recent || []) {
    if (event.seeded) continue;
    const point = { lat: event.latitude, lon: event.longitude };
    const originMs = toMillis(event.timestamp);
    if (!isGeoPoint(point) || originMs === null || !Number.isFinite(event.magnitude) || event.magnitude <= 0) continue;
    const identity = { DateTime: event.timestamp, Coordinates: `${event.latitude},${event.longitude}` };
    if (realLatest && isSameQuake(realLatest, identity)) continue;
    candidates.push({
      key: quakeKey(identity),
      magnitude: event.magnitude,
      depth: Number.isFinite(event.depth) && event.depth > 0 ? `${Math.round(event.depth)} km` : '',
      region: event.fault_zone || '',
      originMs,
      point,
      remark: (event.potensi || '').trim(),
      felt: '',
    });
  }
  return candidates;
}

function quakeAlert(quake: QuakeCandidate, location: GeoPoint, where: string): LocalAlert {
  const km = distanceKm(location, quake.point);
  const details = [
    km >= 10 ? `Di ${compassDirection(bearingDegrees(location, quake.point))} ${where}` : null,
    shortRegion(quake.region, 70),
    quake.depth ? `kedalaman ${quake.depth}` : null,
    formatWibTime(quake.originMs, { seconds: false }),
  ].filter(Boolean);
  const notes = [
    quake.remark ? `BMKG: “${quake.remark}”.` : null,
    quake.felt ? `Dirasakan (MMI): ${quake.felt}.` : null,
  ].filter(Boolean);
  return {
    id: `quake:${quake.key}`,
    kind: 'quake',
    title: `Gempa M${formatDecimal(quake.magnitude)} — ${formatDistance(km)} dari ${where}`,
    body: [`${details.join(' · ')}.`, ...notes].join(' '),
    sticky: false,
    atMs: quake.originMs,
    distanceKm: km,
    point: quake.point,
  };
}

function tsunamiAlert(notice: TsunamiNotice, location: GeoPoint | null, where: string): LocalAlert {
  const magnitude = parseFloat(notice.quake.Magnitude);
  const point = parseLatLon(notice.quake.Coordinates);
  const offset = location && point ? `Episenter ${describeOffset(location, point, where)}. ` : '';
  return {
    id: `tsunami:${notice.key}`,
    kind: 'tsunami',
    title: `BMKG: berpotensi tsunami${Number.isFinite(magnitude) ? ` — gempa M${formatDecimal(magnitude)}` : ''}`,
    body: `${shortRegion(notice.quake.Wilayah, 70)}. ${offset}Status per wilayah dan waktu tiba hanya ada di BMKG.`,
    sticky: true,
    atMs: notice.originMs ?? notice.firstSeenMs,
    distanceKm: location && point ? distanceKm(location, point) : null,
    ...(point ? { point } : {}),
  };
}

/**
 * The first sentence of MAGMA's report text, which says what happened and when. A full stop
 * after a single letter is an abbreviation ("G. Semeru"), not the end of the sentence.
 */
function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  let sentence = clean;
  for (const match of clean.matchAll(/[.!?](?=\s|$)/g)) {
    const before = clean.slice(0, match.index);
    if (/(?:^|\s)[A-Za-z]$/.test(before)) continue;
    sentence = clean.slice(0, match.index + 1);
    break;
  }
  return sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}…` : sentence;
}

/**
 * Every alert that applies right now, most urgent first. Whether the reader has already
 * been told about one is not this function's business — see `takeNewAlerts`.
 */
export function collectLocalAlerts(input: LocalAlertInput): LocalAlert[] {
  const { location, settings, nowMs } = input;
  if (!settings.enabled) return [];
  const where = input.locationName || 'lokasi Anda';
  const alerts: LocalAlert[] = [];

  if (isNoticeInForce(input.notice)) alerts.push(tsunamiAlert(input.notice, location, where));

  // Distance is the whole test for the other two: without a location nothing can be judged near.
  if (location && settings.quakes) {
    for (const quake of quakeCandidates(input.latest, input.recent)) {
      if (!isFresh(quake.originMs, nowMs, QUAKE_FRESH_MS)) continue;
      if (distanceKm(location, quake.point) > settings.radiusKm) continue;
      alerts.push(quakeAlert(quake, location, where));
    }
  }

  if (location && settings.volcanoes) {
    for (const report of input.volcanoReports || []) {
      if (report.source === 'SEEDED') continue;
      const reportedMs = toMillis(report.timestamp);
      if (!isFresh(reportedMs, nowMs, VOLCANO_FRESH_MS)) continue;
      const volcano = findVolcanoLocation(report.volcano_name);
      if (!volcano) continue;
      const point = { lat: volcano.pos[0], lon: volcano.pos[1] };
      const km = distanceKm(location, point);
      if (km > settings.radiusKm) continue;
      alerts.push({
        id: `volcano:${report.id}`,
        kind: 'volcano',
        title: `Erupsi G. ${volcano.name} — ${formatDistance(km)} dari ${where}`,
        body: `${firstSentence(report.description)} Sumber: MAGMA PVMBG.`,
        sticky: false,
        atMs: reportedMs,
        distanceKm: km,
        point,
        volcanoName: volcano.name,
        throttleKey: `volcano:${volcano.name}`,
      });
    }
  }

  const urgency: Record<LocalAlertKind, number> = { tsunami: 0, quake: 1, volcano: 2 };
  return alerts.sort((a, b) => urgency[a.kind] - urgency[b.kind] || b.atMs - a.atMs);
}

// ---------------------------------------------------------------------------
// What has already been notified
// ---------------------------------------------------------------------------

export interface AlertLedger {
  /** Alert id → when it was handled (epoch ms). */
  seen: Record<string, number>;
  /** Throttle key → when it last produced a notification (epoch ms). */
  lastByKey: Record<string, number>;
}

export const EMPTY_LEDGER: AlertLedger = { seen: {}, lastByKey: {} };

/** Entries older than this can no longer match a fresh event and are dropped. */
const LEDGER_KEEP_MS = 48 * 60 * 60 * 1000;

function prune(entries: Record<string, number>, nowMs: number): Record<string, number> {
  return Object.fromEntries(Object.entries(entries).filter(([, atMs]) => nowMs - atMs <= LEDGER_KEEP_MS));
}

/**
 * Splits off the alerts the reader has not been told about, and records them as told.
 *
 * `baseline: true` is for the moment notifications are switched on: what is already on the
 * feed is recorded without a notification — a burst about the past hour is not what the
 * reader asked for — except a tsunami statement in force, which is always delivered.
 */
export function takeNewAlerts(
  alerts: LocalAlert[],
  ledger: AlertLedger,
  nowMs: number,
  options: { baseline?: boolean } = {}
): { fresh: LocalAlert[]; ledger: AlertLedger } {
  const seen = prune(ledger.seen, nowMs);
  const lastByKey = prune(ledger.lastByKey, nowMs);
  const fresh: LocalAlert[] = [];

  // Newest first, so a throttled group is represented by its latest member.
  for (const alert of [...alerts].sort((a, b) => b.atMs - a.atMs)) {
    if (seen[alert.id] !== undefined) continue;
    seen[alert.id] = nowMs;
    if (options.baseline && alert.kind !== 'tsunami') {
      if (alert.throttleKey) lastByKey[alert.throttleKey] = Math.max(lastByKey[alert.throttleKey] ?? 0, alert.atMs);
      continue;
    }
    if (alert.throttleKey) {
      const last = lastByKey[alert.throttleKey];
      if (last !== undefined && nowMs - last < VOLCANO_QUIET_MS) continue;
      lastByKey[alert.throttleKey] = nowMs;
    }
    fresh.push(alert);
  }

  const urgency: Record<LocalAlertKind, number> = { tsunami: 0, quake: 1, volcano: 2 };
  fresh.sort((a, b) => urgency[a.kind] - urgency[b.kind] || b.atMs - a.atMs);
  return { fresh, ledger: { seen, lastByKey } };
}

// ---------------------------------------------------------------------------
// Stored state (localStorage hands back strings of unknown shape)
// ---------------------------------------------------------------------------

function numberRecord(value: unknown): Record<string, number> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])
    )
  );
}

export function parseLedger(json: string | null | undefined): AlertLedger {
  try {
    const value: unknown = JSON.parse(json ?? '');
    if (value === null || typeof value !== 'object') return EMPTY_LEDGER;
    const record = value as Record<string, unknown>;
    return { seen: numberRecord(record.seen), lastByKey: numberRecord(record.lastByKey) };
  } catch {
    return EMPTY_LEDGER;
  }
}

export function parseAlertSettings(json: string | null | undefined): LocalAlertSettings {
  try {
    const value: unknown = JSON.parse(json ?? '');
    if (value === null || typeof value !== 'object') return DEFAULT_ALERT_SETTINGS;
    const record = value as Record<string, unknown>;
    const radius = RADIUS_OPTIONS_KM.find((option) => option === record.radiusKm);
    // A city that is no longer offered falls back to asking the browser.
    const place = typeof record.placeId === 'string' ? findPlace(record.placeId) : null;
    return {
      enabled: record.enabled === true,
      radiusKm: radius ?? DEFAULT_ALERT_SETTINGS.radiusKm,
      quakes: record.quakes !== false,
      volcanoes: record.volcanoes !== false,
      placeId: place?.id ?? null,
    };
  } catch {
    return DEFAULT_ALERT_SETTINGS;
  }
}

// ---------------------------------------------------------------------------
// The browser notification, and where a click on it leads
// ---------------------------------------------------------------------------

/** Where a click on a notification leads on the dashboard. */
export interface NotificationTarget {
  kind: LocalAlertKind | 'test';
  point?: GeoPoint;
  /** Catalogue name: the click opens that volcano's panel. */
  volcanoName?: string;
}

/** The official pages a notification links to; the service worker opens no other site. */
export const OFFICIAL_SOURCE_URL = {
  bmkg: 'https://www.bmkg.go.id/gempabumi',
  magma: 'https://magma.esdm.go.id',
} as const;

export const NOTIFICATION_ICON = '/notification-icon.png';

export interface BrowserNotification {
  title: string;
  options: {
    body: string;
    /** One notification per event: a repeat replaces it instead of stacking. */
    tag: string;
    lang: 'id';
    icon: string;
    /** Stays until dismissed (a tsunami statement). */
    requireInteraction: boolean;
    /** The event's own time, which the browser shows. */
    timestamp: number;
    data: { url: string; sourceUrl: string | null; target: NotificationTarget };
    /** Buttons on the notification (where the browser shows them). */
    actions: { action: 'peta' | 'sumber'; title: string }[];
  };
}

/** The dashboard address that shows `target` — what the service worker opens when no dashboard tab is left. */
export function targetUrl(target: NotificationTarget): string {
  const params = new URLSearchParams();
  if (target.kind === 'volcano' && target.volcanoName) {
    params.set('lihat', 'gunung');
    params.set('nama', target.volcanoName);
  } else if (target.point) {
    params.set('lihat', 'peta');
    params.set('lat', target.point.lat.toFixed(3));
    params.set('lon', target.point.lon.toFixed(3));
  } else {
    params.set('lihat', 'notifikasi');
  }
  return `/?${params.toString()}`;
}

function finiteParam(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Reads a target back from a dashboard address (`location.search`); anything malformed is ignored. */
export function targetFromSearch(search: string): NotificationTarget | null {
  const params = new URLSearchParams(search);
  switch (params.get('lihat')) {
    case 'gunung': {
      const name = (params.get('nama') ?? '').trim();
      const volcano = name ? findVolcanoLocation(name) : null;
      // Only a catalogue volcano, by its own name — never a near match.
      return volcano && volcano.name.toLowerCase() === name.toLowerCase()
        ? { kind: 'volcano', volcanoName: volcano.name }
        : null;
    }
    case 'peta': {
      const lat = finiteParam(params, 'lat');
      const lon = finiteParam(params, 'lon');
      const point = lat !== null && lon !== null ? { lat, lon } : null;
      return point && isGeoPoint(point) ? { kind: 'quake', point } : null;
    }
    case 'notifikasi':
      return { kind: 'test' };
    default:
      return null;
  }
}

/** What the browser is asked to show for an alert: its words, its event time, and where a click leads. */
export function browserNotification(alert: LocalAlert): BrowserNotification {
  const isTest = alert.id.startsWith('test:');
  const target: NotificationTarget = isTest
    ? { kind: 'test' }
    : {
        kind: alert.kind,
        ...(alert.point ? { point: alert.point } : {}),
        ...(alert.volcanoName ? { volcanoName: alert.volcanoName } : {}),
      };
  const sourceUrl = isTest ? null : alert.kind === 'volcano' ? OFFICIAL_SOURCE_URL.magma : OFFICIAL_SOURCE_URL.bmkg;
  return {
    title: alert.title,
    options: {
      body: alert.body,
      tag: alert.id,
      lang: 'id',
      icon: NOTIFICATION_ICON,
      requireInteraction: alert.sticky,
      timestamp: alert.atMs,
      data: { url: targetUrl(target), sourceUrl, target },
      actions: isTest
        ? []
        : [
            { action: 'peta', title: alert.kind === 'volcano' ? 'Buka gunung di peta' : 'Lihat di peta' },
            { action: 'sumber', title: alert.kind === 'volcano' ? 'Buka MAGMA' : 'Buka BMKG' },
          ],
    },
  };
}

/** A click target as a message hands it over, checked: only known kinds, a real position, a short name. */
export function parseNotificationTarget(value: unknown): NotificationTarget | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const kinds: NotificationTarget['kind'][] = ['tsunami', 'quake', 'volcano', 'test'];
  const kind = kinds.find((item) => item === record.kind);
  if (!kind) return null;
  const target: NotificationTarget = { kind };
  if (isGeoPoint(record.point)) target.point = { lat: record.point.lat, lon: record.point.lon };
  if (typeof record.volcanoName === 'string' && record.volcanoName.length <= 60) {
    const volcano = findVolcanoLocation(record.volcanoName);
    if (volcano) target.volcanoName = volcano.name;
  }
  return target;
}

/** A pushed notification as the service worker reports it to an open tab, checked like the target. */
export function parsePushedAlert(value: unknown): LocalAlert | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const kinds: LocalAlertKind[] = ['tsunami', 'quake', 'volcano'];
  const kind = kinds.find((item) => item === record.kind);
  if (
    !kind ||
    typeof record.id !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.body !== 'string' ||
    typeof record.atMs !== 'number' ||
    !Number.isFinite(record.atMs)
  ) {
    return null;
  }
  return {
    id: record.id.slice(0, 200),
    kind,
    title: record.title.slice(0, 200),
    body: record.body.slice(0, 600),
    sticky: kind === 'tsunami',
    atMs: record.atMs,
    distanceKm: null,
  };
}
