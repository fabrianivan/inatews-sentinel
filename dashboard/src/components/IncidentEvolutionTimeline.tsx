'use client';

import React, { useState, useMemo } from 'react';
import type { IncidentTimelineItem } from '@/lib/types';

interface IncidentEvolutionTimelineProps {
  timeline: IncidentTimelineItem[];
  incidentStatus?: string;
}

const DEFAULT_TIMELINE: IncidentTimelineItem[] = [
  {
    time: '09:41:02',
    timestamp: new Date().toISOString(),
    title: 'Earthquake detected',
    detail: 'M7.8 Megathrust rupture at South Java Trench (Depth 15km)',
    source: 'gempa.seismic',
    severity: 'CRITICAL',
  },
  {
    time: '09:41:08',
    timestamp: new Date().toISOString(),
    title: '4 stations confirmed P/S wave',
    detail: 'LEM, YOGI, JATS, CBJI recorded peak ground acceleration >0.68g',
    source: 'gempa.stations',
    severity: 'HIGH',
  },
  {
    time: '09:41:21',
    timestamp: new Date().toISOString(),
    title: 'Intensity calculated: MMI VII',
    detail: 'Flink CEP window aggregation computed severe shaking index 86%',
    source: 'gempa.intensity_index',
    severity: 'HIGH',
  },
  {
    time: '09:41:35',
    timestamp: new Date().toISOString(),
    title: 'InSAR seabed displacement',
    detail: 'Copernicus Sentinel-1B radar confirmed 2.4m coseismic fault slip',
    source: 'gempa.satellite',
    severity: 'HIGH',
  },
  {
    time: '09:41:46',
    timestamp: new Date().toISOString(),
    title: 'Tsunami anomaly detected',
    detail: 'InaTEWS DART Buoy #04 registered 4.5m wave height anomaly (ETA 18 min)',
    source: 'gempa.tsunami',
    severity: 'CRITICAL',
  },
  {
    time: '09:42:10',
    timestamp: new Date().toISOString(),
    title: 'Coastal population exposure increased',
    detail: '1.84M residents at risk across Pangandaran, Cilacap, & Pacitan',
    source: 'gempa.population',
    severity: 'CRITICAL',
  },
  {
    time: '09:42:35',
    timestamp: new Date().toISOString(),
    title: 'Infrastructure impact detected',
    detail: '37 critical facilities & 12 evacuation routes reporting severe disruptions',
    source: 'gempa.infrastructure',
    severity: 'HIGH',
  },
  {
    time: '09:43:00',
    timestamp: new Date().toISOString(),
    title: 'Incident escalated → CRITICAL',
    detail: 'Emergency multi-agency evacuation assessment dispatched',
    source: 'gempa.response',
    severity: 'CRITICAL',
  },
];

const STREAM_FILTERS = [
  { id: 'ALL', label: 'Semua Stream' },
  { id: 'gempa.seismic', label: 'Seismic' },
  { id: 'gempa.stations', label: 'Stations' },
  { id: 'gempa.tsunami', label: 'Tsunami' },
  { id: 'gempa.satellite', label: 'InSAR' },
  { id: 'gempa.infrastructure', label: 'Infra' },
  { id: 'gempa.response', label: 'Response' },
];

export default function IncidentEvolutionTimeline({
  timeline,
  incidentStatus = 'ESCALATING',
}: IncidentEvolutionTimelineProps) {
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const rawItems = timeline && timeline.length > 0 ? timeline : DEFAULT_TIMELINE;

  const filteredItems = useMemo(() => {
    return rawItems.filter((item) => {
      const matchFilter = selectedFilter === 'ALL' || item.source === selectedFilter;
      const matchSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.detail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.source.toLowerCase().includes(searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [rawItems, selectedFilter, searchQuery]);

  const severityBadgeClass = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'timeline-badge--critical';
      case 'HIGH':
        return 'timeline-badge--high';
      case 'ELEVATED':
        return 'timeline-badge--elevated';
      default:
        return 'timeline-badge--normal';
    }
  };

  const handleCopyLog = () => {
    const formatted = filteredItems
      .map((i) => `[${i.time}] [${i.source}] [${i.severity}] ${i.title} — ${i.detail}`)
      .join('\n');
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="incident-timeline-card">
      {/* Header Bar */}
      <div className="incident-timeline__header">
        <div className="incident-timeline__title-wrap">
          <span className="incident-timeline__icon">🕒</span>
          <div>
            <div className="incident-timeline__title">
              INCIDENT EVOLUTION & TIME-WINDOW CORRELATION
            </div>
            <div className="incident-timeline__sub">
              Chronological log of multi-sensor correlations arriving into Confluent Cloud
            </div>
          </div>
        </div>

        <div className="incident-timeline__actions">
          <button
            type="button"
            className="timeline-action-btn"
            onClick={handleCopyLog}
            title="Salin kronologi insiden ke clipboard"
          >
            {copied ? '✓ Tersalin!' : '📋 Salin Log'}
          </button>
          <div className="incident-timeline__meta">
            <span className="live-dot-pulse" style={{ background: '#00f2ff' }} />
            <span>REAL-TIME STREAMING LOG</span>
          </div>
        </div>
      </div>

      {/* Interactive Controls Bar: Filters & Search */}
      <div className="timeline-interactive-bar">
        <div className="timeline-filter-pills">
          {STREAM_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`timeline-filter-pill ${selectedFilter === f.id ? 'timeline-filter-pill--active' : ''}`}
              onClick={() => setSelectedFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="timeline-search-wrap">
          <input
            type="text"
            className="timeline-search-input"
            placeholder="Cari event atau sensor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="timeline-search-clear"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Timeline List */}
      <div className="incident-timeline__list">
        {filteredItems.length === 0 ? (
          <div className="timeline-empty-state">
            Tidak ada event yang cocok dengan filter atau kata kunci pencarian.
          </div>
        ) : (
          filteredItems.map((item, idx) => (
            <div key={`${item.time}-${idx}`} className="incident-timeline__row">
              <div className="incident-timeline__time-cell">
                <span className="incident-timeline__time">{item.time}</span>
                <span className="incident-timeline__source-tag">{item.source}</span>
              </div>

              <div className="incident-timeline__content-cell">
                <div className="incident-timeline__title-line">
                  <span className={`incident-timeline__severity ${severityBadgeClass(item.severity)}`}>
                    {item.severity}
                  </span>
                  <span className="incident-timeline__item-title">{item.title}</span>
                </div>
                <div className="incident-timeline__item-detail">{item.detail}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
