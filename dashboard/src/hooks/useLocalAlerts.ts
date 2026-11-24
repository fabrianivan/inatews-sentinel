'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ALERT_SETTINGS,
  EMPTY_LEDGER,
  browserNotification,
  collectLocalAlerts,
  parseAlertSettings,
  parseLedger,
  parseNotificationTarget,
  parsePushedAlert,
  takeNewAlerts,
  targetFromSearch,
  type AlertLedger,
  type LocalAlert,
  type LocalAlertSettings,
  type NotificationTarget,
} from '@/lib/localAlerts';
import { findPlace, type Place } from '@/lib/places';
import { roundForPush } from '@/lib/pushAlerts';
import type { GeoPoint } from '@/lib/proximity';
import type { TsunamiNotice } from '@/lib/tsunamiNotice';
import type { BMKGGempaDetail, SeismicEvent, VolcanoEruption } from '@/lib/types';

/**
 *  unsupported  the browser cannot show notifications from a web page
 *  default      not asked yet
 *  granted      notifications will appear
 *  denied       blocked — by the reader, or by a browser that never asks (an embedded or
 *               in-app browser): nothing can be notified until it is allowed
 */
export type AlertPermission = 'unsupported' | 'default' | 'granted' | 'denied';

/** The browser's position, as far as it has been asked. */
export type LocationState = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable' | 'unsupported';

export interface ReaderLocation {
  point: GeoPoint;
  /** Radius of the browser's position estimate in metres, when it gave one. */
  accuracyM: number | null;
  atMs: number;
}

/**
 * Web Push, for notifications while no dashboard tab is open:
 *  pending      not settled yet (notifications off, or just switched on)
 *  working      subscribing with the browser's push service and this server
 *  on           subscribed: this server sends the notifications, tab open or not
 *  unavailable  this server has no push set up (no VAPID keys)
 *  unsupported  this browser has no push
 *  failed       subscribing failed: notifications come only while a tab is open
 */
export type PushState = 'pending' | 'working' | 'on' | 'unavailable' | 'unsupported' | 'failed';

/** Where distances are measured from right now. */
export interface AlertOrigin {
  point: GeoPoint;
  /** "Padang" for a chosen city; null for the browser's position ("lokasi Anda"). */
  name: string | null;
  source: 'place' | 'browser';
}

interface UseLocalAlertsOptions {
  latest: BMKGGempaDetail | null;
  recent: SeismicEvent[];
  notice: TsunamiNotice | null;
  volcanoReports: VolcanoEruption[];
  /**
   * True while a drill runs. The inputs are always the live feeds, never the scenario; while
   * the dashboard is busy with a drill only BMKG's tsunami statement is notified, and the
   * rest waits for the drill to end.
   */
  paused: boolean;
  /** Called for every notification the browser showed. */
  onAlert?: (alert: LocalAlert) => void;
  /** Called when the reader clicks a notification: show its event on the dashboard. */
  onOpen?: (target: NotificationTarget) => void;
}

export interface LocalAlertsControl {
  settings: LocalAlertSettings;
  permission: AlertPermission;
  /** Switched on and allowed by the browser: notifications are being sent. */
  active: boolean;
  locationState: LocationState;
  /** The browser's last position, kept even while a chosen city is used instead. */
  location: ReaderLocation | null;
  /** The city chosen as the location, when there is one. */
  place: Place | null;
  /** Where distances are measured from, or null when no location is known yet. */
  origin: AlertOrigin | null;
  /** The last few notifications the browser showed since the page opened, newest first. */
  delivered: LocalAlert[];
  /** Set when the browser refused to show a notification although it was allowed. */
  deliveryError: string | null;
  push: PushState;
  /** Asks the browser for permission (needs a click) and switches notifications on when it is given. */
  enable: () => Promise<void>;
  disable: () => void;
  update: (patch: Partial<Pick<LocalAlertSettings, 'radiusKm' | 'quakes' | 'volcanoes'>>) => void;
  /** Chooses a city as the location; null goes back to the browser's position. */
  setPlace: (placeId: string | null) => void;
  /** Asks the browser for the notification permission (needs a click). */
  requestPermission: () => Promise<AlertPermission>;
  refreshLocation: () => void;
  /** Shows one test notification now, asking for the permission first if needed. */
  sendTest: () => Promise<void>;
}

