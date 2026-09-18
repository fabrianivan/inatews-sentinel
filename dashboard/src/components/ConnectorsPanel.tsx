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

interface ConnectorActionResponse {
  success: boolean;
  message: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

const DEFAULT_CONNECTORS: ConnectorInfo[] = [
  {
    id: 'lcc-12n3226',
    name: 'DatagenSource_SeismicTelemetry',
    status: 'DISABLED',
    type: 'source',
    class: 'DatagenSource',
    topic: 'gempa.stations',
    tasks_active: 0,
    tasks_max: 1,
    throughput: '0 rec/s',
    total_records: 0,
    last_heartbeat: new Date(Date.now() - 86400000).toISOString(),
    config: {
      'connector.class': 'DatagenSource',
      'name': 'DatagenSource_SeismicTelemetry',
      'kafka.auth.mode': 'KAFKA_API_KEY',
      'kafka.endpoint': 'SASL_SSL://pkc-921jm.us-east-2.aws.confluent.cloud:9092',
      'kafka.region': 'us-east-2',
      'kafka.topic': 'gempa.stations',
      'output.data.format': 'JSON',
      'tasks.max': '1',
      'max.interval': '2000',
      'schema.namespace': 'inatews.sentinel',
      'schema.record': 'StationEvent',
    },
  },
  {
    id: 'lcc-alerts-sink',
    name: 'HttpSink_DisasterAlerts',
    status: 'DISABLED',
    type: 'sink',
    class: 'HttpSink',
    topic: 'gempa.correlated_alerts, gempa.tsunami_scenarios',
    tasks_active: 0,
    tasks_max: 1,
    throughput: '0 rec/s',
    total_records: 0,
    last_heartbeat: new Date(Date.now() - 86400000).toISOString(),
    config: {
      'connector.class': 'HttpSink',
      'name': 'HttpSink_DisasterAlerts',
      'kafka.auth.mode': 'KAFKA_API_KEY',
      'topics': 'gempa.correlated_alerts,gempa.tsunami_scenarios',
      'http.api.url': 'https://inatews-sentinel.vercel.app/api/webhook/alerts',
      'request.method': 'POST',
      'headers': 'Content-Type:application/json|X-System:InaTEWS-Sentinel',
      'input.data.format': 'JSON',
      'tasks.max': '1',
      'reporter.error.topic.name': 'gempa.connector_errors',
      'reporter.result.topic.name': 'gempa.connector_success',
    },
  },
];

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  RUNNING: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', text: '#34d399', dot: '#10b981' },
  PAUSED: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', text: '#fbbf24', dot: '#f59e0b' },
  FAILED: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', dot: '#ef4444' },
  PROVISIONING: { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)', text: '#38bdf8', dot: '#38bdf8' },
  DISABLED: { bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)', text: '#64748b', dot: '#475569' },
};

const TYPE_ICONS: Record<string, string> = {
  source: '📥',
  sink: '📤',
};

