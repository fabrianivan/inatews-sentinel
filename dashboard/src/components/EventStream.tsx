'use client';

import { useState, useEffect, useMemo } from 'react';
import { Pause, Play } from 'lucide-react';
import type { LiveEvent } from '@/lib/types';

interface EventStreamProps {
  events: LiveEvent[];
  maxHeightClass?: string;
}

type StreamCategory = 'ALL' | 'SEISMIC' | 'OCEAN' | 'STATION' | 'VOLCANO' | 'INFRA';

const STREAM_FILTERS: { id: StreamCategory; label: string }[] = [
  { id: 'ALL', label: 'Semua' },
  { id: 'SEISMIC', label: 'Seismik' },
  { id: 'OCEAN', label: 'Laut' },
  { id: 'STATION', label: 'Stasiun' },
  { id: 'VOLCANO', label: 'Gunung Api' },
  { id: 'INFRA', label: 'Infra' },
];

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return '--:--:--';
    return d.toLocaleTimeString('id-ID', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
}

function matchesCategory(eventType: string, category: StreamCategory): boolean {
  if (category === 'ALL') return true;
  const upper = eventType.toUpperCase();
  switch (category) {
    case 'SEISMIC':
      return upper === 'SEISMIC';
    case 'OCEAN':
      return upper === 'OCEAN' || upper === 'TSUNAMI' || upper === 'MARITIME';
    case 'STATION':
      return upper === 'STATION';
    case 'VOLCANO':
      return upper === 'VOLCANO' || upper === 'VOLCANIC';
    case 'INFRA':
      return upper === 'INFRASTRUCTURE' || upper === 'WEATHER' || upper === 'SATELLITE';
    default:
      return true;
  }
}

function severityDotColor(severity: string): string {
  switch (severity.toUpperCase()) {
    case 'CRITICAL':
      return 'bg-[var(--sev-critical)]';
    case 'HIGH':
      return 'bg-[var(--sev-high)]';
    case 'MEDIUM':
      return 'bg-[var(--sev-elevated)]';
    default:
      return 'bg-[var(--sev-normal)]';
  }
}

export default function EventStream({
  events,
  maxHeightClass = 'max-h-[420px]',
}: EventStreamProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [activeCategory, setActiveCategory] = useState<StreamCategory>('ALL');
  const [isPaused, setIsPaused] = useState(false);
  const [pausedEvents, setPausedEvents] = useState<LiveEvent[] | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleTogglePause = () => {
    if (!isPaused) {
      setPausedEvents(events);
      setIsPaused(true);
    } else {
      setPausedEvents(null);
      setIsPaused(false);
    }
  };

  const sourceEvents = isPaused && pausedEvents ? pausedEvents : events;
  const bufferedCount =
    isPaused && pausedEvents ? Math.max(0, events.length - pausedEvents.length) : 0;

  const filteredEvents = useMemo(
    () => sourceEvents.filter((ev) => matchesCategory(ev.type, activeCategory)),
    [sourceEvents, activeCategory]
  );

  return (
    <div className="matte-card flex h-full flex-col overflow-hidden p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            Aliran Kejadian Telemetri
          </h3>
          <p className="text-[11px] text-[var(--text-muted)]">
            {filteredEvents.length} catatan terbaru
          </p>
        </div>
        <button
          type="button"
          onClick={handleTogglePause}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
            isPaused
              ? 'bg-[var(--sev-elevated-bg)] text-[var(--sev-elevated)]'
              : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          title={isPaused ? 'Lanjutkan aliran real-time' : 'Jeda aliran event'}
        >
          {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          <span>
            {isPaused
              ? `Lanjut${bufferedCount > 0 ? ` (+${bufferedCount})` : ''}`
              : 'Jeda'}
          </span>
        </button>
      </div>

      {/* Category Filter Chips */}
      <div
        className="mb-3 flex flex-wrap items-center gap-1"
        role="group"
        aria-label="Filter kategori event"
      >
        {STREAM_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveCategory(f.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              activeCategory === f.id
                ? 'bg-[var(--accent-strong)] text-white'
                : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Scroll List */}
      <div className={`flex-1 divide-y divide-[var(--border-hairline)] overflow-y-auto ${maxHeightClass}`}>
        {filteredEvents.length === 0 ? (
          <div className="py-10 text-center text-xs text-[var(--text-muted)]">
            {sourceEvents.length === 0
              ? 'Menunggu event telemetri masuk...'
              : `Tidak ada event pada kategori ${activeCategory}`}
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 py-2.5 text-xs transition-colors"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severityDotColor(
                  event.severity
                )}`}
              />
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2 font-mono text-[10px] text-[var(--text-muted)]">
                  <span className="tabular-nums" suppressHydrationWarning>
                    {isMounted ? formatTime(event.timestamp) : '--:--:--'}
                  </span>
                  <span>·</span>
                  <span className="font-semibold uppercase text-[var(--text-secondary)]">
                    {event.type}
                  </span>
                </div>
                <p className="leading-relaxed text-[var(--text-primary)]">
                  {event.description}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
