'use client';

import { useMemo, useState } from 'react';
import { Pause } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { TONE_LABEL, toTone, type Tone } from '@/lib/severity';
import { formatRowStamp, formatWibDate, formatWibTime, toDate } from '@/lib/time';
import type { LiveEvent } from '@/lib/types';

interface EventStreamProps {
  events: LiveEvent[];
  maxHeightClass?: string;
  /** Render tanpa pembungkus kartu (untuk disematkan di panel HUD peta). */
  bare?: boolean;
}

type EventCategory = 'SEISMIC' | 'OCEAN' | 'STATION' | 'VOLCANO' | 'INFRA';
type StreamFilter = 'ALL' | EventCategory;

const CATEGORY_LABEL: Record<EventCategory, string> = {
  SEISMIC: 'Seismik',
  OCEAN: 'Laut',
  STATION: 'Stasiun',
  VOLCANO: 'Gunung Api',
  INFRA: 'Infra',
};

const STREAM_FILTERS: { id: StreamFilter; label: string }[] = [
  { id: 'ALL', label: 'Semua' },
  ...(Object.keys(CATEGORY_LABEL) as EventCategory[]).map((id) => ({ id, label: CATEGORY_LABEL[id] })),
];

const EVENT_TYPE_CATEGORY: Record<string, EventCategory> = {
  SEISMIC: 'SEISMIC',
  OCEAN: 'OCEAN',
  TSUNAMI: 'OCEAN',
  MARITIME: 'OCEAN',
  STATION: 'STATION',
  VOLCANO: 'VOLCANO',
  VOLCANIC: 'VOLCANO',
  INFRASTRUCTURE: 'INFRA',
  WEATHER: 'INFRA',
  SATELLITE: 'INFRA',
};

/** Ages are worded in whole seconds or minutes, so a slow tick is enough. */
const AGE_REFRESH_MS = 15_000;

function categoryOf(eventType: string): EventCategory | null {
  return EVENT_TYPE_CATEGORY[eventType.toUpperCase()] ?? null;
}

/** Drill events are recognised by their "[DRILL …]" prefix or a flag in the payload. */
function isDrillEvent(event: LiveEvent): boolean {
  return (
    event.description.trimStart().startsWith('[DRILL') ||
    event.data?.simulation === true ||
    event.data?.drill === true
  );
}

