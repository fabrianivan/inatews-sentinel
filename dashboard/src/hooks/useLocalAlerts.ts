'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ALERT_SETTINGS,
  EMPTY_LEDGER,
  collectLocalAlerts,
  parseAlertSettings,
  parseLedger,
  takeNewAlerts,
  type AlertLedger,
  type LocalAlert,
  type LocalAlertSettings,
} from '@/lib/localAlerts';
import { findPlace, type Place } from '@/lib/places';
import type { GeoPoint } from '@/lib/proximity';
import type { TsunamiNotice } from '@/lib/tsunamiNotice';
import type { BMKGGempaDetail, SeismicEvent, VolcanoEruption } from '@/lib/types';

/**
 *  unsupported  the browser has no Notification API, or refuses to show one from a page
 *  default      not asked yet
 *  granted      desktop notifications will appear
 *  denied       blocked — by the reader, or by a browser that never asks (an embedded or
 *               in-app browser): alerts then show inside the dashboard only
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
  /** Called for every alert delivered, so the page can show it in its own interface too. */
  onAlert?: (alert: LocalAlert) => void;
}

export interface LocalAlertsControl {
  settings: LocalAlertSettings;
  permission: AlertPermission;
  locationState: LocationState;
  /** The browser's last position, kept even while a chosen city is used instead. */
  location: ReaderLocation | null;
  /** The city chosen as the location, when there is one. */
  place: Place | null;
  /** Where distances are measured from, or null when no location is known yet. */
  origin: AlertOrigin | null;
  /** The last few alerts delivered since the page opened, newest first. */
  delivered: LocalAlert[];
  /** Switches notifications on, asking for the desktop permission first (needs a click). */
  enable: () => Promise<void>;
  disable: () => void;
  update: (patch: Partial<Pick<LocalAlertSettings, 'radiusKm' | 'quakes' | 'volcanoes'>>) => void;
  /** Chooses a city as the location; null goes back to the browser's position. */
  setPlace: (placeId: string | null) => void;
  /** Asks for the desktop-notification permission (needs a click). */
  requestDesktop: () => Promise<void>;
  refreshLocation: () => void;
  sendTest: () => void;
}

const SETTINGS_KEY = 'inatews-local-alerts';
const LEDGER_KEY = 'inatews-local-alerts-ledger';
const LOCATION_REFRESH_MS = 30 * 60 * 1000;
/**
 * A location prompt the reader dismisses or ignores may never call back (Firefox's
 * "Not now"); after this long the panel says the location is unavailable instead of
 * "searching" forever. A late answer still lands.
 */
const LOCATE_GIVE_UP_MS = 25_000;
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

/**
 * Notifications for events near the reader: BMKG's tsunami statement, BMKG earthquakes and
 * MAGMA eruption reports within a chosen radius — as a pop-up in the dashboard, and on the
 * desktop when the browser allows it.
 *
 * The location is either a city the reader picks or the browser's position. The browser's
 * position stays in this page's memory: it is not stored and never leaves the device. What
 * to notify is decided by `lib/localAlerts`; this hook owns the permissions, the stored
 * settings and the record of what was already sent. Notifications only arrive while the
 * dashboard is open — there is no push service.
 */
export function useLocalAlerts(options: UseLocalAlertsOptions): LocalAlertsControl {
  const { latest, recent, notice, volcanoReports, paused } = options;
  const [settings, setSettings] = useState<LocalAlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [permission, setPermission] = useState<AlertPermission>('default');
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [location, setLocation] = useState<ReaderLocation | null>(null);
  const [delivered, setDelivered] = useState<LocalAlert[]>([]);

  const ledgerRef = useRef<AlertLedger>(EMPTY_LEDGER);
  /**
   * Set when notifications are switched on or the location is changed by hand: the first
   * evaluation that has a position records the nearby events already on the feed instead of
   * announcing them. A tsunami statement needs no position and is never held back by it.
   */
  const baselineRef = useRef(false);
  const giveUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef(settings);
  const onAlertRef = useRef(options.onAlert);
  useEffect(() => {
    onAlertRef.current = options.onAlert;
    settingsRef.current = settings;
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
    ledgerRef.current = parseLedger(readStorage(LEDGER_KEY));
    setSettings(stored);
    setPermission(currentPermission());
    if (stored.enabled && stored.placeId === null) locate();
  }, [locate]);

  // The permission can change outside the page (the lock icon in the address bar); look
  // again whenever the reader comes back to the tab.
  useEffect(() => {
    const recheck = () => setPermission((previous) => (previous === 'unsupported' ? previous : currentPermission()));
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, []);

  useEffect(() => {
    if (!settings.enabled || settings.placeId !== null) return;
    const timer = setInterval(locate, LOCATION_REFRESH_MS);
    return () => clearInterval(timer);
  }, [settings.enabled, settings.placeId, locate]);

  const deliver = useCallback((alert: LocalAlert) => {
    if (currentPermission() === 'granted') {
      try {
        const notification = new Notification(alert.title, {
          body: alert.body,
          tag: alert.id,
          lang: 'id',
          requireInteraction: alert.sticky,
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch {
        // Some browsers only allow notifications from a service worker; the dashboard has none.
        setPermission('unsupported');
      }
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

  // Evaluate on every change of the feeds, the location or the settings.
  useEffect(() => {
    if (!settings.enabled) return;

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
    fresh.forEach(deliver);
  }, [settings, paused, originPoint, originName, latest, recent, notice, volcanoReports, deliver]);

  const persist = useCallback((next: LocalAlertSettings) => {
    settingsRef.current = next;
    setSettings(next);
    writeStorage(SETTINGS_KEY, JSON.stringify(next));
  }, []);

  const requestDesktop = useCallback(async () => {
    let next: AlertPermission = currentPermission();
    if (next === 'default') {
      try {
        next = await Notification.requestPermission();
      } catch {
        next = 'unsupported';
      }
    }
    setPermission(next);
  }, []);

  const enable = useCallback(async () => {
    await requestDesktop();
    baselineRef.current = true;
    const next = { ...settingsRef.current, enabled: true };
    persist(next);
    if (next.placeId === null) locate();
  }, [requestDesktop, persist, locate]);

  const disable = useCallback(() => {
    persist({ ...settingsRef.current, enabled: false });
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
      if (next.enabled && next.placeId === null) locate();
    },
    [persist, locate]
  );

  const sendTest = useCallback(() => {
    deliver({
      id: `test:${Date.now()}`,
      kind: 'quake',
      title: 'Notifikasi uji — INATEWS SENTINEL',
      body: 'Ini hanya uji coba, bukan kejadian. Notifikasi seperti ini muncul selama dasbor terbuka.',
      sticky: false,
      atMs: Date.now(),
      distanceKm: null,
    });
  }, [deliver]);

  const origin: AlertOrigin | null = place
    ? { point: place, name: place.name, source: 'place' }
    : browserPoint
      ? { point: browserPoint, name: null, source: 'browser' }
      : null;

  return {
    settings,
    permission,
    locationState,
    location,
    place,
    origin,
    delivered,
    enable,
    disable,
    update,
    setPlace,
    requestDesktop,
    refreshLocation: locate,
    sendTest,
  };
}
