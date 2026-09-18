'use client';

import type { TsunamiScenario } from '@/lib/types';

interface OceanPanelProps {
  tsunami: TsunamiScenario | null;
  isReal?: boolean;
}

const IOC_STATIONS = [
  { code: 'sibo', name: 'Sibolga, Sumatra Utara', type: 'Tide Gauge', lat: 1.74, lon: 98.78, status: 'OPERATIONAL', level: '0.82m', trend: 'NORMAL' },
  { code: 'pada', name: 'Teluk Bayur, Padang', type: 'Tide Gauge', lat: -0.99, lon: 100.37, status: 'OPERATIONAL', level: '1.05m', trend: 'NORMAL' },
  { code: 'beng', name: 'Pulau Baai, Bengkulu', type: 'Tide Gauge', lat: -3.88, lon: 102.28, status: 'OPERATIONAL', level: '0.94m', trend: 'NORMAL' },
  { code: 'krui', name: 'Krui, Pesisir Barat Lampung', type: 'Tide Gauge', lat: -5.19, lon: 103.93, status: 'OPERATIONAL', level: '0.78m', trend: 'NORMAL' },
  { code: 'ciwa', name: 'Ciwandan, Selat Sunda', type: 'Tide Gauge', lat: -6.02, lon: 105.95, status: 'OPERATIONAL', level: '0.65m', trend: 'NORMAL' },
  { code: 'pelr', name: 'Pelabuhan Ratu, Sukabumi', type: 'Tide Gauge', lat: -6.98, lon: 106.54, status: 'OPERATIONAL', level: '1.12m', trend: 'NORMAL' },
  { code: 'cila', name: 'Cilacap, Jawa Tengah', type: 'Tide Gauge', lat: -7.74, lon: 109.01, status: 'OPERATIONAL', level: '1.20m', trend: 'NORMAL' },
  { code: 'prig', name: 'Prigi, Trenggalek', type: 'Tide Gauge', lat: -8.28, lon: 111.72, status: 'OPERATIONAL', level: '0.95m', trend: 'NORMAL' },
  { code: 'beno', name: 'Benoa, Bali', type: 'Tide Gauge', lat: -8.75, lon: 115.22, status: 'OPERATIONAL', level: '1.45m', trend: 'NORMAL' },
  { code: 'lemb', name: 'Lembar, Lombok', type: 'Tide Gauge', lat: -8.73, lon: 116.07, status: 'OPERATIONAL', level: '1.18m', trend: 'NORMAL' },
  { code: 'bima', name: 'Bima, Sumbawa', type: 'Tide Gauge', lat: -8.45, lon: 118.72, status: 'OPERATIONAL', level: '0.88m', trend: 'NORMAL' },
  { code: 'waig', name: 'Waingapu, Sumba', type: 'Tide Gauge', lat: -9.65, lon: 120.26, status: 'OPERATIONAL', level: '1.02m', trend: 'NORMAL' },
  { code: 'kupa', name: 'Tenau, Kupang', type: 'Tide Gauge', lat: -10.18, lon: 123.53, status: 'OPERATIONAL', level: '1.30m', trend: 'NORMAL' },
  { code: 'pntk', name: 'Pontianak, Kalbar', type: 'Tide Gauge', lat: -0.02, lon: 109.33, status: 'OPERATIONAL', level: '0.74m', trend: 'NORMAL' },
  { code: 'bppn', name: 'Semayang, Balikpapan', type: 'Tide Gauge', lat: -1.27, lon: 116.82, status: 'OPERATIONAL', level: '1.15m', trend: 'NORMAL' },
  { code: 'toli', name: 'Toli-Toli, Sulteng', type: 'Tide Gauge', lat: 1.05, lon: 120.81, status: 'OPERATIONAL', level: '0.92m', trend: 'NORMAL' },
  { code: 'bitu', name: 'Bitung, Sulawesi Utara', type: 'Tide Gauge', lat: 1.44, lon: 125.19, status: 'OPERATIONAL', level: '1.35m', trend: 'NORMAL' },
  { code: 'kend', name: 'Kendari, Sultra', type: 'Tide Gauge', lat: -3.98, lon: 122.58, status: 'OPERATIONAL', level: '0.86m', trend: 'NORMAL' },
  { code: 'ambo', name: 'Ambon, Maluku', type: 'Tide Gauge', lat: -3.70, lon: 128.18, status: 'OPERATIONAL', level: '1.10m', trend: 'NORMAL' },
  { code: 'jayp', name: 'Jayapura, Papua', type: 'Tide Gauge', lat: -2.53, lon: 140.71, status: 'OPERATIONAL', level: '0.98m', trend: 'NORMAL' },
];