const SETTINGS_KEY = 'inatews-local-alerts';
const LEDGER_KEY = 'inatews-local-alerts-ledger';
const SERVICE_WORKER_URL = '/sw.js';
const CLICK_MESSAGE = 'inatews:notification-click';
const PUSHED_MESSAGE = 'inatews:pushed';
/** Settings changes are sent to the server once they have settled for this long. */
const PUSH_SYNC_DELAY_MS = 600;
/**
 * A first subscription with the browser's push service can take a while (tens of seconds on a
 * new browser profile); the open tab keeps notifying meanwhile. Past this, push counts as failed.
 */
const PUSH_SUBSCRIBE_TIMEOUT_MS = 120_000;
/** For each request to this server. */
const REQUEST_TIMEOUT_MS = 10_000;
const LOCATION_REFRESH_MS = 30 * 60 * 1000;
/**
 * A location prompt the reader dismisses or ignores may never call back (Firefox's
 * "Not now"); after this long the panel says the location is unavailable instead of
 * "searching" forever. A late answer still lands.
 */
const LOCATE_GIVE_UP_MS = 25_000;
/** How long to wait for the service worker before showing a notification without it. */
const WORKER_WAIT_MS = 4000;
const DELIVERED_SHOWN = 5;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage may be unavailable; the setting then lasts for this page only
  }
}

function currentPermission(): AlertPermission {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
}

/** Older Safari answers through a callback instead of a promise; both are handled. */
function askPermission(): Promise<AlertPermission> {
  if (currentPermission() === 'unsupported') return Promise.resolve('unsupported');
  return new Promise((resolve) => {
    try {
      const answer = Notification.requestPermission((result) => resolve(result));
      if (answer && typeof answer.then === 'function') answer.then(resolve, () => resolve(currentPermission()));
    } catch {
      resolve(currentPermission());
    }
  });
}

let workerPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * The service worker that shows the notifications and handles a click on one (`public/sw.js`).
 * Registered once per page; null where the browser has none (then the page shows the
 * notification itself, which works while it is open but offers no buttons).
 */
function notificationWorker(): Promise<ServiceWorkerRegistration | null> {
  if (workerPromise) return workerPromise;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) {
    return Promise.resolve(null);
  }
  const ready = navigator.serviceWorker
    .register(SERVICE_WORKER_URL, { scope: '/', updateViaCache: 'none' })
    .then(() => navigator.serviceWorker.ready);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), WORKER_WAIT_MS));
  workerPromise = Promise.race([ready, timeout]).catch(() => null);
  // A failed or slow registration is tried again on the next notification.
  workerPromise.then((registration) => {
    if (!registration) workerPromise = null;
  });
  return workerPromise;
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function sameKey(current: ArrayBuffer | null | undefined, wanted: Uint8Array): boolean {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === wanted.length && bytes.every((value, index) => value === wanted[index]);
}

/** Resolves once the worker has finished activating: a subscription asked for earlier can stall. */
function activated(registration: ServiceWorkerRegistration): Promise<void> {
  const worker = registration.active;
  if (!worker || worker.state === 'activated') return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => {
      if (worker.state === 'activating') return;
      worker.removeEventListener('statechange', onChange);
      resolve();
    };
    worker.addEventListener('statechange', onChange);
  });
}

/**
 * One request to the push service can stall for good — seen with Chrome, the first one after
 * the browser starts — while a fresh request then goes through in seconds. Each attempt is
 * given this long.
 */
const SUBSCRIBE_ATTEMPT_MS = 30_000;
const SUBSCRIBE_ATTEMPTS = 3;

