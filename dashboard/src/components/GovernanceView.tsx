'use client';

import { useState, useEffect } from 'react';
import type { GovernanceInfo } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

const DEFAULT_GOVERNANCE: GovernanceInfo[] = [
  { topic: 'gempa.seismic', classification: 'Scientific', pii: 'None', schema_version: 'v1.0 (Avro)', owner: 'BMKG Seismology', access: 'Public' },
  { topic: 'gempa.stations', classification: 'Scientific', pii: 'None', schema_version: 'v1.0 (Avro)', owner: 'BMKG Network Ops', access: 'Public' },
  { topic: 'gempa.tsunami', classification: 'Scientific', pii: 'None', schema_version: 'v1.0 (Avro)', owner: 'InaTEWS Ocean Sensors', access: 'Public' },
  { topic: 'gempa.weather', classification: 'Scientific', pii: 'None', schema_version: 'v1.0 (JSON)', owner: 'BMKG Meteorology', access: 'Public' },
  { topic: 'gempa.satellite', classification: 'Scientific', pii: 'None', schema_version: 'v1.0 (Avro)', owner: 'BRIN / InSAR Ops', access: 'Public' },
  { topic: 'gempa.infrastructure', classification: 'Operational', pii: 'Potential', schema_version: 'v1.2 (Avro)', owner: 'PUPR & BNPB', access: 'Restricted' },
  { topic: 'gempa.population', classification: 'Sensitive', pii: 'Yes', schema_version: 'v2.0 (Avro + Encryption)', owner: 'BNPB Disaster Relief', access: 'Restricted' },
  { topic: 'gempa.intensity_index', classification: 'Derived', pii: 'None', schema_version: 'v1.0 (JSON)', owner: 'Apache Flink SQL', access: 'Internal' },
  { topic: 'gempa.correlated_alerts', classification: 'Derived', pii: 'None', schema_version: 'v1.0 (JSON)', owner: 'Apache Flink SQL', access: 'Internal' },
  { topic: 'gempa.tsunami_scenarios', classification: 'Derived', pii: 'None', schema_version: 'v1.0 (JSON)', owner: 'Apache Flink SQL', access: 'Internal' },
];

export default function GovernanceView() {
  const [governance, setGovernance] = useState<GovernanceInfo[]>(DEFAULT_GOVERNANCE);

  useEffect(() => {
    fetch(`${API_BASE}/api/governance`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setGovernance(data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="governance-view">
      {/* Header Banner */}
      <div className="card governance-header-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="governance-header-card__icon-wrap">
            <span style={{ fontSize: '28px' }}>🛡️</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Confluent Stream Governance & Schema Registry
              </h2>
              <span className="card__badge card__badge--live">CONFLUENT CLOUD ACTIVE</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Katalog tata kelola data streaming real-time, validasi skema Avro/JSON di Confluent Schema Registry, audit PII perlindungan data penduduk terdampak, dan kebijakan akses topik.
            </p>
          </div>
        </div>

        <div className="governance-kpis">
          <div className="gov-kpi-box">
            <span className="gov-kpi-box__label">SCHEMA REGISTRY</span>
            <span className="gov-kpi-box__val" style={{ color: 'var(--status-normal)' }}>ONLINE</span>
          </div>
          <div className="gov-kpi-box">
            <span className="gov-kpi-box__label">TOTAL TOPICS</span>
            <span className="gov-kpi-box__val">10 Topics</span>
          </div>
          <div className="gov-kpi-box">
            <span className="gov-kpi-box__label">PII PROTECTED</span>
            <span className="gov-kpi-box__val" style={{ color: '#00f2ff' }}>gempa.population</span>
          </div>
          <div className="gov-kpi-box">
            <span className="gov-kpi-box__label">FLINK SINKS</span>
            <span className="gov-kpi-box__val">3 Derived Topics</span>
          </div>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="card">
        <div className="card__header">
          <span className="card__title">
            <span className="card__title-icon">📋</span>
            Katalog Topik Kafka & Aturan Kebijakan Schema Registry
          </span>
          <span className="card__badge card__badge--neutral">10 TOPICS ENROLLED</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="gov-table">
            <thead>
              <tr>
                <th>TOPIC NAME</th>
                <th>KLASIFIKASI</th>
                <th>PII DATA</th>
                <th>SKEMA & VERSI</th>
                <th>DATA OWNER</th>
                <th>AKSES POLISI</th>
              </tr>
            </thead>
            <tbody>
              {governance.map((item) => (
                <tr key={item.topic}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#00f2ff' }}>
                    {item.topic}
                  </td>
                  <td>
                    <span
                      className={`gov-chip gov-chip--${
                        item.classification === 'Sensitive'
                          ? 'sensitive'
                          : item.classification === 'Derived'
                          ? 'derived'
                          : item.classification === 'Operational'
                          ? 'operational'
                          : 'scientific'
                      }`}
                    >
                      {item.classification}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '11px',
                        color:
                          item.pii === 'Yes'
                            ? 'var(--status-critical)'
                            : item.pii === 'Potential'
                            ? '#ff9800'
                            : 'var(--text-muted)',
                      }}
                    >
                      {item.pii === 'Yes' ? '🔒 Ya (Enkripsi)' : item.pii}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{item.schema_version}</td>
                  <td style={{ fontWeight: 600 }}>{item.owner}</td>
                  <td>
                    <span
                      className={`dash-table-badge ${
                        item.access === 'Public'
                          ? 'dash-table-badge--live'
                          : item.access === 'Restricted'
                          ? 'dash-table-badge--warn'
                          : 'dash-table-badge--neutral'
                      }`}
                    >
                      {item.access}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
