'use client';

import React, { useState } from 'react';
import type { IncidentEvent } from '@/lib/types';

interface CascadingHazardsFlowProps {
  incident: IncidentEvent | null;
  activeStage?: string;
}

interface CascadeNode {
  id: string;
  step: number;
  label: string;
  sub: string;
  icon: string;
  stream: string;
  telemetryKey: string;
  telemetryVal: string;
  windowSize: string;
  explanation: string;
}

const CASCADE_NODES: CascadeNode[] = [
  {
    id: 'SEISMIC_TRIGGER',
    step: 1,
    label: 'M7.8 Megathrust Earthquake',
    sub: 'Hypocenter 15km rupture at trench',
    icon: '⚡',
    stream: 'gempa.seismic',
    telemetryKey: 'Rupture Depth',
    telemetryVal: '15.0 km • M7.8',
    windowSize: '10s Tumbling Window',
    explanation: 'Initial broadband P-wave arrival detected across BMKG geodetic network.',
  },
  {
    id: 'INTENSITY_SPIKE',
    step: 2,
    label: 'High Seismic Intensity (MMI VII)',
    sub: 'Severe shaking & PGA > 0.68g recorded',
    icon: '📊',
    stream: 'gempa.stations',
    telemetryKey: 'Peak PGA',
    telemetryVal: '0.74g (Station YOGI)',
    windowSize: '30s Sliding Window',
    explanation: '4 telemetry stations (LEM, YOGI, JATS, CBJI) cross-validate ground motion above critical threshold.',
  },
  {
    id: 'SEABED_SLIP',
    step: 3,
    label: 'Seabed Fault Displacement',
    sub: 'InSAR 2.4m coseismic vertical slip',
    icon: '🛰️',
    stream: 'gempa.satellite',
    telemetryKey: 'Fault Displacement',
    telemetryVal: '2.40m vertical slip',
    windowSize: '1m Correlation Window',
    explanation: 'Copernicus Sentinel-1B radar confirms massive seafloor deformation indicative of water column displacement.',
  },
  {
    id: 'TSUNAMI_PROPAGATION',
    step: 4,
    label: 'Tsunami Wave Anomaly',
    sub: 'DART buoy 4.5m surge (ETA 18 min)',
    icon: '🌊',
    stream: 'gempa.tsunami',
    telemetryKey: 'Buoy Anomaly',
    telemetryVal: '+4.5m surge (Buoy #04)',
    windowSize: '2m Event-Time Window',
    explanation: 'InaTEWS deep ocean pressure sensor records acoustic-gravity pulse and sea-surface perturbation.',
  },
  {
    id: 'COASTAL_IMPACT',
    step: 5,
    label: 'Coastal Population Exposed',
    sub: '1.84M in inundation hazard buffer',
    icon: '👥',
    stream: 'gempa.population',
    telemetryKey: 'Exposed Citizens',
    telemetryVal: '1,842,000 residents',
    windowSize: '5m Aggregation Window',
    explanation: 'Spatial geofence join overlaps hydrodynamic wave runup model with high-density population data.',
  },
  {
    id: 'INFRASTRUCTURE_CRITICAL',
    step: 6,
    label: 'Road & Bridge Disruption',
    sub: '37 facilities & 12 routes disrupted',
    icon: '🌉',
    stream: 'gempa.infrastructure',
    telemetryKey: 'Critical Facilities',
    telemetryVal: '37 infra • 12 road cuts',
    windowSize: '5m Complex Join Window',
    explanation: 'Key coastal evacuation routes, Merak-Bakauheni ferry pier, and electrical sub-stations severed.',
  },
  {
    id: 'RESPONSE_DISPATCHED',
    step: 7,
    label: 'Tactical Response Directive',
    sub: 'Incident escalated → CRITICAL',
    icon: '🚨',
    stream: 'gempa.response',
    telemetryKey: 'Directive Target',
    telemetryVal: 'BNPB & BASARNAS',
    windowSize: '10m Evolving Incident State',
    explanation: 'Automated AI decision support publishes structured emergency evacuation orders to multi-agency dispatch.',
  },
];

