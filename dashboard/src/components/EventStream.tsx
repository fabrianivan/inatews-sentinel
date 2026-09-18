'use client';

import { useState, useEffect } from 'react';
import type { LiveEvent } from '@/lib/types';

interface EventStreamProps {
  events: LiveEvent[];
}

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--:--';
  }
}

function typeClass(type: string): string {
  switch (type.toUpperCase()) {
    case 'SEISMIC': return 'event-stream__type--seismic';
    case 'VOLCANIC': return 'event-stream__type--volcanic';
    case 'OCEAN': return 'event-stream__type--ocean';
    case 'WEATHER': return 'event-stream__type--weather';
    case 'SATELLITE': return 'event-stream__type--satellite';
    case 'MARITIME': return 'event-stream__type--maritime';
    default: return '';
  }
}

function severityClass(severity: string): string {
  switch (severity.toUpperCase()) {
    case 'CRITICAL': return 'event-stream__severity--critical';
    case 'HIGH': return 'event-stream__severity--high';
    case 'MEDIUM': return 'event-stream__severity--medium';
    default: return 'event-stream__severity--low';
  }
}

function severityItemClass(severity: string): string {
  switch (severity.toUpperCase()) {
    case 'CRITICAL': return 'event-stream__item--critical';
    case 'HIGH': return 'event-stream__item--high';
    case 'MEDIUM': return 'event-stream__item--medium';
    default: return '';
  }
}

export default function EventStream({ events }: EventStreamProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [paused, setPaused] = useState(false);
  const [visibleEvents, setVisibleEvents] = useState(events);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!paused) setVisibleEvents(events);
  }, [events, paused]);

  const filteredEvents = visibleEvents.filter((event) => {
    if (filter === 'CRITICAL') return event.severity === 'CRITICAL' || event.severity === 'HIGH';
    if (filter === 'SEISMIC') return event.type.toUpperCase() === 'SEISMIC';
    if (filter === 'OCEAN') return event.type.toUpperCase() === 'OCEAN';
    if (filter === 'WEATHER') return event.type.toUpperCase() === 'WEATHER';
    return true;
  });

  const handlePauseToggle = () => {
    if (paused) setVisibleEvents(events);
    setPaused((current) => !current);
  };

  return (
    <div className="card event-stream">
      <div className="card__header">
        <span className="card__title">
          <span className="card__title-icon">📜</span>
          Live Event Stream
        </span>
        <div className="event-stream__controls">
          <label className="event-stream__filter-label" htmlFor="event-filter">Filter</label>
          <select
            id="event-filter"
            className="event-stream__filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter live events"
          >
            <option value="ALL">Semua</option>
            <option value="CRITICAL">Prioritas</option>
            <option value="SEISMIC">Seismik</option>
            <option value="OCEAN">Laut</option>
            <option value="WEATHER">Cuaca</option>
          </select>
          <button
            type="button"
            className={`event-stream__pause ${paused ? 'event-stream__pause--active' : ''}`}
            onClick={handlePauseToggle}
            aria-pressed={paused}
          >
            {paused ? '▶ Lanjut' : 'Ⅱ Jeda'}
          </button>
          <span className="card__badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
            {filteredEvents.length}/{events.length}
          </span>
        </div>
      </div>
      <div className="event-stream__list">
        {filteredEvents.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            {events.length === 0 ? 'Menunggu event masuk...' : 'Tidak ada event untuk filter ini.'}
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div key={event.id} className={`event-stream__item ${severityItemClass(event.severity)}`}>
              <div className={`event-stream__severity ${severityClass(event.severity)}`} />
              <span className="event-stream__time" suppressHydrationWarning>
                {isMounted ? formatTime(event.timestamp) : '--:--:--'}
              </span>
              <span className={`event-stream__type ${typeClass(event.type)}`}>
                {event.type}
              </span>
              <span className="event-stream__desc">{event.description}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