/** This browser's push subscription for the server's key; a new one when there is none, or one for an old key. */
async function pushSubscriptionFor(registration: ServiceWorkerRegistration, publicKey: string): Promise<PushSubscription> {
  await activated(registration);
  const key = keyBytes(publicKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing && sameKey(existing.options.applicationServerKey, key)) return existing;
  if (existing) await existing.unsubscribe().catch(() => false);
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await withTimeout(
        registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }),
        SUBSCRIBE_ATTEMPT_MS
      );
    } catch (error) {
      const stalled = error instanceof Error && error.message === 'timed out';
      if (!stalled || attempt >= SUBSCRIBE_ATTEMPTS) throw error;
      // A stalled attempt may have finished in the meantime.
      const late = await registration.pushManager.getSubscription();
      if (late && sameKey(late.options.applicationServerKey, key)) return late;
    }
  }
}

function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

/** Rejects when `promise` takes longer than `ms`: a push service that never answers must not hold notifications up. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** Ends this browser's push subscription, here and on the server. */
async function endPushSubscription(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  await postJson('/api/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => false);
}

/**
 * Location-based notifications, shown by the browser: BMKG's tsunami statement, and BMKG
 * earthquakes and MAGMA eruption reports within a chosen radius of a chosen city or of the
 * browser's position.
 *
 * The browser's position stays in this page's memory: it is not stored and never leaves the
 * device. What to notify is decided by `lib/localAlerts`; this hook owns the permission, the
 * stored settings, the record of what was already sent, and the click on a notification.
 * Notifications are sent while the dashboard is open in a tab (it may be in the background) —
 * there is no push service.
 */
export function useLocalAlerts(options: UseLocalAlertsOptions): LocalAlertsControl {
  const { latest, recent, notice, volcanoReports, paused } = options;
  const [settings, setSettings] = useState<LocalAlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [permission, setPermission] = useState<AlertPermission>('default');
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [location, setLocation] = useState<ReaderLocation | null>(null);
  const [delivered, setDelivered] = useState<LocalAlert[]>([]);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [push, setPush] = useState<PushState>('pending');
  const pushRef = useRef<PushState>('pending');
  const pushEndpointRef = useRef<string | null>(null);
  /**
   * Whether this browser already held a push subscription when the page opened (null while
   * that is being looked up). If it did, the server has been sending all along, and this tab
   * stays quiet while the subscription is confirmed — otherwise it would repeat what the
   * server pushed while the tab was closed.
   */
  const [hadSubscription, setHadSubscription] = useState<boolean | null>(null);

  const ledgerRef = useRef<AlertLedger>(EMPTY_LEDGER);
  /**
   * Set whenever notifications start being sent (switched on, allowed, or the location
   * changed by hand): the first evaluation that has a position records the nearby events
   * already on the feed instead of announcing them. A tsunami statement needs no position
   * and is never held back by it.
   */
  const baselineRef = useRef(false);
  const giveUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef(settings);
  const permissionRef = useRef(permission);
  const onAlertRef = useRef(options.onAlert);
  const onOpenRef = useRef(options.onOpen);
  useEffect(() => {
    onAlertRef.current = options.onAlert;
    onOpenRef.current = options.onOpen;
    settingsRef.current = settings;
    permissionRef.current = permission;
    pushRef.current = push;
  });

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationState('unsupported');
      return;
    }
    setLocationState((state) => (state === 'ready' ? state : 'locating'));
    if (giveUpTimerRef.current) clearTimeout(giveUpTimerRef.current);
    giveUpTimerRef.current = setTimeout(
      () => setLocationState((state) => (state === 'locating' ? 'unavailable' : state)),
      LOCATE_GIVE_UP_MS
    );
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (giveUpTimerRef.current) clearTimeout(giveUpTimerRef.current);
        setLocation({
          point: { lat: position.coords.latitude, lon: position.coords.longitude },
          accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          atMs: Date.now(),
        });
        setLocationState('ready');
      },
      (error) => {
        if (giveUpTimerRef.current) clearTimeout(giveUpTimerRef.current);
        // A refresh that fails keeps the position already held.
        setLocationState((state) =>
          state === 'ready' ? state : error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'
        );
      },
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 20_000 }
    );
  }, []);

  // Stored settings are read after mount, so the server-rendered page and the first client
  // render agree; a reader who had notifications on, without a chosen city, gets their
  // position read again.
  useEffect(() => {
    const stored = parseAlertSettings(readStorage(SETTINGS_KEY));
    const allowed = currentPermission();
    ledgerRef.current = parseLedger(readStorage(LEDGER_KEY));
    setSettings(stored);
    setPermission(allowed);
    if (stored.enabled && allowed === 'granted') {
      void notificationWorker();
      if (stored.placeId === null) locate();
    }
  }, [locate]);

  // The permission can change outside the page (the lock icon in the address bar); look
  // again whenever the reader comes back to the tab. Allowed there while switched on, sending
  // starts from now: what is already on the feed is history, not news.
  useEffect(() => {
    const recheck = () => {
      const next = currentPermission();
      if (next === 'granted' && permissionRef.current !== 'granted' && settingsRef.current.enabled) {
        baselineRef.current = true;
        void notificationWorker();
        if (settingsRef.current.placeId === null) locate();
      }
      permissionRef.current = next;
      setPermission(next);
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [locate]);

  // A click on a notification: the service worker brings this tab to the front and says which
  // event it was; when no dashboard tab was left it opened a new one at an address naming it.
  useEffect(() => {
    const fromAddress = targetFromSearch(window.location.search);
    if (fromAddress) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
      onOpenRef.current?.(fromAddress);
    }
    if (!('serviceWorker' in navigator)) return;
    const container = navigator.serviceWorker;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; target?: unknown; alert?: unknown } | null;
      if (data?.type === CLICK_MESSAGE) {
        onOpenRef.current?.(parseNotificationTarget(data.target) ?? { kind: 'test' });
        return;
      }
      // A notification the server pushed while this tab was open: it belongs in the recent list.
      if (data?.type === PUSHED_MESSAGE) {
        const alert = parsePushedAlert(data.alert);
        if (!alert) return;
        onAlertRef.current?.(alert);
        setDelivered((previous) => [alert, ...previous.filter((item) => item.id !== alert.id)].slice(0, DELIVERED_SHOWN));
      }
    };
    container.addEventListener('message', onMessage);
    container.startMessages();
    return () => container.removeEventListener('message', onMessage);
  }, []);

  const active = settings.enabled && permission === 'granted';

  useEffect(() => {
    if (!active || settings.placeId !== null) return;
    const timer = setInterval(locate, LOCATION_REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, settings.placeId, locate]);

  const deliver = useCallback(async (alert: LocalAlert) => {
    if (currentPermission() !== 'granted') return;
    const { title, options: shown } = browserNotification(alert);
    try {
      const registration = await notificationWorker();
      if (registration) {
        await registration.showNotification(title, shown as NotificationOptions);
      } else {
        // No service worker: the page shows it itself, without buttons, while it is open.
        const { actions: _actions, ...plain } = shown;
        const notification = new Notification(title, plain as NotificationOptions);
        notification.onclick = () => {
          window.focus();
          notification.close();
          onOpenRef.current?.(shown.data.target);
        };
      }
      setDeliveryError(null);
    } catch {
      setDeliveryError('Browser menolak menampilkan notifikasi. Periksa izin notifikasi situs ini dan mode fokus/jangan ganggu di perangkat.');
      return;
    }
    onAlertRef.current?.(alert);
    setDelivered((previous) => [alert, ...previous.filter((item) => item.id !== alert.id)].slice(0, DELIVERED_SHOWN));
  }, []);

  useEffect(
    () => () => {
      if (giveUpTimerRef.current) clearTimeout(giveUpTimerRef.current);
    },
    []
  );

  // A chosen city wins over the browser's position. Both references are stable between
  // renders (`findPlace` hands back the catalogue's own object), so the evaluation below
  // only re-runs when the location really changes.
  const place = findPlace(settings.placeId);
  const browserPoint = location?.point ?? null;
  const originPoint: GeoPoint | null = place ?? browserPoint;
  const originName = place?.name ?? null;

  // Web Push: while notifications are on, this browser is subscribed and the server holds its
  // settings — sent again whenever they change. The location it gets is the chosen city, or
  // the browser's position rounded to ±20 km; never more.
  const pushPoint = !place && browserPoint ? roundForPush(browserPoint) : null;
  const pushSettings = active
    ? JSON.stringify({
        radiusKm: settings.radiusKm,
        quakes: settings.quakes,
        volcanoes: settings.volcanoes,
        placeId: settings.placeId,
        point: pushPoint,
      })
    : null;
  useEffect(() => {
    let cancelled = false;
    const lookUp = async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.getRegistration('/');
      return Boolean(await registration?.pushManager?.getSubscription());
    };
    lookUp()
      .catch(() => false)
      .then((held) => {
        if (!cancelled) setHadSubscription(held);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pushSettings === null) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!('PushManager' in window)) {
        setPush('unsupported');
        return;
      }
      const registration = await notificationWorker();
      if (cancelled) return;
      if (!registration) {
        setPush('unsupported');
        return;
      }
      setPush((state) => (state === 'on' ? state : 'working'));
      try {
        const keyResponse = await fetch('/api/push/key', { cache: 'no-store', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (keyResponse.status === 503) {
          if (!cancelled) setPush('unavailable');
          return;
        }
        const { publicKey } = (await keyResponse.json()) as { publicKey?: string };
        if (!keyResponse.ok || !publicKey) throw new Error('no push key');
        const subscription = await withTimeout(pushSubscriptionFor(registration, publicKey), PUSH_SUBSCRIBE_TIMEOUT_MS);
        const saved = await postJson('/api/push/subscribe', {
          subscription: subscription.toJSON(),
          settings: JSON.parse(pushSettings) as unknown,
        });
        if (!saved.ok) throw new Error(`subscribe -> ${saved.status}`);
        pushEndpointRef.current = subscription.endpoint;
        if (!cancelled) setPush('on');
      } catch (error) {
        // Notifications go on from the open tab; the reason is kept for whoever debugs it.
        console.warn('Web Push: berlangganan gagal —', error);
        if (!cancelled) setPush('failed');
      }
    }, PUSH_SYNC_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pushSettings]);

  // Evaluate on every change of the feeds, the location or the settings — in this tab only
  // when push is not there to do it: subscribed, the server sends every notification, and
  // this tab sending too would show each one twice. While a first subscription is being made
  // this tab carries on (the server starts from the feed as it is then, so nothing repeats).
  const localDelivery =
    push === 'unavailable' ||
    push === 'unsupported' ||
    push === 'failed' ||
    ((push === 'pending' || push === 'working') && hadSubscription === false);
  // Taking over from push: what is on the feed now may already have been pushed.
  const wasLocalRef = useRef(localDelivery);
  useEffect(() => {
    if (localDelivery && !wasLocalRef.current && push !== 'pending') baselineRef.current = true;
    wasLocalRef.current = localDelivery;
  }, [localDelivery, push]);
  useEffect(() => {
    if (!active || !localDelivery) return;

    const nowMs = Date.now();
    const alerts = collectLocalAlerts({
      location: originPoint,
      locationName: originName,
      settings,
      nowMs,
      latest,
      recent,
      notice,
      volcanoReports,
    });
    // Alerts held back during a drill are not recorded, so they are still delivered after it.
    const due = paused ? alerts.filter((alert) => alert.kind === 'tsunami') : alerts;
    const { fresh, ledger } = takeNewAlerts(due, ledgerRef.current, nowMs, { baseline: baselineRef.current });
    // Without a position only the tsunami statement can apply, and the baseline lets it through;
    // the baseline is spent on the first evaluation that could see nearby events.
    if (originPoint && !paused) baselineRef.current = false;
    ledgerRef.current = ledger;
    writeStorage(LEDGER_KEY, JSON.stringify(ledger));
    fresh.forEach((alert) => void deliver(alert));
  }, [active, localDelivery, settings, paused, originPoint, originName, latest, recent, notice, volcanoReports, deliver]);

  const persist = useCallback((next: LocalAlertSettings) => {
    settingsRef.current = next;
    setSettings(next);
    writeStorage(SETTINGS_KEY, JSON.stringify(next));
  }, []);

  const requestPermission = useCallback(async () => {
    const answer = currentPermission() === 'default' ? await askPermission() : currentPermission();
    permissionRef.current = answer;
    setPermission(answer);
    return answer;
  }, []);

  const enable = useCallback(async () => {
    const answer = await requestPermission();
    // Without the browser's permission nothing can be sent: the setting stays off and the
    // panel says why.
    if (answer !== 'granted') return;
    void notificationWorker();
    baselineRef.current = true;
    const next = { ...settingsRef.current, enabled: true };
    persist(next);
    if (next.placeId === null) locate();
  }, [requestPermission, persist, locate]);

  const disable = useCallback(() => {
    persist({ ...settingsRef.current, enabled: false });
    // Switched off: the server forgets this browser and everything kept with it.
    setPush('pending');
    setHadSubscription(false);
    pushEndpointRef.current = null;
    void endPushSubscription();
  }, [persist]);

  const update = useCallback(
    (patch: Partial<Pick<LocalAlertSettings, 'radiusKm' | 'quakes' | 'volcanoes'>>) => {
      persist({ ...settingsRef.current, ...patch });
    },
    [persist]
  );

  const setPlace = useCallback(
    (placeId: string | null) => {
      const next = { ...settingsRef.current, placeId: findPlace(placeId)?.id ?? null };
      if (next.placeId === settingsRef.current.placeId) return;
      // Events already on the feed near the new location are history, not news.
      baselineRef.current = true;
      persist(next);
      if (next.enabled && next.placeId === null && currentPermission() === 'granted') locate();
    },
    [persist, locate]
  );

  const sendTest = useCallback(async () => {
    const answer = await requestPermission();
    if (answer !== 'granted') return;
    // Subscribed: the test goes the whole push way (server, push service, service worker).
    if (pushRef.current === 'on' && pushEndpointRef.current) {
      try {
        const response = await postJson('/api/push/test', { endpoint: pushEndpointRef.current });
        setDeliveryError(
          response.ok
            ? null
            : response.status === 429
              ? 'Uji push baru saja dikirim — tunggu 20 detik sebelum mencoba lagi.'
              : 'Server gagal mengirim uji push. Notifikasi tetap muncul selama tab ini terbuka.'
        );
      } catch {
        setDeliveryError('Server dasbor tidak terjangkau untuk uji push.');
      }
      return;
    }
    await deliver({
      id: `test:${Date.now()}`,
      kind: 'quake',
      title: 'Notifikasi uji — INATEWS SENTINEL',
      body: 'Ini hanya uji coba, bukan kejadian. Notifikasi seperti ini muncul selama dasbor terbuka di salah satu tab.',
      sticky: false,
      atMs: Date.now(),
      distanceKm: null,
    });
  }, [requestPermission, deliver]);

  const origin: AlertOrigin | null = place
    ? { point: place, name: place.name, source: 'place' }
    : browserPoint
      ? { point: browserPoint, name: null, source: 'browser' }
      : null;

  return {
    settings,
    permission,
    active,
    locationState,
    location,
    place,
    origin,
    delivered,
    deliveryError,
    push,
    enable,
    disable,
    update,
    setPlace,
    requestPermission,
    refreshLocation: locate,
    sendTest,
  };
}
