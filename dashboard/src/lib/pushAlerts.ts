/**
 * Web Push: the notifications that still arrive when no dashboard tab is open.
 *
 * The browser subscribes with its push service (Google, Mozilla, Apple, Microsoft) and hands
 * the dashboard's server an address there. The server keeps that address with the reader's
 * notification settings, checks the BMKG and MAGMA feeds on its own, and sends what
 * `collectLocalAlerts` decides — the same rules as in the open tab.
 *
 * What the server keeps about a reader is only what that needs: the push address, the radius
 * and kinds, and a location that is either a city from `lib/places` or the browser's position
 * rounded to a quarter degree (±20 km). Nothing else, and it is deleted when the reader
 * switches notifications off.
 *
 * Everything in this module is pure; storage, the clock and the network are the caller's.
 */

import {
  RADIUS_OPTIONS_KM,
  browserNotification,
  collectLocalAlerts,
  takeNewAlerts,
  type AlertLedger,
  type LocalAlert,
  type LocalAlertSettings,
} from './localAlerts';
import { findPlace } from './places';
import { isGeoPoint, type GeoPoint } from './proximity';
import type { TsunamiNotice } from './tsunamiNotice';
import type { BMKGGempaDetail, SeismicEvent, VolcanoEruption } from './types';

/** Positions sent for push are rounded to this many degrees (about ±20 km at the equator). */
export const PUSH_LOCATION_STEP_DEG = 0.25;
/** A server keeps at most this many subscriptions; more are refused rather than evicted. */
export const MAX_PUSH_SUBSCRIPTIONS = 2000;
/** Push services take up to 4 KB; the message is kept well under it. */
export const MAX_PUSH_PAYLOAD_BYTES = 3000;

/**
 * Hosts of the browsers' own push services. The server sends only there, so a subscription
 * can never make it call an address of the submitter's choosing.
 */
const PUSH_SERVICE_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^(?:[a-z0-9-]+\.)*push\.apple\.com$/,
  /^(?:[a-z0-9-]+\.)*notify\.windows\.com$/,
];

export interface PushKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: PushKeys;
}

/** The settings the server needs to decide what to send to one browser. */
export interface PushSettings {
  radiusKm: number;
  quakes: boolean;
  volcanoes: boolean;
  /** A city from `lib/places`; it wins over `point`. */
  placeId: string | null;
  /** The browser's position, rounded (see `roundForPush`); null when unknown. */
  point: GeoPoint | null;
}

/** What the server stores for one subscribed browser. */
export interface PushRecord {
  subscription: PushSubscriptionData;
  settings: PushSettings;
  /** What has been sent already (see `takeNewAlerts`). */
  ledger: AlertLedger;
  /** Events already on the feed when the settings were last set are recorded, not sent. */
  baseline: boolean;
  createdAt: number;
  updatedAt: number;
}

/** A request to subscribe, or to move a renewed subscription over to its replacement. */
export type SubscribeRequest =
  | { subscription: PushSubscriptionData; settings: PushSettings; replaces?: undefined }
  | { subscription: PushSubscriptionData; settings?: undefined; replaces: string };

export function roundForPush(point: GeoPoint): GeoPoint {
  const round = (value: number) => Math.round(value / PUSH_LOCATION_STEP_DEG) * PUSH_LOCATION_STEP_DEG;
  return { lat: Number(round(point.lat).toFixed(2)), lon: Number(round(point.lon).toFixed(2)) };
}

function base64UrlLength(value: unknown, maxLength: number): number | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) return null;
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return null;
  const unpadded = value.replace(/=+$/, '');
  return Math.floor((unpadded.length * 3) / 4);
}

/** A push service address the server may send to, or null. */
export function validPushEndpoint(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 1024) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
  return PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname)) ? url.href : null;
}

/** A browser's push subscription (`PushSubscription.toJSON()`), checked field by field. */
export function parsePushSubscription(value: unknown): PushSubscriptionData | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const endpoint = validPushEndpoint(record.endpoint);
  const keys = record.keys as Record<string, unknown> | null | undefined;
  if (!endpoint || !keys || typeof keys !== 'object') return null;
  // p256dh is an uncompressed P-256 point (65 bytes); auth is a 16-byte secret.
  if (base64UrlLength(keys.p256dh, 100) !== 65 || base64UrlLength(keys.auth, 32) !== 16) return null;
  return { endpoint, keys: { p256dh: keys.p256dh as string, auth: keys.auth as string } };
}

