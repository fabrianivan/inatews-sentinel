'use client';

import { useState } from 'react';
import type { TsunamiScenario } from '@/lib/types';

interface TsunamiPanelProps {
  scenario: TsunamiScenario;
  isReal?: boolean;
}

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
  } catch {
    return '--:--:--';
  }
}

export default function TsunamiPanel({ scenario, isReal = false }: TsunamiPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'ZONES' | 'INFRA' | 'ACTIONS'>('ZONES');

  if (!scenario.active) return null;

  const zones = scenario.affected_zone_details || [];
  const infra = scenario.infrastructure_impacts || [];

  return (
    <div className="card tsunami-panel" style={{ border: `1px solid ${isReal ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.4)'}`, background: 'linear-gradient(180deg, rgba(30, 10, 18, 0.85) 0%, rgba(10, 14, 26, 0.95) 100%)' }}>
      <div className="card__body" style={{ padding: '16px 20px' }}>
        {/* Header Ribbon */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🌊</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#f87171', margin: 0, letterSpacing: '0.03em' }}>
                  {isReal
                    ? '🚨 PERINGATAN TSUNAMI AKTIF (DATA RESMI BMKG INATEWS)'
                    : 'SKENARIO SIMULASI: DAMPAK TSUNAMI & KERUSAKAN INFRASTRUKTUR'}
                </h3>
                <span style={{ background: '#ef4444', color: '#fff', fontSize: '9.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', animation: isReal ? 'pulse 1.5s infinite' : 'none' }}>
                  STATUS {scenario.severity}
                </span>
                {isReal && (
                  <span style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', color: '#7dd3fc', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                    DATA RIIL TELEMETRI
                  </span>
                )}
              </div>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0' }}>
                {isReal ? 'Episenter / Sumber: ' : 'Deteksi DART Buoy: '}
                <strong style={{ color: '#00f2ff' }}>{scenario.sensor_id}</strong> • Lonjakan Muka Air Laut: <strong style={{ color: '#ff2a5f' }}>+{scenario.wave_anomaly?.toFixed(2)} Meter</strong>
              </p>
            </div>
          </div>

          {/* Sub Tab Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '3px', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setActiveSubTab('ZONES')}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeSubTab === 'ZONES' ? 'rgba(239, 68, 68, 0.3)' : 'transparent',
                border: activeSubTab === 'ZONES' ? '1px solid #ef4444' : '1px solid transparent',
                color: activeSubTab === 'ZONES' ? '#fca5a5' : '#94a3b8',
                transition: 'all 0.15s ease',
              }}
            >
              📍 Daerah Terimpact ({zones.length || scenario.affected_zones.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('INFRA')}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeSubTab === 'INFRA' ? 'rgba(249, 115, 22, 0.3)' : 'transparent',
                border: activeSubTab === 'INFRA' ? '1px solid #f97316' : '1px solid transparent',
                color: activeSubTab === 'INFRA' ? '#fdba74' : '#94a3b8',
                transition: 'all 0.15s ease',
              }}
            >
              🏗️ Perkiraan Kerusakan Infrastruktur ({infra.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('ACTIONS')}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeSubTab === 'ACTIONS' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                border: activeSubTab === 'ACTIONS' ? '1px solid #3b82f6' : '1px solid transparent',
                color: activeSubTab === 'ACTIONS' ? '#93c5fd' : '#94a3b8',
                transition: 'all 0.15s ease',
              }}
            >
              📋 Protokol Evakuasi
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUBTAB 1: DAERAH TERIMPACT TSUNAMI (ESTIMATED ARRIVAL & INUNDATION) */}
        {/* ========================================================================= */}
        {activeSubTab === 'ZONES' && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#cbd5e1' }}>
              <span>
                {isReal
                  ? 'Zonasi dampak pesisir terdekat berdasar pemodelan propagasi gelombang riil InaTEWS:'
                  : 'Simulasi propagasi gelombang tsunami per pesisir terdekat berdasar model numerik InaTEWS:'}
              </span>
              <span style={{ color: '#f87171', fontWeight: 700 }}>
                ⚠️ Radius Bahaya Pesisir & Estimasi Lonjakan Gelombang
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '10px' }}>
              {zones.map((z, idx) => {
                const isAwas = z.status === 'AWAS';
                const isSiaga = z.status === 'SIAGA';
                return (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(6, 10, 20, 0.75)',
                      border: `1px solid ${isAwas ? 'rgba(239, 68, 68, 0.45)' : isSiaga ? 'rgba(249, 115, 22, 0.45)' : 'rgba(234, 179, 8, 0.3)'}`,
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#fff', display: 'block' }}>{z.zone}</strong>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>Provinsi: {z.province}</span>
                      </div>
                      <span
                        style={{
                          background: isAwas ? '#ef4444' : isSiaga ? '#f97316' : '#eab308',
                          color: '#fff',
                          fontSize: '9px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {z.status}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px', fontSize: '10.5px' }}>
                      <div>
                        <span style={{ color: '#94a3b8', display: 'block', fontSize: '9px' }}>ESTIMASI TIBA (ETA)</span>
                        <strong style={{ color: '#f87171' }}>⏱ {z.estimated_eta}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8', display: 'block', fontSize: '9px' }}>TINGGI GELOMBANG</span>
                        <strong style={{ color: '#00f2ff' }}>🌊 {z.estimated_wave_height}</strong>
                      </div>
                    </div>

                    <div style={{ fontSize: '10.5px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div>🌊 <strong>Limpasan Darat:</strong> {z.inundation_depth}</div>
                      <div>👥 <strong>Populasi Berisiko:</strong> {z.population_at_risk}</div>
                      <div>🏔️ <strong>Ketinggian Aman:</strong> <strong style={{ color: '#34d399' }}>{z.safe_elevation}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBTAB 2: PERKIRAAN KERUSAKAN INFRASTRUKTUR KRITIS */}
        {/* ========================================================================= */}
        {activeSubTab === 'INFRA' && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#cbd5e1' }}>
              <span>
                Asesmen kerentanan fasilitas vital (energi, pelabuhan, jalan akses, dan telekomunikasi) terhadap rendaman gelombang:
              </span>
              <span style={{ color: '#f97316', fontWeight: 700 }}>
                ⚡ Skenario Gangguan Infrastruktur Kritis
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
              {infra.map((inf, idx) => {
                const isHeavy = inf.damage_level === 'HEAVY';
                return (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(6, 10, 20, 0.75)',
                      border: `1px solid ${isHeavy ? 'rgba(239, 68, 68, 0.5)' : 'rgba(249, 115, 22, 0.45)'}`,
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '12.5px', color: '#fff', display: 'block' }}>{inf.facility}</strong>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>Tipe: {inf.type} • 📍 {inf.location}</span>
                      </div>
                      <span
                        style={{
                          background: isHeavy ? 'rgba(239, 68, 68, 0.25)' : 'rgba(249, 115, 22, 0.25)',
                          border: `1px solid ${isHeavy ? '#ef4444' : '#f97316'}`,
                          color: isHeavy ? '#fca5a5' : '#fdba74',
                          fontSize: '9px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isHeavy ? 'RUSAK BERAT' : 'RUSAK SEDANG'}
                      </span>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px', fontSize: '11px', color: '#cbd5e1' }}>
                      <strong style={{ color: '#fb923c' }}>Estimasi Dampak:</strong> {inf.loss_estimate}
                    </div>

                    <div style={{ fontSize: '10.5px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ color: '#f87171' }}>
                        🛑 <strong>Status Operasional:</strong> {inf.operational_status}
                      </span>
                      <span style={{ color: '#38bdf8' }}>
                        🛠️ <strong>Tindakan Mitigasi:</strong> {inf.critical_action}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBTAB 3: PROTOKOL EVAKUASI & TINDAKAN KESIAPSIAGAAN */}
        {/* ========================================================================= */}
        {activeSubTab === 'ACTIONS' && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
              Rekomendasi langkah evakuasi multi-lembaga (BMKG, BNPB, Basarnas, Pemerintah Daerah):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {scenario.response_actions?.map((action, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(6, 10, 20, 0.65)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '11.5px',
                    color: '#e2e8f0',
                  }}
                >
                  <span style={{ fontSize: '16px', color: '#38bdf8' }}>✓</span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Disclaimer */}
        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', flexWrap: 'wrap', gap: '6px' }}>
          <span>
            {isReal ? (
              <>
                🚨 <strong>PERINGATAN RESMI BMKG INATEWS:</strong> Berdasarkan telemetri gempa nyata & pemodelan gelombang laut. Ikuti instruksi evakuasi darurat BPBD dan SAR setempat.
              </>
            ) : (
              <>
                ⚠️ <strong>CATATAN:</strong> Ini adalah skenario simulasi kesiapsiagaan darurat nasional (DRILL). Bukan peringatan tsunami kejadian nyata.
              </>
            )}
          </span>
          <span>{isReal ? 'Waktu Telemetri: ' : 'Waktu Simulasi: '}{formatTime(scenario.timestamp || scenario.detection_time)}</span>
        </div>
      </div>
    </div>
  );
}
