import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_LEDGER } from '../localAlerts';
import {
  MAX_PUSH_PAYLOAD_BYTES,
  alertsForSubscriber,
  parsePushSettings,
  parsePushSubscription,
  parseSubscribeRequest,
  pushMessage,
  pushOrigin,
  roundForPush,
  validPushEndpoint,
  type PushRecord,
} from '../pushAlerts';
import type { BMKGGempaDetail } from '../types';

const NOW = Date.parse('2026-11-16T03:00:00Z');
const MINUTE = 60_000;

// A real-shaped subscription: an uncompressed P-256 point (65 bytes) and a 16-byte secret.
const P256DH = Buffer.alloc(65, 7).toString('base64url');
const AUTH = Buffer.alloc(16, 3).toString('base64url');
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123:def';
const SUBSCRIPTION = { endpoint: ENDPOINT, keys: { p256dh: P256DH, auth: AUTH } };
const SETTINGS = { radiusKm: 300, quakes: true, volcanoes: true, placeId: null, point: null };

function quake(overrides: Partial<BMKGGempaDetail> = {}): BMKGGempaDetail {
  return {
    Tanggal: '16 Nov 2026',
    Jam: '09:50:00 WIB',
    DateTime: new Date(NOW - 10 * MINUTE).toISOString(),
    Coordinates: '-7.05,106.60',
    Lintang: '7.05 LS',
    Bujur: '106.60 BT',
    Magnitude: '5.3',
    Kedalaman: '10 km',
    Wilayah: 'Pusat gempa berada di darat 20 km BaratDaya KOTA-SUKABUMI',
    Potensi: 'Tidak berpotensi tsunami',
    ...overrides,
  };
}

function record(overrides: Partial<PushRecord> = {}): PushRecord {
  return {
    subscription: SUBSCRIPTION,
    settings: { ...SETTINGS, placeId: 'jakarta' },
    ledger: EMPTY_LEDGER,
    baseline: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

test('the server sends only to the browsers’ own push services', () => {
  assert.equal(validPushEndpoint(ENDPOINT), ENDPOINT);
  assert.ok(validPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/gAAAA'));
  assert.ok(validPushEndpoint('https://web.push.apple.com/QGuQyavXutnMH5Ivb'));
  assert.ok(validPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=abc'));

  // Anything else could make the server call an address of the submitter's choosing.
  assert.equal(validPushEndpoint('http://fcm.googleapis.com/fcm/send/abc'), null);
  assert.equal(validPushEndpoint('https://localhost:3000/api'), null);
  assert.equal(validPushEndpoint('https://169.254.169.254/latest/meta-data'), null);
  assert.equal(validPushEndpoint('https://fcm.googleapis.com.evil.example/x'), null);
  assert.equal(validPushEndpoint('https://evilpush.apple.com.example/x'), null);
  assert.equal(validPushEndpoint('https://user:pw@fcm.googleapis.com/x'), null);
  assert.equal(validPushEndpoint('https://fcm.googleapis.com:8443/x'), null);
  assert.equal(validPushEndpoint(`https://fcm.googleapis.com/${'a'.repeat(1100)}`), null);
  assert.equal(validPushEndpoint(42), null);
});

test('a subscription needs keys of the right size', () => {
  assert.deepEqual(parsePushSubscription(SUBSCRIPTION), SUBSCRIPTION);
  assert.equal(parsePushSubscription({ ...SUBSCRIPTION, keys: { p256dh: AUTH, auth: AUTH } }), null);
  assert.equal(parsePushSubscription({ ...SUBSCRIPTION, keys: { p256dh: P256DH, auth: P256DH } }), null);
  assert.equal(parsePushSubscription({ ...SUBSCRIPTION, keys: { p256dh: 'not base64!', auth: AUTH } }), null);
  assert.equal(parsePushSubscription({ endpoint: ENDPOINT }), null);
  assert.equal(parsePushSubscription(null), null);
});

test('the server keeps a city or a position rounded to a quarter degree, never the exact one', () => {
  assert.deepEqual(roundForPush({ lat: -6.2088, lon: 106.8456 }), { lat: -6.25, lon: 106.75 });
  const settings = parsePushSettings({ ...SETTINGS, point: { lat: -6.2088, lon: 106.8456 } });
  assert.deepEqual(settings?.point, { lat: -6.25, lon: 106.75 });
  // With a city chosen, a position sent alongside is dropped.
  assert.equal(parsePushSettings({ ...SETTINGS, placeId: 'padang', point: { lat: -6.2, lon: 106.8 } })?.point, null);

  assert.equal(parsePushSettings({ ...SETTINGS, radiusKm: 123 }), null);
  assert.equal(parsePushSettings({ ...SETTINGS, placeId: 'atlantis' }), null);
  assert.equal(parsePushSettings({ ...SETTINGS, point: { lat: 99, lon: 0 } }), null);
  assert.equal(parsePushSettings({ ...SETTINGS, quakes: 'yes' }), null);

  assert.deepEqual(pushOrigin({ ...SETTINGS, placeId: 'padang' })?.name, 'Padang');
  assert.equal(pushOrigin(SETTINGS), null);
});

test('a subscribe request carries settings, or names the subscription it replaces', () => {
  assert.ok(parseSubscribeRequest({ subscription: SUBSCRIPTION, settings: SETTINGS })?.settings);
  const moved = parseSubscribeRequest({ subscription: SUBSCRIPTION, replaces: 'https://fcm.googleapis.com/fcm/send/old' });
  assert.equal(moved?.replaces, 'https://fcm.googleapis.com/fcm/send/old');
  assert.equal(parseSubscribeRequest({ subscription: SUBSCRIPTION, replaces: 'https://example.com/old' }), null);
  assert.equal(parseSubscribeRequest({ subscription: SUBSCRIPTION }), null);
  assert.equal(parseSubscribeRequest({ settings: SETTINGS }), null);
});

test('a subscriber gets the open tab’s alerts, named after their city, once', () => {
  const feeds = { latest: quake(), recent: [], notice: null, volcanoReports: [] };
  const first = alertsForSubscriber(record(), feeds, NOW);
  assert.equal(first.fresh.length, 1);
  assert.match(first.fresh[0].title, /dari Jakarta$/);

  const again = alertsForSubscriber(record({ ledger: first.ledger }), feeds, NOW + MINUTE);
  assert.equal(again.fresh.length, 0);

  // Settings just set: what is already on the feed is recorded, not sent, and the baseline is spent.
  const fresh = alertsForSubscriber(record({ baseline: true }), feeds, NOW);
  assert.equal(fresh.fresh.length, 0);
  assert.equal(fresh.baseline, false);

  // A rounded position is not presented as the reader's exact one.
  const rounded = alertsForSubscriber(
    record({ settings: { ...SETTINGS, point: { lat: -6.25, lon: 106.75 } } }),
    feeds,
    NOW
  );
  assert.match(rounded.fresh[0].title, /dari sekitar lokasi Anda$/);
});

test('a push message stays under the push services’ size limit', () => {
  const feeds = { latest: quake(), recent: [], notice: null, volcanoReports: [] };
  const [alert] = alertsForSubscriber(record(), feeds, NOW).fresh;
  const message = JSON.parse(pushMessage(alert));
  assert.equal(message.title, alert.title);
  assert.equal(message.options.tag, alert.id);
  assert.equal(message.alert.id, alert.id);

  const long = pushMessage({ ...alert, body: 'x'.repeat(5000) });
  assert.ok(new TextEncoder().encode(long).length <= MAX_PUSH_PAYLOAD_BYTES);
  assert.match(JSON.parse(long).options.body, /…$/);
});
