'use client';

import type { InfrastructureEvent } from '@/lib/types';

interface InfrastructureImpactPanelProps {
  events: InfrastructureEvent[];
}

const levelRank: Record<string, number> = { NONE: 0, MINOR: 1, MODERATE: 2, SEVERE: 3, COLLAPSED: 4 };

function levelClass(level: string): string {
  const normalized = level.toUpperCase();
  if (normalized === 'SEVERE' || normalized === 'COLLAPSED') return 'infrastructure-impact__level--critical';
  if (normalized === 'MODERATE') return 'infrastructure-impact__level--high';
  if (normalized === 'MINOR') return 'infrastructure-impact__level--medium';
  return 'infrastructure-impact__level--normal';
}

export default function InfrastructureImpactPanel({ events }: InfrastructureImpactPanelProps) {
  const affected = events.filter((event) => event.damage_level !== 'NONE');
  const offline = events.filter((event) => !event.operational);
  const highest = events.reduce((current, event) => (
    (levelRank[event.damage_level] || 0) > (levelRank[current] || 0) ? event.damage_level : current
  ), 'NONE');

  return (
    <section className="infrastructure-impact card">
      <div className="card__header">
        <span className="card__title"><span className="card__title-icon">🏗️</span> Infrastructure Impact Command</span>
        <span className="card__badge card__badge--flink">LIVE ASSESSMENT</span>
      </div>
      <div className="infrastructure-impact__body">
        <div className="infrastructure-impact__summary">
          <div><strong>{affected.length}</strong><span>impacted assets</span></div>
          <div><strong className={offline.length ? 'critical' : ''}>{offline.length}</strong><span>offline</span></div>
          <div><strong className={levelClass(highest)}>{highest}</strong><span>highest severity</span></div>
        </div>
        <div className="infrastructure-impact__grid">
          {events.slice(0, 6).map((event) => (
            <article className="infrastructure-impact__asset" key={event.facility_id}>
              <div className="infrastructure-impact__asset-head">
                <div>
                  <strong>{event.facility_name}</strong>
                  <span>{event.facility_type} · {event.facility_id}</span>
                </div>
                <span className={`infrastructure-impact__level ${levelClass(event.damage_level)}`}>{event.damage_level}</span>
              </div>
              <div className="infrastructure-impact__asset-meta">
                <span>{event.operational ? '● OPERATIONAL' : '● OFFLINE'}</span>
                <span>{event.latitude.toFixed(2)}, {event.longitude.toFixed(2)}</span>
              </div>
            </article>
          ))}
          {events.length === 0 && <div className="infrastructure-impact__empty">Awaiting critical asset telemetry...</div>}
        </div>
      </div>
    </section>
  );
}
