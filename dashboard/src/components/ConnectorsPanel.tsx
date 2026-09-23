'use client';

import { useState, useEffect, useCallback } from 'react';

interface ConnectorInfo {
  id: string;
  name: string;
  status: string;
  type: string;
  class: string;
  topic: string;
  tasks_active: number;
  tasks_max: number;
  throughput: string;
  total_records: number;
  last_heartbeat: string;
  config?: Record<string, unknown>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

const STATUS_COLORS: Record<string, { text: string; dot: string }> = {
  RUNNING: { text: '#34d399', dot: '#10b981' },
  PAUSED: { text: '#fbbf24', dot: '#f59e0b' },
  FAILED: { text: '#ef4444', dot: '#ef4444' },
  PROVISIONING: { text: '#38bdf8', dot: '#38bdf8' },
};

const TYPE_ICONS: Record<string, string> = { source: '📥', sink: '📤' };

const DEFAULT_CONNECTORS: ConnectorInfo[] = [
  { id: 'lcc-12565d5', name: 'DatagenSource_SeismicTelemetry', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.stations', tasks_active: 1, tasks_max: 1, throughput: '~500 rec/s', total_records: 0, last_heartbeat: '', config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.stations', 'max.interval': '2000' } },
  { id: 'lcc-zmjwryd', name: 'DatagenSource_SeismicFeed', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.seismic', tasks_active: 1, tasks_max: 1, throughput: '~200 rec/s', total_records: 0, last_heartbeat: '', config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.seismic', 'max.interval': '5000' } },
  { id: 'lcc-3856g02', name: 'DatagenSource_OceanTsunami', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.tsunami', tasks_active: 1, tasks_max: 1, throughput: '~250 rec/s', total_records: 0, last_heartbeat: '', config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.tsunami', 'max.interval': '4000' } },
  { id: 'lcc-zmjwrpd', name: 'DatagenSource_WeatherFeed', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.weather', tasks_active: 1, tasks_max: 1, throughput: '~125 rec/s', total_records: 0, last_heartbeat: '', config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.weather', 'max.interval': '8000' } },
  { id: 'lcc-1256o0j', name: 'DatagenSource_SatelliteInSAR', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.satellite', tasks_active: 1, tasks_max: 1, throughput: '~100 rec/s', total_records: 0, last_heartbeat: '', config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.satellite', 'max.interval': '10000' } },
  { id: 'lcc-2256q0q', name: 'DatagenSource_Infrastructure', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.infrastructure', tasks_active: 1, tasks_max: 1, throughput: '~80 rec/s', total_records: 0, last_heartbeat: '', config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.infrastructure', 'max.interval': '12000' } },
  { id: 'lcc-zmjwrn0', name: 'DatagenSource_Population', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.population', tasks_active: 1, tasks_max: 1, throughput: '~65 rec/s', total_records: 0, last_heartbeat: '', config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.population', 'max.interval': '15000' } },
  { id: 'lcc-zmjwj5z', name: 'HttpSink_DisasterAlerts', status: 'RUNNING', type: 'sink', class: 'HttpSink', topic: 'gempa.correlated_alerts, gempa.tsunami_scenarios', tasks_active: 1, tasks_max: 1, throughput: 'event-driven', total_records: 0, last_heartbeat: '', config: { 'connector.class': 'HttpSink', 'topics': 'gempa.correlated_alerts,gempa.tsunami_scenarios', 'http.api.url': 'https://inatews-sentinel.vercel.app/api/webhook/alerts' } },
];

export default function ConnectorsPanel() {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>(DEFAULT_CONNECTORS);
  const [selectedConfig, setSelectedConfig] = useState<ConnectorInfo | null>(null);

  const fetchConnectors = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/connectors`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setConnectors(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchConnectors();
    const interval = setInterval(fetchConnectors, 15000);
    return () => clearInterval(interval);
  }, [fetchConnectors]);

  const runningCount = connectors.filter((c) => c.status === 'RUNNING').length;

  return (
    <div className="connectors-panel">
      <div className="connectors-panel__header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className="connectors-panel__title"><span>🔌</span> Confluent Connectors & Pipeline Hub</h2>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              {runningCount} ACTIVE — lkc-xq6wxz1
            </span>
          </div>
          <p className="connectors-panel__subtitle">7 DatagenSource → 12 Kafka Topics → 6 Flink SQL Jobs → HttpSink → Dashboard</p>
        </div>
      </div>

      {/* Pipeline Flow */}
      <div className="connectors-panel__pipeline">
        <span className="pipeline-pill" style={{ borderColor: '#00f2ff', color: '#00f2ff' }}>📥 7 Sources</span>
        <span className="pipeline-chevron">›</span>
        <span className="pipeline-pill" style={{ borderColor: '#ff9800', color: '#ff9800' }}>⚡ 12 Topics</span>
        <span className="pipeline-chevron">›</span>
        <span className="pipeline-pill" style={{ borderColor: '#a855f7', color: '#a855f7' }}>🔄 6 Flink Jobs</span>
        <span className="pipeline-chevron">›</span>
        <span className="pipeline-pill" style={{ borderColor: '#10b981', color: '#10b981' }}>📤 HttpSink</span>
        <span className="pipeline-chevron">›</span>
        <span className="pipeline-pill" style={{ borderColor: '#38bdf8', color: '#38bdf8' }}>🖥️ Dashboard</span>
      </div>

      {/* Connector Table */}
      <div className="connector-table">
        <div className="connector-table__header">
          <span className="connector-table__col connector-table__col--icon" />
          <span className="connector-table__col connector-table__col--name">Connector</span>
          <span className="connector-table__col connector-table__col--topic">Topic</span>
          <span className="connector-table__col connector-table__col--status">Status</span>
          <span className="connector-table__col connector-table__col--tasks">Tasks</span>
          <span className="connector-table__col connector-table__col--id">ID</span>
          <span className="connector-table__col connector-table__col--action" />
        </div>
        {connectors.map((c) => {
          const sc = STATUS_COLORS[c.status] || STATUS_COLORS.RUNNING;
          return (
            <div key={c.name} className="connector-table__row">
              <span className="connector-table__col connector-table__col--icon">{TYPE_ICONS[c.type] || '🔌'}</span>
              <span className="connector-table__col connector-table__col--name" title={c.name}>{c.name}</span>
              <span className="connector-table__col connector-table__col--topic" title={c.topic}>{c.topic}</span>
              <span className="connector-table__col connector-table__col--status" style={{ color: sc.text }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: sc.dot, marginRight: '4px' }} />
                {c.status}
              </span>
              <span className="connector-table__col connector-table__col--tasks">{c.tasks_active}/{c.tasks_max}</span>
              <span className="connector-table__col connector-table__col--id">{c.id}</span>
              <span className="connector-table__col connector-table__col--action">
                <button className="connector-btn connector-btn--info" onClick={() => setSelectedConfig(c)} style={{ padding: '2px 8px', fontSize: '10px' }}>📋</button>
              </span>
            </div>
          );
        })}
      </div>

      {selectedConfig && (
        <div className="config-modal__overlay" onClick={() => setSelectedConfig(null)}>
          <div className="config-modal" onClick={(e) => e.stopPropagation()}>
            <div className="config-modal__header">
              <h3>{selectedConfig.name}</h3>
              <button className="config-modal__close" onClick={() => setSelectedConfig(null)}>✕</button>
            </div>
            <div className="config-modal__body">
              <pre className="config-modal__json">{JSON.stringify(selectedConfig.config, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
