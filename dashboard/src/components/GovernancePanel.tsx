'use client';

import { useState, useEffect } from 'react';
import type { GovernanceInfo } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

interface GovernancePanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function GovernancePanel({ isOpen, onClose }: GovernancePanelProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (val: boolean) => {
    setInternalOpen(val);
    if (!val && onClose) onClose();
  };
  const [governance, setGovernance] = useState<GovernanceInfo[]>([]);

  useEffect(() => {
    if (open && governance.length === 0) {
      fetch(`${API_BASE}/api/governance`)
        .then(res => res.json())
        .then(data => setGovernance(data))
        .catch(() => {
          // Use fallback data
          setGovernance([
            { topic: 'gempa.seismic', classification: 'Scientific', pii: 'None', schema_version: 'v1', owner: 'BMKG Seismology', access: 'Public' },
            { topic: 'gempa.stations', classification: 'Scientific', pii: 'None', schema_version: 'v1', owner: 'BMKG Network Ops', access: 'Public' },
            { topic: 'gempa.tsunami', classification: 'Scientific', pii: 'None', schema_version: 'v1', owner: 'InaTEWS Ocean Sensors', access: 'Public' },
            { topic: 'gempa.weather', classification: 'Scientific', pii: 'None', schema_version: 'v1', owner: 'BMKG Meteorology', access: 'Public' },
            { topic: 'gempa.satellite', classification: 'Scientific', pii: 'None', schema_version: 'v1', owner: 'BRIN / InSAR Ops', access: 'Public' },
            { topic: 'gempa.infrastructure', classification: 'Operational', pii: 'Potential', schema_version: 'v1', owner: 'PUPR & BNPB', access: 'Restricted' },
            { topic: 'gempa.population', classification: 'Sensitive', pii: 'Yes', schema_version: 'v2', owner: 'BNPB Disaster Relief', access: 'Restricted' },
            { topic: 'gempa.intensity_index', classification: 'Derived', pii: 'None', schema_version: 'v1', owner: 'Flink Pipeline', access: 'Internal' },
            { topic: 'gempa.correlated_alerts', classification: 'Derived', pii: 'None', schema_version: 'v1', owner: 'Flink Pipeline', access: 'Internal' },
            { topic: 'gempa.tsunami_scenarios', classification: 'Derived', pii: 'None', schema_version: 'v1', owner: 'Flink Pipeline', access: 'Internal' },
          ]);
        });
    }
  }, [open, governance.length]);

  return (
    <>
      <button
        className="governance-toggle"
        onClick={() => setOpen(!open)}
        title="Data Governance"
      >
        🛡
      </button>

      <div className={`governance-drawer__overlay ${open ? 'governance-drawer__overlay--visible' : ''}`}
           onClick={() => setOpen(false)} />

      <div className={`governance-drawer ${open ? 'governance-drawer--open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              🛡 Data Governance
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Schema Registry + Topic Classification
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'none',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ✕
          </button>
        </div>

        {governance.map((item) => (
          <div key={item.topic} className="governance-item">
            <div className="governance-item__topic">{item.topic}</div>
            <div className="governance-item__detail">
              <span className="governance-item__label">Classification</span>
              <span className={`governance-item__value ${item.classification === 'Sensitive' ? 'governance-item__value--sensitive' : ''}`}>
                {item.classification}
              </span>
            </div>
            <div className="governance-item__detail">
              <span className="governance-item__label">PII</span>
              <span className={`governance-item__value ${item.pii === 'Yes' ? 'governance-item__value--restricted' : ''}`}>
                {item.pii}
              </span>
            </div>
            <div className="governance-item__detail">
              <span className="governance-item__label">Schema</span>
              <span className="governance-item__value">{item.schema_version}</span>
            </div>
            <div className="governance-item__detail">
              <span className="governance-item__label">Owner</span>
              <span className="governance-item__value">{item.owner}</span>
            </div>
            <div className="governance-item__detail">
              <span className="governance-item__label">Access</span>
              <span className={`governance-item__value ${item.access === 'Restricted' ? 'governance-item__value--restricted' : ''}`}>
                {item.access}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
