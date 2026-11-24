'use client';

import { useState, type ReactNode } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  CircleCheck,
  CircleDashed,
  CircleX,
  Info,
  LoaderCircle,
  LocateFixed,
  Send,
} from 'lucide-react';
import type { AlertPermission, LocalAlertsControl, LocationState } from '@/hooks/useLocalAlerts';
import { RADIUS_OPTIONS_KM, type LocalAlert } from '@/lib/localAlerts';
import { PLACES, PLACE_REGIONS } from '@/lib/places';
import { formatDecimal, formatWibTime } from '@/lib/time';

interface LocalAlertsPanelProps {
  alerts: LocalAlertsControl;
  /** True while a drill runs: only BMKG's tsunami statement is notified, and the panel says so. */
  isDrill: boolean;
}

type CheckState = 'ok' | 'pending' | 'blocked' | 'busy';

const KIND_LABEL: Record<LocalAlert['kind'], string> = {
  tsunami: 'Tsunami · BMKG',
  quake: 'Gempa · BMKG',
  volcano: 'Erupsi · MAGMA',
};

const DESKTOP_STATUS: Record<AlertPermission, { state: CheckState; text: string; hint?: string }> = {
  granted: { state: 'ok', text: 'Diizinkan' },
  default: { state: 'pending', text: 'Belum diizinkan' },
  denied: {
    state: 'blocked',
    text: 'Diblokir oleh peramban ini',
    hint: 'Izinkan lewat ikon gembok di bilah alamat, atau buka dasbor di Chrome, Edge, Firefox atau Safari. Peramban di dalam aplikasi tidak menampilkan notifikasi desktop.',
  },
  unsupported: { state: 'blocked', text: 'Tidak didukung peramban ini' },
};

const BROWSER_LOCATION_STATUS: Record<Exclude<LocationState, 'ready'>, { state: CheckState; text: string }> = {
  idle: { state: 'pending', text: 'Belum ada — pilih kota di bawah' },
  locating: { state: 'busy', text: 'Mencari lokasi peramban…' },
  denied: { state: 'blocked', text: 'Lokasi peramban diblokir — pilih kota di bawah' },
  unavailable: { state: 'blocked', text: 'Lokasi peramban tidak tersedia — pilih kota di bawah' },
  unsupported: { state: 'blocked', text: 'Peramban tidak menyediakan lokasi — pilih kota di bawah' },
};

function formatAccuracy(meters: number | null): string {
  if (meters === null) return '';
  return meters >= 1000 ? ` ±${formatDecimal(meters / 1000)} km` : ` ±${Math.round(meters)} m`;
}

function CheckIcon({ state }: { state: CheckState }) {
  const className = 'mt-0.5 h-4 w-4 shrink-0';
  switch (state) {
    case 'ok':
      return <CircleCheck className={`${className} text-[var(--ok)]`} aria-hidden="true" />;
    case 'busy':
      return <LoaderCircle className={`${className} animate-spin text-[var(--text-muted)]`} aria-hidden="true" />;
    case 'blocked':
      return <CircleX className={`${className} text-[var(--text-muted)]`} aria-hidden="true" />;
    default:
      return <CircleDashed className={`${className} text-[var(--text-muted)]`} aria-hidden="true" />;
  }
}

/** One line of "what works right now": a check, what it is about, and its state in words. */
function CheckRow({
  state,
  label,
  children,
  hint,
  action,
}: {
  state: CheckState;
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      <CheckIcon state={state} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="t-body font-semibold text-[var(--text-primary)]">{label}</span>
          {action}
        </div>
        <p className="t-meta mt-0.5 text-[var(--text-secondary)]">{children}</p>
        {hint && <p className="t-meta mt-1 text-[var(--text-muted)]">{hint}</p>}
      </div>
    </li>
  );
}

const linkButton =
  't-meta inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline disabled:opacity-50';

/**
 * The location-based notifications: whether they are on, what actually reaches the reader
 * in this browser (a pop-up always; a desktop notification only when the browser allows it),
 * where distances are measured from (a chosen city, or the browser's position), and what is
 * notified. Facts from BMKG and MAGMA only — not a warning service.
 */