export default function CascadingHazardsFlow({
  incident,
  activeStage,
}: CascadingHazardsFlowProps) {
  const currentStage = activeStage || incident?.cascading_stage || 'TSUNAMI_PROPAGATION';
  const [inspectedNode, setInspectedNode] = useState<CascadeNode | null>(null);

  const getNodeState = (nodeId: string, nodeStep: number) => {
    const stageOrder: Record<string, number> = {
      SEISMIC_TRIGGER: 1,
      STATION_CONFIRMED: 2,
      INTENSITY_SPIKE: 2,
      SEABED_SLIP: 3,
      TSUNAMI_PROPAGATION: 4,
      COASTAL_IMPACT: 5,
      INFRASTRUCTURE_CRITICAL: 6,
      RESPONSE_DISPATCHED: 7,
    };

    const currentOrder = stageOrder[currentStage] || 4;
    if (nodeStep < currentOrder) return 'completed';
    if (nodeStep === currentOrder) return 'active';
    return 'pending';
  };

  return (
    <div className="cascading-flow-card">
      <div className="cascading-flow__header">
        <div className="cascading-flow__title-wrap">
          <span className="cascading-flow__icon">⛓️</span>
          <div>
            <div className="cascading-flow__title">
              CASCADING HAZARD CORRELATION ENGINE
            </div>
            <div className="cascading-flow__subtitle">
              Single earthquake event triggering domino consequences correlated in motion across 7 Kafka streams
            </div>
          </div>
        </div>

        <div className="cascading-flow__header-actions">
          <span className="cascading-flow__badge">
            <span className="live-dot-pulse" style={{ background: '#00f2ff' }} />
            <span>FLINK STREAM LINEAGE</span>
          </span>
          <span className="cascading-flow__click-hint">
            💡 Klik stage untuk inspeksi
          </span>
        </div>
      </div>

      {/* Interactive Horizontal Flow Map */}
      <div className="cascading-flow__track">
        {CASCADE_NODES.map((node, index) => {
          const state = getNodeState(node.id, node.step);
          const isInspected = inspectedNode?.id === node.id;

          return (
            <div
              key={node.id}
              className={`cascading-flow-item cascading-flow-item--${state} ${
                isInspected ? 'cascading-flow-item--inspected' : ''
              }`}
              onClick={() => setInspectedNode(isInspected ? null : node)}
              title="Klik untuk melihat detail telemetri Flink & sensor"
            >
              <div className="cascading-flow-item__header">
                <div className={`node-avatar node-avatar--${state}`}>
                  <span>{node.icon}</span>
                  {state === 'active' && <span className="node-avatar__ping" />}
                </div>
                <div className="node-stage-meta">
                  <span className="node-stage-number">STAGE {node.step}</span>
                  <span className="node-stage-stream">{node.stream}</span>
                </div>
              </div>

              <div className="node-body">
                <div className="node-label">{node.label}</div>
                <div className="node-sub">{node.sub}</div>
              </div>

              <div className="node-footer">
                <span className="node-telemetry-badge">
                  {node.telemetryVal}
                </span>
                <span className="node-state-indicator">
                  {state === 'completed' ? '✓ CONFIRMED' : state === 'active' ? '● ESCALATING' : '○ PENDING'}
                </span>
              </div>

              {/* Connecting arrow connector */}
              {index < CASCADE_NODES.length - 1 && (
                <div
                  className={`node-connector-line node-connector-line--${
                    state === 'completed' ? 'active' : 'idle'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Node Telemetry Inspector Drawer */}
      {inspectedNode && (
        <div className="cascading-inspector-drawer">
          <div className="inspector-drawer__header">
            <div className="inspector-drawer__title">
              <span className="inspector-drawer__icon">{inspectedNode.icon}</span>
              <div>
                <strong>{inspectedNode.label}</strong>
                <span className="inspector-drawer__topic">Topic: <code>{inspectedNode.stream}</code></span>
              </div>
            </div>
            <button
              type="button"
              className="inspector-drawer__close"
              onClick={() => setInspectedNode(null)}
            >
              ✕ Tutup
            </button>
          </div>

          <div className="inspector-drawer__grid">
            <div className="inspector-box">
              <span className="inspector-box__label">Event-Time Window</span>
              <span className="inspector-box__val inspector-box__val--cyan">{inspectedNode.windowSize}</span>
            </div>
            <div className="inspector-box">
              <span className="inspector-box__label">Telemetry Record</span>
              <span className="inspector-box__val inspector-box__val--alert">{inspectedNode.telemetryVal}</span>
            </div>
            <div className="inspector-box" style={{ gridColumn: 'span 2' }}>
              <span className="inspector-box__label">Flink SQL Correlator Explanation</span>
              <p className="inspector-box__desc">{inspectedNode.explanation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
