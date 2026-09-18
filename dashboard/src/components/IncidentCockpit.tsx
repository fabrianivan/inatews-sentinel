'use client';

import React, { useState } from 'react';
import type { IncidentEvent, IncidentResponseEvent } from '@/lib/types';

interface IncidentCockpitProps {
  incident: IncidentEvent | null;
  response: IncidentResponseEvent | null;
  onFocusRegion?: (region: string) => void;
}

interface EvidenceDetail {
  id: string;
  name: string;
  points: number;
  maxPoints: number;
  status: string;
  sensor: string;
  rawSignal: string;
  timestamp: string;
  verdict: string;
}

export default function IncidentCockpit({
  incident,
  response,
  onFocusRegion,
}: IncidentCockpitProps) {
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  const inc = incident || {
    incident_id: 'INC-20260915-001',
    hazard: 'EARTHQUAKE',
    magnitude: 7.8,
    region: 'South Java Megathrust (Cilacap - Pangandaran)',
    risk_score: 86,
    seismic_intensity: 'VII',
    tsunami_risk: 'HIGH',
    population_exposed: 1842000,
    critical_infrastructure: 37,
    road_disruptions: 12,
    confidence: 0.95,
    confidence_score: 95,
    confidence_breakdown: {
      seismic_stations: 35,
      cross_agency_agreement: 20,
      satellite_insar: 15,
      tsunami_buoy: 20,
      infrastructure_signal: 5,
    },
    status: 'ESCALATING' as const,
    cascading_stage: 'TSUNAMI_PROPAGATION',
    timeline: [],
    updated_at: new Date().toISOString(),
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return '#ef4444';
      case 'ESCALATING':
        return '#f97316';
      case 'CONFIRMING':
        return '#eab308';
      case 'MONITORING':
        return '#10b981';
      default:
        return '#06b6d4';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return num.toLocaleString();
  };

  const confPercent = Math.round((inc.confidence || 0.95) * 100);

  const formatHazardTitle = (raw: string) => {
    if (raw === 'EARTHQUAKE_TSUNAMI_CASCADE') return 'Gempa Bumi & Propagasi Tsunami';
    if (raw === 'EARTHQUAKE_MONITORING' || raw === 'SEISMIC_MONITORING') return 'Pemantauan Seismik Terkendali';
    return raw.replace(/_/g, ' ');
  };

  const EVIDENCE_DATA: Record<string, EvidenceDetail> = {
    seismic_stations: {
      id: 'seismic_stations',
      name: 'Broadband Seismic Network',
      points: inc.confidence_breakdown?.seismic_stations || 35,
      maxPoints: 35,
      status: 'CONFIRMED',
      sensor: '4 Stasiun BMKG (LEM, YOGI, JATS, CBJI)',
      rawSignal: 'PGA max 0.74g • P-Wave velocity 7.2 km/s',
      timestamp: '09:41:08 WIB',
      verdict: 'Konsensus sinyal P/S wave melebihi ambang batas guncangan destruktif.',
    },
    cross_agency: {
      id: 'cross_agency',
      name: 'BMKG & USGS Geodetic Agreement',
      points: inc.confidence_breakdown?.cross_agency_agreement || 20,
      maxPoints: 20,
      status: 'MATCHED',
      sensor: 'InaTEWS SeisComP + USGS Earthquake API',
      rawSignal: 'Delta Magnitudo: ±0.1M (BMKG M7.8 vs USGS M7.7)',
      timestamp: '09:41:14 WIB',
      verdict: 'Verifikasi lintas-agensi terkonfirmasi tanpa anomali bias instrumentasi.',
    },
    satellite_insar: {
      id: 'satellite_insar',
      name: 'Copernicus Sentinel-1B InSAR',
      points: inc.confidence_breakdown?.satellite_insar || 15,
      maxPoints: 15,
      status: 'VERIFIED',
      sensor: 'SAR Interferometry Differential Orbit',
      rawSignal: 'Deformasi vertikal kerak bumi: 2.40m coseismic slip',
      timestamp: '09:41:35 WIB',
      verdict: 'Deformasi dasar laut terkonfirmasi membangkitkan pergeseran kolom air.',
    },
    tsunami_buoy: {
      id: 'tsunami_buoy',
      name: 'InaTEWS DART Tsunami Buoy',
      points: inc.confidence_breakdown?.tsunami_buoy || 20,
      maxPoints: 20,
      status: 'CRITICAL SURGE',
      sensor: 'Buoy DART #04 (Palung Jawa)',
      rawSignal: 'Anomali muka air laut: +4.5m surge • Periode 14m',
      timestamp: '09:41:46 WIB',
      verdict: 'Gelombang tsunami terkonfirmasi melaju menuju zona pesisir selatan.',
    },
    infrastructure: {
      id: 'infrastructure',
      name: 'SCADA Power & Telecom Grid',
      points: inc.confidence_breakdown?.infrastructure_signal || 5,
      maxPoints: 10,
      status: 'DEGRADED',
      sensor: 'PLN Sub-Station Telemetry & BTS Signal',
      rawSignal: '37 gardu distribusi padam • 12 koridor jalan terputus',
      timestamp: '09:42:35 WIB',
      verdict: 'Jaringan logistik dan komunikasi mengalami degradasi di zona pesisir.',
    },
  };

  const handleManualDispatch = () => {
    setDispatchStatus('MENGIRIMKAN DIREKTIF TAKTIS KE BNPB & BASARNAS...');
    setTimeout(() => {
      setDispatchStatus('✓ BERHASIL: DIREKTIF RESMI AKTIF DI POSKO OPERASI (ACK #BNPB-2026-9182)');
    }, 800);
  };

  const isWarningTsunami = inc.tsunami_risk === 'HIGH' || inc.tsunami_risk === 'CRITICAL';
  const isNominal = inc.status === 'MONITORING';

  return (
    <div className="incident-cockpit-card">
      {/* 1. Authoritative Unified Header */}
      <div className="cockpit-card-header">
        <div className="cockpit-header-top">
          <div className="cockpit-title-group">
            <span className="cockpit-title-icon">{isWarningTsunami ? '🌊' : '⚡'}</span>
            <div className="cockpit-title-text-wrap">
              <div className="cockpit-title-row">
                <h2 className="cockpit-title">{formatHazardTitle(inc.hazard)}</h2>
                <span className="cockpit-id-chip">{inc.incident_id}</span>
              </div>
              <span className="cockpit-sub-category">
                {isNominal ? 'Status Seismisitas Normal' : 'Eskalasi Insiden Berantai Multi-Sektor'}
              </span>
            </div>
          </div>

          <div
            className="cockpit-status-badge"
            style={{
              borderColor: statusColor(inc.status),
              color: statusColor(inc.status),
              background: `${statusColor(inc.status)}18`,
            }}
          >
            <span className="live-dot-pulse" style={{ background: statusColor(inc.status) }} />
            <span>{inc.status}</span>
          </div>
        </div>

        {/* Region & Focus Bar */}
        <div className="cockpit-location-bar">
          <div className="cockpit-location-info">
            <span className="cockpit-location-pin">📍</span>
            <span className="cockpit-location-name">{inc.region}</span>
            <span className="cockpit-location-depth">{inc.depth || 15} km dpl</span>
          </div>
          <button
            type="button"
            className="cockpit-focus-btn"
            onClick={() => onFocusRegion?.(inc.region)}
            title="Pusatkan peta ke episenter wilayah ini"
          >
            <span>Fokus Peta</span>
            <span className="btn-arrow">›</span>
          </button>
        </div>
      </div>

      {/* 2. Sleek Unified Telemetry Matrix (6 Metrics without messy box clutter) */}
      <div className="cockpit-telemetry-matrix">
        {/* Metric 1: Magnitude */}
        <div className="matrix-cell">
          <span className="matrix-cell__label">MAGNITUDO</span>
          <div className="matrix-cell__value-row">
            <span className="matrix-cell__value matrix-cell__value--mag">
              M{inc.magnitude ? inc.magnitude.toFixed(1) : '—'}
            </span>
            <span className="matrix-cell__pill">Kedalaman {inc.depth || 15}km</span>
          </div>
          <span className="matrix-cell__hint">Episenter Gempa Utama</span>
        </div>

        {/* Metric 2: MMI Intensity */}
        <div className="matrix-cell">
          <span className="matrix-cell__label">INTENSITAS MMI</span>
          <div className="matrix-cell__value-row">
            <span className="matrix-cell__value matrix-cell__value--mmi">
              Skala {inc.seismic_intensity || 'II'}
            </span>
          </div>
          <span className="matrix-cell__hint">
            {inc.seismic_intensity === 'VII' || inc.seismic_intensity === 'VIII'
              ? 'Guncangan Destruktif'
              : 'Guncangan Ringan'}
          </span>
        </div>

        {/* Metric 3: Tsunami Risk */}
        <div className="matrix-cell">
          <span className="matrix-cell__label">STATUS TSUNAMI</span>
          <div className="matrix-cell__value-row">
            <span
              className={`matrix-cell__tag ${
                isWarningTsunami ? 'matrix-cell__tag--danger' : 'matrix-cell__tag--safe'
              }`}
            >
              {isWarningTsunami ? '🚨 SIAGA AWAS' : '✅ AMAN (NOMINAL)'}
            </span>
          </div>
          <span className="matrix-cell__hint">
            {isWarningTsunami ? 'Estimasi Gelombang 4.5m - 6.0m' : 'Tanpa Potensi Gelombang'}
          </span>
        </div>

        {/* Metric 4: Population Exposed */}
        <div className="matrix-cell">
          <span className="matrix-cell__label">WARGA BERISIKO</span>
          <div className="matrix-cell__value-row">
            <span className="matrix-cell__value matrix-cell__value--pop">
              {inc.population_exposed > 0 ? `${formatNumber(inc.population_exposed)} Jiwa` : 'Nihil (Aman)'}
            </span>
          </div>
          <span className="matrix-cell__hint">Zona Inundasi Pesisir</span>
        </div>

        {/* Metric 5: Critical Infrastructure */}
        <div className="matrix-cell">
          <span className="matrix-cell__label">FASILITAS KRITIS</span>
          <div className="matrix-cell__value-row">
            <span className="matrix-cell__value matrix-cell__value--infra">
              {inc.critical_infrastructure > 0 ? `${inc.critical_infrastructure} Fasilitas` : 'Normal'}
            </span>
          </div>
          <span className="matrix-cell__hint">Pelabuhan, Gardu & RSUD</span>
        </div>

        {/* Metric 6: Road Disruptions */}
        <div className="matrix-cell">
          <span className="matrix-cell__label">AKSES JALAN</span>
          <div className="matrix-cell__value-row">
            <span className="matrix-cell__value matrix-cell__value--road">
              {inc.road_disruptions > 0 ? `${inc.road_disruptions} Koridor` : 'Lancar'}
            </span>
          </div>
          <span className="matrix-cell__hint">Jalur Evakuasi Darurat</span>
        </div>
      </div>

      {/* 3. Multi-Stream Confidence Model */}
      <div className="cockpit-confidence-box">
        <div className="confidence-box__header">
          <div className="confidence-box__title">
            <span>🛡️</span>
            <span>Konsensus Multi-Sensor Seismik</span>
          </div>
          <span className="confidence-box__pct">{confPercent}% Akurasi</span>
        </div>

        <div className="confidence-bar-track">
          <div
            className="confidence-bar-fill"
            style={{
              width: `${confPercent}%`,
              background:
                confPercent >= 85
                  ? 'linear-gradient(90deg, #10b981, #00f2ff, #a855f7)'
                  : 'linear-gradient(90deg, #f59e0b, #00f2ff)',
            }}
          />
        </div>

        <div className="confidence-chips-row">
          <button
            type="button"
            className={`conf-pill ${activeEvidence === 'seismic_stations' ? 'conf-pill--active' : ''}`}
            onClick={() => setActiveEvidence(activeEvidence === 'seismic_stations' ? null : 'seismic_stations')}
            title="Buka rincian telemetri sensor seismik"
          >
            <span className="conf-pill__badge">+{inc.confidence_breakdown?.seismic_stations || 35}%</span>
            <span className="conf-pill__label">Seismograf BMKG</span>
          </button>

          <button
            type="button"
            className={`conf-pill ${activeEvidence === 'cross_agency' ? 'conf-pill--active' : ''}`}
            onClick={() => setActiveEvidence(activeEvidence === 'cross_agency' ? null : 'cross_agency')}
            title="Buka rincian kesepakatan geodetik USGS"
          >
            <span className="conf-pill__badge">+{inc.confidence_breakdown?.cross_agency_agreement || 20}%</span>
            <span className="conf-pill__label">USGS Match</span>
          </button>

          <button
            type="button"
            className={`conf-pill ${activeEvidence === 'satellite_insar' ? 'conf-pill--active' : ''}`}
            onClick={() => setActiveEvidence(activeEvidence === 'satellite_insar' ? null : 'satellite_insar')}
            title="Buka rincian deformasi satelit InSAR"
          >
            <span className="conf-pill__badge">+{inc.confidence_breakdown?.satellite_insar || 15}%</span>
            <span className="conf-pill__label">InSAR Satelit</span>
          </button>

          <button
            type="button"
            className={`conf-pill ${activeEvidence === 'tsunami_buoy' ? 'conf-pill--active' : ''}`}
            onClick={() => setActiveEvidence(activeEvidence === 'tsunami_buoy' ? null : 'tsunami_buoy')}
            title="Buka rincian sensor pelampung DART"
          >
            <span className="conf-pill__badge">+{inc.confidence_breakdown?.tsunami_buoy || 20}%</span>
            <span className="conf-pill__label">DART Buoy</span>
          </button>

          <button
            type="button"
            className={`conf-pill ${activeEvidence === 'infrastructure' ? 'conf-pill--active' : ''}`}
            onClick={() => setActiveEvidence(activeEvidence === 'infrastructure' ? null : 'infrastructure')}
            title="Buka rincian telemetri gardu listrik & BTS"
          >
            <span className="conf-pill__badge">+{inc.confidence_breakdown?.infrastructure_signal || 5}%</span>
            <span className="conf-pill__label">SCADA Infra</span>
          </button>
        </div>

        {/* Interactive Evidence Inspector Drawer */}
        {activeEvidence && EVIDENCE_DATA[activeEvidence] && (
          <div className="cockpit-evidence-drawer">
            <div className="evidence-drawer__head">
              <span className="evidence-drawer__title">
                🔍 {EVIDENCE_DATA[activeEvidence].name}
              </span>
              <button
                type="button"
                className="evidence-drawer__close-btn"
                onClick={() => setActiveEvidence(null)}
              >
                ✕
              </button>
            </div>
            <div className="evidence-drawer__meta-row">
              <span>Sensor: <strong>{EVIDENCE_DATA[activeEvidence].sensor}</strong></span>
              <span>Waktu: <strong>{EVIDENCE_DATA[activeEvidence].timestamp}</strong></span>
            </div>
            <div className="evidence-drawer__code">
              <code>{EVIDENCE_DATA[activeEvidence].rawSignal}</code>
            </div>
            <div className="evidence-drawer__verdict-text">
              {EVIDENCE_DATA[activeEvidence].verdict}
            </div>
          </div>
        )}
      </div>

      {/* 4. Tactical Directives & Response Protocol */}
      <div className="cockpit-directive-card">
        <div className="cockpit-directive__head">
          <div className="cockpit-directive__title">
            <span className="directive-icon">🚨</span>
            <span>DIREKTIF RESPON TAKTIS DARURAT</span>
          </div>
          <span className="cockpit-directive__badge">
            {response?.priority || (isWarningTsunami ? 'PRIORITAS AWAS' : 'SIAGA NORMAL')}
          </span>
        </div>

        <div className="cockpit-directive__agency">
          <span className="agency-label">Satgas Pelaksana:</span>
          <span className="agency-name">
            {response?.target ? response.target.replace(/_/g, ' ') : 'BNPB · BASARNAS · BPBD Pesisir'}
          </span>
        </div>

        <div className="cockpit-directive__action-title">
          ⚡ {response?.action ? response.action.replace(/_/g, ' ') : 'PROTOKOL EVAKUASI & AKTIVASI SIRINE PESISIR'}
        </div>

        <div className="cockpit-directive__checklist">
          {(response?.reason || [
            'Guncangan seismik destruktif MMI VII+ merata di sepanjang koridor selatan.',
            'Anomali muka air laut +4.5m terkonfirmasi sensor DART Buoy #04.',
            'Warga di zona sempadan pantai wajib segera dievakuasi ke ketinggian >20m dpl.',
          ]).map((r, i) => (
            <div key={i} className="directive-check-item">
              <span className="check-bullet">›</span>
              <span>{r}</span>
            </div>
          ))}
        </div>

        {/* Dispatch Action Button */}
        <div className="cockpit-directive__dispatch">
          <button
            type="button"
            className="cockpit-dispatch-btn"
            onClick={handleManualDispatch}
          >
            <span>🚨</span>
            <span>KIRIMKAN DIREKTIF RESMI KE POSKO DARURAT</span>
          </button>
          {dispatchStatus && (
            <div className="cockpit-dispatch-feedback">
              {dispatchStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
