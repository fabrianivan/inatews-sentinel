'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, MapPin, Mountain, OctagonAlert, X, type LucideIcon } from 'lucide-react';
import type { LocalAlert } from '@/lib/localAlerts';
import type { Tone } from '@/lib/severity';
import { formatWibTime } from '@/lib/time';

interface AlertToastsProps {
  /** Newest first. */
  alerts: LocalAlert[];
  onDismiss: (id: string) => void;
  /** Shows the alert's place on the map (and closes the pop-up). */
  onShowOnMap: (alert: LocalAlert) => void;
}

/** Earthquake and eruption pop-ups close on their own; a tsunami statement stays until it is closed. */
const AUTO_DISMISS_MS = 15_000;

const KIND: Record<LocalAlert['kind'], { icon: LucideIcon; tone: Tone; source: string }> = {
  tsunami: { icon: OctagonAlert, tone: 'kritis', source: 'BMKG' },
  quake: { icon: Activity, tone: 'meningkat', source: 'BMKG' },
  volcano: { icon: Mountain, tone: 'meningkat', source: 'MAGMA PVMBG' },
};

function Toast({ alert, onDismiss, onShowOnMap }: { alert: LocalAlert; onDismiss: () => void; onShowOnMap: () => void }) {
  const meta = KIND[alert.kind];
  const Icon = meta.icon;
  const isTest = alert.id.startsWith('test:');
  const [held, setHeld] = useState(false);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  // Closes itself unless it is a tsunami statement, or the reader is pointing at it or in it.
  useEffect(() => {
    if (alert.sticky || held) return;
    const timer = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [alert.sticky, held]);

  return (
    <li
      data-tone={meta.tone}
      role={alert.kind === 'tsunami' ? 'alert' : undefined}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className="alert-surface pointer-events-auto overflow-hidden rounded-2xl shadow-[var(--shadow-elevated)]"
    >
      <div
        className={`flex items-center gap-2 px-3.5 py-2 ${
          alert.kind === 'tsunami' ? 'bg-[var(--tone-solid)] text-[var(--tone-ink)]' : 'text-[var(--tone)]'
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="t-micro min-w-0 flex-1 truncate text-current">
          {isTest ? 'Notifikasi uji' : `Notifikasi lokasi · ${meta.source}`}
        </p>
        <span className="t-meta shrink-0 opacity-80">{formatWibTime(alert.atMs, { seconds: false })}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup notifikasi"
          title="Tutup"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-black/10"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <div className="px-3.5 pb-3 pt-1.5">
        <p className="t-heading">{alert.title}</p>
        <p className="t-meta mt-1 line-clamp-3 text-[var(--text-secondary)]">{alert.body}</p>
        {(alert.point || alert.volcanoName) && (
          <button
            type="button"
            onClick={onShowOnMap}
            className="t-meta mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-2.5 font-semibold text-[var(--text-primary)] hover:border-[var(--accent-border)] hover:text-[var(--accent)]"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {alert.kind === 'volcano' ? 'Buka gunung di peta' : 'Lihat di peta'}
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * The in-dashboard pop-ups for location notifications. They need no browser permission, so
 * an alert is always seen while the dashboard is on screen; the desktop notification is sent
 * alongside when the browser allows it.
 */
export default function AlertToasts({ alerts, onDismiss, onShowOnMap }: AlertToastsProps) {
  if (alerts.length === 0) return null;
  return (
    <ol
      aria-label="Notifikasi"
      aria-live="polite"
      className="pointer-events-none fixed right-3 top-[calc(var(--hud-top)+4px)] z-[1100] flex w-[min(380px,calc(100vw-24px))] flex-col gap-2 sm:right-5"
    >
      {alerts.map((alert) => (
        <Toast
          key={alert.id}
          alert={alert}
          onDismiss={() => onDismiss(alert.id)}
          onShowOnMap={() => onShowOnMap(alert)}
        />
      ))}
    </ol>
  );
}