export default function LocalAlertsPanel({ alerts, isDrill }: LocalAlertsPanelProps) {
  const { settings, permission, locationState, location, place, origin, delivered } = alerts;
  const { enabled } = settings;
  const [showInfo, setShowInfo] = useState(false);

  const desktop = DESKTOP_STATUS[permission];
  const chip = !enabled
    ? { tone: 'unknown', text: 'Nonaktif' }
    : origin
      ? { tone: 'rutin', text: 'Aktif' }
      : { tone: 'unknown', text: 'Aktif · tanpa lokasi' };

  let locationRow: { state: CheckState; text: ReactNode };
  if (place) {
    locationRow = { state: 'ok', text: `${place.name}, ${place.province} — kota pilihan` };
  } else if (locationState === 'ready' && location) {
    locationRow = {
      state: 'ok',
      text: (
        <>
          <span className="t-data text-[var(--text-primary)]">
            {formatDecimal(Math.abs(location.point.lat), 2)}° {location.point.lat < 0 ? 'LS' : 'LU'} ·{' '}
            {formatDecimal(Math.abs(location.point.lon), 2)}° {location.point.lon < 0 ? 'BB' : 'BT'}
          </span>
          {formatAccuracy(location.accuracyM)} · peramban, {formatWibTime(location.atMs, { seconds: false })}
        </>
      ),
    };
  } else {
    // Before notifications are on, the browser has not been asked yet.
    locationRow = BROWSER_LOCATION_STATUS[locationState === 'ready' ? 'idle' : locationState];
  }

  return (
    <section id="notifikasi-lokasi" aria-labelledby="notifikasi-lokasi-title" className="glass-hud rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="notifikasi-lokasi-title" className="t-heading flex items-center gap-2">
          {enabled ? (
            <BellRing className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
          ) : (
            <Bell className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
          )}
          Notifikasi lokasi
        </h2>
        <div className="flex items-center gap-1">
          <span data-tone={chip.tone} className="tone-chip">
            {chip.text}
          </span>
          <button
            type="button"
            onClick={() => setShowInfo((open) => !open)}
            aria-expanded={showInfo}
            aria-controls="notifikasi-lokasi-info"
            aria-label="Cara kerja notifikasi lokasi"
            title="Cara kerja notifikasi lokasi"
            className="icon-btn"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {showInfo && (
        <div
          id="notifikasi-lokasi-info"
          className="t-meta mt-3 space-y-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-3.5 py-2.5"
        >
          <p>
            Pernyataan potensi tsunami BMKG selalu dinotifikasikan, di mana pun episenternya. Gempa BMKG dan laporan
            erupsi MAGMA hanya bila berada dalam radius dari lokasi yang dipilih.
          </p>
          <p>
            Setiap notifikasi muncul sebagai pop-up di dasbor, dan juga di desktop bila peramban mengizinkan — hanya
            selama tab ini terbuka.
          </p>
          <p>
            Lokasi peramban dipakai di perangkat ini saja dan tidak dikirim ke server mana pun. Kota pilihan disimpan di
            peramban ini.
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {enabled ? (
          <button
            type="button"
            onClick={alerts.disable}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--border-strong)] px-3.5 text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent-border)]"
          >
            <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
            Matikan
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void alerts.enable()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 text-[13px] font-bold text-[var(--accent-ink)] hover:opacity-90"
          >
            <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
            Aktifkan notifikasi
          </button>
        )}
        <button
          type="button"
          onClick={alerts.sendTest}
          title="Tampilkan satu notifikasi uji sekarang"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--border-strong)] px-3.5 text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent-border)]"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          Uji
        </button>
      </div>

      <ul className="mt-3 divide-y divide-[var(--border-hairline)] border-y border-[var(--border-hairline)]" aria-label="Yang berjalan di peramban ini">
        <CheckRow state="ok" label="Pop-up di dasbor">
          Selalu, selama tab ini terbuka.
        </CheckRow>
        <CheckRow
          state={desktop.state}
          label="Notifikasi desktop"
          hint={desktop.hint}
          action={
            permission === 'default' ? (
              <button type="button" onClick={() => void alerts.requestDesktop()} className={linkButton}>
                Izinkan
              </button>
            ) : undefined
          }
        >
          {desktop.text}
        </CheckRow>
        <CheckRow
          state={locationRow.state}
          label="Lokasi"
          hint={
            enabled && !origin ? 'Tanpa lokasi, hanya pernyataan potensi tsunami BMKG yang dinotifikasikan.' : undefined
          }
          action={
            enabled && !place && locationState !== 'locating' ? (
              <button type="button" onClick={alerts.refreshLocation} className={linkButton}>
                <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
                {locationState === 'ready' ? 'Perbarui' : 'Coba lagi'}
              </button>
            ) : undefined
          }
        >
          {locationRow.text}
        </CheckRow>
      </ul>

      {isDrill && enabled && (
        <p className="t-meta mt-2 text-[var(--text-muted)]">
          Selama simulasi berjalan, hanya pernyataan potensi tsunami BMKG yang dinotifikasikan.
        </p>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="notifikasi-lokasi-kota" className="t-micro">
            Ukur jarak dari
          </label>
          <select
            id="notifikasi-lokasi-kota"
            value={settings.placeId ?? ''}
            onChange={(event) => alerts.setPlace(event.target.value || null)}
            className="t-body mt-1.5 min-h-9 w-full cursor-pointer rounded-xl border border-[var(--border-strong)] bg-[var(--surface-1)] px-2.5 text-[var(--text-primary)]"
          >
            <option value="">Lokasi peramban (otomatis)</option>
            {PLACE_REGIONS.map((region) => (
              <optgroup key={region} label={region}>
                {PLACES.filter((item) => item.region === region).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.province}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <p className="t-micro" id="notifikasi-lokasi-radius">
            Radius
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-labelledby="notifikasi-lokasi-radius">
            {RADIUS_OPTIONS_KM.map((radius) => (
              <button
                key={radius}
                type="button"
                aria-pressed={settings.radiusKm === radius}
                onClick={() => alerts.update({ radiusKm: radius })}
                className={`inline-flex min-h-8 items-center rounded-lg border px-3 font-mono text-[12px] font-semibold tabular-nums transition-colors ${
                  settings.radiusKm === radius
                    ? 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]'
                    : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {radius.toLocaleString('id-ID')} km
              </button>
            ))}
          </div>
        </div>

        <fieldset>
          <legend className="t-micro">Yang dinotifikasikan</legend>
          <div className="mt-1.5 space-y-1.5">
            <label className="t-body flex items-start gap-2">
              <input type="checkbox" checked readOnly disabled className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
              <span>Potensi tsunami BMKG — selalu, di mana pun</span>
            </label>
            <label className="t-body flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={settings.quakes}
                onChange={(event) => alerts.update({ quakes: event.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span>Gempa BMKG dalam radius, satu jam terakhir</span>
            </label>
            <label className="t-body flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={settings.volcanoes}
                onChange={(event) => alerts.update({ volcanoes: event.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span>Erupsi MAGMA dalam radius — paling banyak satu per gunung tiap 6 jam</span>
            </label>
          </div>
        </fieldset>

        <div>
          <p className="t-micro">Terakhir</p>
          {delivered.length === 0 ? (
            <p className="t-meta mt-1 text-[var(--text-muted)]">Belum ada notifikasi sejak dasbor dibuka.</p>
          ) : (
            <ul className="mt-1 divide-y divide-[var(--border-hairline)]">
              {delivered.map((alert) => (
                <li key={alert.id} className="py-1.5">
                  <p className="t-meta flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-semibold text-[var(--text-primary)]">{alert.title}</span>
                    <span className="text-[var(--text-muted)]">
                      {alert.id.startsWith('test:') ? 'Uji coba' : KIND_LABEL[alert.kind]} ·{' '}
                      {formatWibTime(alert.atMs, { seconds: false })}
                    </span>
                  </p>
                  <p className="t-meta mt-0.5">{alert.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="t-meta mt-4 border-t border-[var(--border-hairline)] pt-3 text-[var(--text-muted)]">
        Bukan layanan peringatan dini — rujukan resmi tetap BMKG, PVMBG dan BPBD.
      </p>
    </section>
  );
}