/** The settings half of a subscribe request. Anything out of range makes the request invalid. */
export function parsePushSettings(value: unknown): PushSettings | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const radius = RADIUS_OPTIONS_KM.find((option) => option === record.radiusKm);
  if (radius === undefined || typeof record.quakes !== 'boolean' || typeof record.volcanoes !== 'boolean') return null;
  let placeId: string | null = null;
  if (record.placeId !== null && record.placeId !== undefined) {
    const place = typeof record.placeId === 'string' ? findPlace(record.placeId) : null;
    if (!place) return null;
    placeId = place.id;
  }
  let point: GeoPoint | null = null;
  if (record.point !== null && record.point !== undefined) {
    if (!isGeoPoint(record.point)) return null;
    point = roundForPush(record.point);
  }
  // A chosen city is the location; a position sent alongside it is not kept.
  return { radiusKm: radius, quakes: record.quakes, volcanoes: record.volcanoes, placeId, point: placeId ? null : point };
}

/** A whole subscribe request, or null when any part of it is malformed. */
export function parseSubscribeRequest(value: unknown): SubscribeRequest | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const subscription = parsePushSubscription(record.subscription);
  if (!subscription) return null;
  if (record.settings === undefined && record.replaces !== undefined) {
    const replaces = validPushEndpoint(record.replaces);
    return replaces ? { subscription, replaces } : null;
  }
  const settings = parsePushSettings(record.settings);
  return settings ? { subscription, settings } : null;
}

/** The location the alerts are measured from: the city, else the rounded position. */
export function pushOrigin(settings: PushSettings): { point: GeoPoint; name: string | null } | null {
  const place = findPlace(settings.placeId);
  if (place) return { point: place, name: place.name };
  return settings.point ? { point: settings.point, name: null } : null;
}

export interface PushFeeds {
  latest: BMKGGempaDetail | null;
  recent: SeismicEvent[];
  notice: TsunamiNotice | null;
  volcanoReports: VolcanoEruption[];
}

/**
 * The alerts to send one subscriber now, and their ledger afterwards. The rules are the open
 * tab's (`collectLocalAlerts` and `takeNewAlerts`), with one difference in wording: a
 * position that was rounded is named "sekitar lokasi Anda", since the distance is measured
 * from the rounded point.
 */
export function alertsForSubscriber(
  record: PushRecord,
  feeds: PushFeeds,
  nowMs: number
): { fresh: LocalAlert[]; ledger: AlertLedger; baseline: boolean } {
  const origin = pushOrigin(record.settings);
  const settings: LocalAlertSettings = {
    enabled: true,
    radiusKm: record.settings.radiusKm,
    quakes: record.settings.quakes,
    volcanoes: record.settings.volcanoes,
    placeId: record.settings.placeId,
  };
  const alerts = collectLocalAlerts({
    location: origin?.point ?? null,
    locationName: origin ? (origin.name ?? 'sekitar lokasi Anda') : null,
    settings,
    nowMs,
    latest: feeds.latest,
    recent: feeds.recent,
    notice: feeds.notice,
    volcanoReports: feeds.volcanoReports,
  });
  const { fresh, ledger } = takeNewAlerts(alerts, record.ledger, nowMs, { baseline: record.baseline });
  // As in the open tab: the baseline is spent on the first evaluation that could see nearby events.
  return { fresh, ledger, baseline: record.baseline && !origin };
}

/** What a push message carries: what the service worker shows, and a summary for open tabs. */
export interface PushMessage {
  title: string;
  options: ReturnType<typeof browserNotification>['options'];
  alert: Pick<LocalAlert, 'id' | 'kind' | 'title' | 'body' | 'atMs'>;
}

/** The push message for an alert, kept under the push services' size limit. */
export function pushMessage(alert: LocalAlert): string {
  const { title, options } = browserNotification(alert);
  const build = (body: string) =>
    JSON.stringify({
      title,
      options: { ...options, body },
      alert: { id: alert.id, kind: alert.kind, title: alert.title, body, atMs: alert.atMs },
    } satisfies PushMessage);
  let body = alert.body;
  let message = build(body);
  while (new TextEncoder().encode(message).length > MAX_PUSH_PAYLOAD_BYTES && body.length > 40) {
    body = `${body.slice(0, Math.floor(body.length * 0.8)).trimEnd()}…`;
    message = build(body);
  }
  return message;
}