/** Hollow for routine and unknown, filled from "meningkat" up — the tone never rests on colour alone. */
function ToneMark({ tone }: { tone: Tone }) {
  const filled = tone !== 'rutin' && tone !== 'unknown';
  return (
    <span data-tone={tone} className="t-micro inline-flex items-center gap-1.5 text-[var(--tone)]">
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full border border-[var(--tone-border)] ${
          filled ? 'bg-[var(--tone-border)]' : ''
        } ${tone === 'unknown' ? 'border-dashed' : ''}`}
      />
      {TONE_LABEL[tone]}
    </span>
  );
}

function EventRow({ event, now }: { event: LiveEvent; now: number | null }) {
  const drill = isDrillEvent(event);
  const synthetic = event.data?.synthetic === true;
  const tone = toTone(event.severity);
  const category = categoryOf(event.type);
  const occurredAt = toDate(event.timestamp);

  return (
    <li className="flex gap-2.5 py-2.5">
      {drill && <span aria-hidden="true" className="drill-band rounded-full" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* A drill's tone sits inside the simulation chip so it cannot be read, or cropped, on its own. */}
          {drill ? (
            <span className="drill-chip">
              SIMULASI
              <ToneMark tone={tone} />
            </span>
          ) : (
            <ToneMark tone={tone} />
          )}
          <span className="t-micro">{category ? CATEGORY_LABEL[category] : event.type}</span>
          {synthetic && (
            <span
              className="t-micro rounded border border-dashed border-[var(--border-strong)] px-1.5"
              title="Baris detak yang disusun dasbor, bukan pesan dari sensor"
            >
              sintetis
            </span>
          )}
          <time
            dateTime={occurredAt?.toISOString()}
            title={occurredAt ? `${formatWibDate(occurredAt)}, ${formatWibTime(occurredAt)}` : undefined}
            className="t-meta ml-auto font-mono tabular-nums text-[var(--text-muted)]"
          >
            {/* The age needs the client clock; until mount only the WIB clock time is shown. */}
            {now === null
              ? formatWibTime(event.timestamp, { seconds: false })
              : formatRowStamp(event.timestamp, now)}
          </time>
        </div>
        <p className={synthetic ? 't-meta mt-1 text-[var(--text-muted)]' : 't-body mt-1'}>
          {event.description}
        </p>
      </div>
    </li>
  );
}

/** Owns the clock tick so the header and filters do not re-render with it. */
function EventList({ events }: { events: LiveEvent[] }) {
  const now = useNow(AGE_REFRESH_MS);
  return (
    <ul className="divide-y divide-[var(--border-hairline)]">
      {events.map((event) => (
        <EventRow key={event.id} event={event} now={now} />
      ))}
    </ul>
  );
}

export default function EventStream({
  events,
  maxHeightClass = 'max-h-[420px]',
  bare = false,
}: EventStreamProps) {
  const [activeFilter, setActiveFilter] = useState<StreamFilter>('ALL');
  const [pausedEvents, setPausedEvents] = useState<LiveEvent[] | null>(null);
  const isPaused = pausedEvents !== null;

  const sourceEvents = pausedEvents ?? events;

  // The feed is capped, so count what arrived ahead of the newest paused row
  // rather than comparing list lengths.
  const bufferedCount = useMemo(() => {
    if (!pausedEvents) return 0;
    const newestPausedId = pausedEvents[0]?.id;
    const position = events.findIndex((event) => event.id === newestPausedId);
    return position === -1 ? events.length : position;
  }, [events, pausedEvents]);

  const filteredEvents = useMemo(
    () =>
      activeFilter === 'ALL'
        ? sourceEvents
        : sourceEvents.filter((event) => categoryOf(event.type) === activeFilter),
    [sourceEvents, activeFilter]
  );

  return (
    <div className={`flex h-full flex-col overflow-hidden ${bare ? '' : 'matte-card p-5'}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="t-heading">Aliran Kejadian Telemetri</h3>
          <p className="t-meta text-[var(--text-muted)]">
            {filteredEvents.length} catatan terbaru{isPaused ? ' · dijeda' : ''}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={isPaused}
          onClick={() => setPausedEvents(isPaused ? null : events)}
          className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
            isPaused
              ? 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]'
              : 'border-transparent bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          title={isPaused ? 'Aliran dijeda — klik untuk melanjutkan' : 'Jeda aliran kejadian'}
        >
          <Pause aria-hidden="true" className="h-3 w-3" />
          {/* The label stays put and aria-pressed carries the state, as a toggle should. */}
          <span>Jeda{bufferedCount > 0 ? ` · +${bufferedCount} baru` : ''}</span>
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Saring kategori kejadian">
        {STREAM_FILTERS.map((filter) => {
          const selected = activeFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveFilter(filter.id)}
              className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold transition-colors ${
                selected
                  ? 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]'
                  : 'border-transparent bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* "additions" only: the age text refreshing in place must not be re-announced. */}
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Aliran kejadian telemetri"
        className={`flex-1 overflow-y-auto ${maxHeightClass}`}
      >
        {filteredEvents.length === 0 ? (
          <p className="t-meta py-10 text-center text-[var(--text-muted)]">
            {activeFilter === 'ALL' || sourceEvents.length === 0
              ? 'Belum ada kejadian'
              : `Belum ada kejadian pada kategori ${CATEGORY_LABEL[activeFilter]}`}
          </p>
        ) : (
          <EventList events={filteredEvents} />
        )}
      </div>
    </div>
  );
}