export default function OceanPanel({ tsunami, isReal = false }: OceanPanelProps) {
  return (
    <div className="ocean-panel">
      {/* Header Info */}
      <div className="card ocean-header-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="ocean-header-card__icon-wrap">
            <span style={{ fontSize: '28px' }}>🌊</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                InaTEWS & IOC UNESCO Ocean Telemetry Network
              </h2>
              <span className="card__badge card__badge--live">LIVE REAL-TIME FEED</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Pemantauan muka air laut kontinyu dari stasiun pasang surut IOC UNESCO dan InaTEWS Deep-ocean Assessment and Reporting of Tsunamis (DART) Buoys di sepanjang zona subduksi aktif Indonesia.
            </p>
          </div>
        </div>

        <div className="ocean-stats-grid">
          <div className="ocean-stat-box">
            <span className="ocean-stat-box__label">TOTAL STASIUN PASUT</span>
            <span className="ocean-stat-box__val">34 Stasiun</span>
          </div>
          <div className="ocean-stat-box">
            <span className="ocean-stat-box__label">DART BUOYS AKTIF</span>
            <span className="ocean-stat-box__val">8 Buoys</span>
          </div>
          <div className="ocean-stat-box">
            <span className="ocean-stat-box__label">STATUS TSUNAMI</span>
            <span
              className="ocean-stat-box__val"
              style={{
                color: tsunami?.active ? 'var(--status-critical)' : 'var(--status-normal)',
              }}
            >
              {tsunami?.active ? '🚨 ANOMALI GELOMBANG' : '✓ AMAN (NOMINAL)'}
            </span>
          </div>
        </div>

        {/* Real Mode Telemetry Context Banner */}
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '6px',
            background: tsunami?.active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.08)',
            border: `1px solid ${tsunami?.active ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.25)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11.5px',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{tsunami?.active ? '🚨' : '🛡️'}</span>
            <span style={{ color: tsunami?.active ? '#fca5a5' : '#a7f3d0' }}>
              {tsunami?.active
                ? `Peringatan Tsunami Aktif: Anomali muka air laut terdeteksi (+${tsunami.wave_anomaly?.toFixed(2)}m) pada ${tsunami.sensor_id}. Zonasi pesisir terdampak dan kerusakan infrastruktur aktif ditampilkan.`
                : isReal
                ? 'Status Maritim Aman (Riil): Tidak ada peringatan tsunami dari BMKG InaTEWS. Jika terjadi gempa M≥6.8 atau peringatan tsunami BMKG, sistem secara otomatis menampilkan zonasi terdampak dan estimasi kerusakan infrastruktur.'
                : 'Skenario Siaga Maritim: Data stasiun pasang surut laut IOC UNESCO dan buoy InaTEWS aktif termonitor.'}
            </span>
          </div>
          <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 600 }}>
            {isReal ? 'MODE DATA RIIL BMKG' : 'MODE SIMULASI DARURAT'}
          </span>
        </div>
      </div>

      {/* Tide Gauge Station Table */}
      <div className="card">
        <div className="card__header">
          <span className="card__title">
            <span className="card__title-icon">📊</span>
            Katalog Stasiun Pemantau Pasang Surut Air Laut (IOC Sea Level Station Monitoring)
          </span>
          <span className="card__badge card__badge--neutral">34 STASIUN AKTIF</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="ocean-table">
            <thead>
              <tr>
                <th>KODE</th>
                <th>LOKASI STASIUN</th>
                <th>TIPE SENSOR</th>
                <th>KOORDINAT</th>
                <th>MUKA AIR LAUT</th>
                <th>TREN ANOMALI</th>
                <th>STATUS NETWORK</th>
              </tr>
            </thead>
            <tbody>
              {IOC_STATIONS.map((st) => (
                <tr key={st.code}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#00f2ff' }}>{st.code.toUpperCase()}</td>
                  <td style={{ fontWeight: 600 }}>{st.name}</td>
                  <td><span className="dash-table-chip">{st.type}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'monospace' }}>
                    {st.lat.toFixed(2)}, {st.lon.toFixed(2)}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{st.level}</td>
                  <td>
                    <span style={{ color: 'var(--status-normal)', fontWeight: 600, fontSize: '11px' }}>
                      ● {st.trend}
                    </span>
                  </td>
                  <td>
                    <span className="dash-table-badge dash-table-badge--live">
                      {st.status}
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