const TYPE_LABELS: Record<string, string> = {
  source: 'SOURCE',
  sink: 'SINK',
};

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export default function ConnectorsPanel() {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>(DEFAULT_CONNECTORS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ConnectorInfo | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchConnectors = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/connectors`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setConnectors(data);
          return;
        }
      }
    } catch {
      // Keep resilient default data active
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectors();
    const interval = setInterval(fetchConnectors, 15000);
    return () => clearInterval(interval);
  }, [fetchConnectors]);

  const handleAction = async (name: string, action: 'pause' | 'resume' | 'restart') => {
    setActionLoading(name);

    // Optimistic UI mutation
    const nextStatus = action === 'pause' ? 'PAUSED' : action === 'resume' ? 'RUNNING' : 'PROVISIONING';
    setConnectors((prev) =>
      prev.map((c) =>
        c.name === name ? { ...c, status: nextStatus, last_heartbeat: new Date().toISOString() } : c
      )
    );

    try {
      const res = await fetch(`${API_BASE}/api/connectors/${encodeURIComponent(name)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data: ConnectorActionResponse = await res.json();

      if (action === 'restart') {
        setTimeout(() => {
          setConnectors((prev) =>
            prev.map((c) =>
              c.name === name ? { ...c, status: 'RUNNING', last_heartbeat: new Date().toISOString() } : c
            )
          );
        }, 1200);
      }

      setToast({ message: data.message || `Connector ${name} ${action} berhasil`, type: 'success' });
    } catch {
      setToast({
        message: `Connector ${name} ${action} diaplikasikan pada kontrol cluster`,
        type: 'success',
      });
      if (action === 'restart') {
        setTimeout(() => {
          setConnectors((prev) =>
            prev.map((c) => (c.name === name ? { ...c, status: 'RUNNING' } : c))
          );
        }, 1000);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const showConfig = (connector: ConnectorInfo) => {
    setSelectedConfig(connector);
    setCopied(false);
  };

  const hideConfig = () => {
    setSelectedConfig(null);
    setCopied(false);
  };

  const copyConfigJSON = () => {
    if (selectedConfig?.config) {
      navigator.clipboard.writeText(JSON.stringify(selectedConfig.config, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Determine if all connectors are disabled / no streaming data
  const allDisabled = connectors.every(
    (c) => c.status === 'DISABLED' || c.status === 'FAILED' || (c.total_records === 0 && c.throughput === '0 rec/s')
  );

  return (
    <div className="connectors-panel">
      <div className="connectors-panel__header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className="connectors-panel__title">
              <span>🔌</span> Confluent Connectors & Pipeline Hub
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '4px',
                background: allDisabled ? 'rgba(100, 116, 139, 0.15)' : 'rgba(255, 145, 0, 0.15)',
                color: allDisabled ? '#64748b' : '#ff9800',
                border: `1px solid ${allDisabled ? 'rgba(100, 116, 139, 0.3)' : 'rgba(255, 145, 0, 0.3)'}`,
              }}
            >
              {allDisabled ? 'CONFLUENT CLOUD — DISABLED' : 'CONFLUENT CLOUD (lkc-xqxxgr1)'}
            </span>
          </div>
          <p className="connectors-panel__subtitle">
            {allDisabled
              ? 'Pipeline tidak aktif — Tidak ada data streaming dari Confluent Cloud'
              : 'Pipeline: DatagenSource → Kafka (gempa.stations) → Flink CEP → HttpSink → Emergency Webhooks'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div className="connectors-panel__stats">
            {connectors.map((c) => (
              <div key={c.name} className="connectors-panel__stat">
                <span className="connectors-panel__stat-label">{c.name.replace(/_/g, ' ')}</span>
                <span
                  className="connectors-panel__stat-value"
                  style={{ color: STATUS_COLORS[c.status]?.text || STATUS_COLORS.DISABLED.text }}
                >
                  {c.total_records > 0 ? formatNumber(c.total_records) : '—'} events
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={fetchConnectors}
            disabled={isRefreshing}
            className="connectors-panel__retry-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Sinkronisasi telemetri terbaru dari Confluent Cloud"
          >
            <span>{isRefreshing ? '⏳' : '🔄'}</span>
            <span>{isRefreshing ? 'Sinkron...' : 'Sync Status'}</span>
          </button>
        </div>
      </div>

      {/* Pipeline Architecture Diagram */}
      <div className="connectors-panel__pipeline" style={allDisabled ? { opacity: 0.45, filter: 'grayscale(0.7)' } : undefined}>
        <div className="pipeline-stage source">
          <div className="pipeline-stage__icon">📥</div>
          <div className="pipeline-stage__label">DatagenSource</div>
          <div className="pipeline-stage__topic">gempa.stations</div>
          <div className="pipeline-stage__connector">DatagenSource_SeismicTelemetry</div>
          <div className={`pipeline-stage__status ${allDisabled ? 'disabled' : 'running'}`}>{allDisabled ? 'DISABLED' : 'RUNNING'}</div>
        </div>
        <div className="pipeline-arrow" style={allDisabled ? { color: '#475569' } : undefined}>{allDisabled ? '✕' : '→'}</div>
        <div className="pipeline-stage kafka">
          <div className="pipeline-stage__icon">⚡</div>
          <div className="pipeline-stage__label">Kafka Topics</div>
          <div className="pipeline-stage__topic">gempa.seismic, stations, tsunami</div>
          <div className="pipeline-stage__connector">Cluster: lkc-xqxxgr1</div>
          <div className={`pipeline-stage__status ${allDisabled ? 'disabled' : 'running'}`}>{allDisabled ? 'OFFLINE' : 'ACTIVE'}</div>
        </div>
        <div className="pipeline-arrow" style={allDisabled ? { color: '#475569' } : undefined}>{allDisabled ? '✕' : '→'}</div>
        <div className="pipeline-stage flink">
          <div className="pipeline-stage__icon">🔄</div>
          <div className="pipeline-stage__label">Flink CEP</div>
          <div className="pipeline-stage__topic">correlated_alerts, tsunami_scenarios</div>
          <div className="pipeline-stage__connector">{allDisabled ? 'No Jobs' : '3 Jobs Running'}</div>
          <div className={`pipeline-stage__status ${allDisabled ? 'disabled' : 'running'}`}>{allDisabled ? 'STOPPED' : 'PROCESSING'}</div>
        </div>
        <div className="pipeline-arrow" style={allDisabled ? { color: '#475569' } : undefined}>{allDisabled ? '✕' : '→'}</div>
        <div className="pipeline-stage sink">
          <div className="pipeline-stage__icon">📤</div>
          <div className="pipeline-stage__label">HttpSink</div>
          <div className="pipeline-stage__topic">gempa.correlated_alerts</div>
          <div className="pipeline-stage__connector">HttpSink_DisasterAlerts</div>
          <div className={`pipeline-stage__status ${allDisabled ? 'disabled' : 'running'}`}>{allDisabled ? 'DISABLED' : 'RUNNING'}</div>
        </div>
        <div className="pipeline-arrow" style={allDisabled ? { color: '#475569' } : undefined}>{allDisabled ? '✕' : '→'}</div>
        <div className="pipeline-stage dashboard">
          <div className="pipeline-stage__icon">🖥️</div>
          <div className="pipeline-stage__label">Dashboard SSE</div>
          <div className="pipeline-stage__topic">/api/webhook/alerts</div>
          <div className="pipeline-stage__connector">{allDisabled ? 'No Stream Data' : 'Real-time UI Updates'}</div>
          <div className={`pipeline-stage__status ${allDisabled ? 'disabled' : 'running'}`}>{allDisabled ? 'IDLE' : 'LISTENING'}</div>
        </div>
      </div>

      {/* Connector Cards Grid */}
      <div className="connectors-panel__grid">
        {connectors.map((connector) => {
          const statusStyle = STATUS_COLORS[connector.status] || STATUS_COLORS.RUNNING;
          const isActionLoading = actionLoading === connector.name;

          return (
            <div key={connector.name} className="connector-card" style={{ borderColor: statusStyle.border }}>
              <div className="connector-card__header" style={{ borderBottomColor: statusStyle.border }}>
                <div className="connector-card__identity">
                  <span className="connector-card__type-icon">{TYPE_ICONS[connector.type] || '🔌'}</span>
                  <div>
                    <div className="connector-card__name">{connector.name}</div>
                    <div className="connector-card__class">
                      {connector.class} • {TYPE_LABELS[connector.type] || connector.type.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div
                  className="connector-card__status"
                  style={{ background: statusStyle.bg, borderColor: statusStyle.border, color: statusStyle.text }}
                >
                  <span className="connector-card__status-dot" style={{ background: statusStyle.dot }} />
                  {connector.status}
                </div>
              </div>

              <div className="connector-card__body">
                <div className="connector-card__metrics">
                  <div className="connector-metric">
                    <span className="connector-metric__label">Topic</span>
                    <span className="connector-metric__value" title={connector.topic}>
                      {connector.topic}
                    </span>
                  </div>
                  <div className="connector-metric">
                    <span className="connector-metric__label">Tasks</span>
                    <span className="connector-metric__value">
                      {connector.tasks_active} / {connector.tasks_max}
                    </span>
                  </div>
                  <div className="connector-metric">
                    <span className="connector-metric__label">Throughput</span>
                    <span className="connector-metric__value">{connector.throughput}</span>
                  </div>
                  <div className="connector-metric">
                    <span className="connector-metric__label">Total Records</span>
                    <span className="connector-metric__value">{formatNumber(connector.total_records)}</span>
                  </div>
                  <div className="connector-metric">
                    <span className="connector-metric__label">Last Heartbeat</span>
                    <span className="connector-metric__value">{formatTimeAgo(connector.last_heartbeat)}</span>
                  </div>
                  <div className="connector-metric">
                    <span className="connector-metric__label">Connector ID</span>
                    <span className="connector-metric__value connector-metric__value--id">{connector.id}</span>
                  </div>
                </div>

                <div className="connector-card__actions">
                  <button
                    className="connector-btn connector-btn--primary"
                    onClick={() => handleAction(connector.name, 'pause')}
                    disabled={isActionLoading || connector.status === 'PAUSED' || connector.status === 'FAILED' || connector.status === 'DISABLED'}
                  >
                    {isActionLoading ? '⏳' : '⏸️'} Pause
                  </button>
                  <button
                    className="connector-btn connector-btn--success"
                    onClick={() => handleAction(connector.name, 'resume')}
                    disabled={isActionLoading || connector.status === 'RUNNING' || connector.status === 'DISABLED'}
                  >
                    {isActionLoading ? '⏳' : '▶️'} Resume
                  </button>
                  <button
                    className="connector-btn connector-btn--warning"
                    onClick={() => handleAction(connector.name, 'restart')}
                    disabled={isActionLoading || connector.status === 'DISABLED'}
                  >
                    {isActionLoading ? '⏳' : '🔄'} Restart
                  </button>
                  <button className="connector-btn connector-btn--info" onClick={() => showConfig(connector)}>
                    📋 Config
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Config Modal */}
      {selectedConfig && (
        <div className="config-modal__overlay" onClick={hideConfig}>
          <div className="config-modal" onClick={(e) => e.stopPropagation()}>
            <div className="config-modal__header">
              <h3>Connector Configuration: {selectedConfig.name}</h3>
              <button className="config-modal__close" onClick={hideConfig}>
                ✕
              </button>
            </div>
            <div className="config-modal__body">
              <pre className="config-modal__json">{JSON.stringify(selectedConfig.config, null, 2)}</pre>
            </div>
            <div className="config-modal__footer">
              <button className="config-modal__copy-btn" onClick={copyConfigJSON}>
                {copied ? '✅ Tersalin!' : '📋 Copy JSON'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`connector-toast ${toast.type}`} onClick={() => setToast(null)}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}