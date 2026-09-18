'use client';

interface SidebarNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  alertCount: number;
  activityPercentage: number;
  connected: boolean;
}

export default function SidebarNav({
  activeTab,
  onSelectTab,
  alertCount,
  activityPercentage,
  connected,
}: SidebarNavProps) {
  const navItems = [
    {
      id: 'overview',
      label: 'Operasional & Overview',
      icon: '📊',
      badge: 'LIVE',
      badgeType: 'live',
      desc: 'Peta tektonik, BMKG, seismograf',
    },
    {
      id: 'flink',
      label: 'Apache Flink Engine',
      icon: '⚡',
      badge: 'SQL STREAM',
      badgeType: 'flink',
      desc: 'DAG pipeline, Flink SQL, alert korelasi',
    },
    {
      id: 'ai',
      label: 'Gemini AI Intelligence',
      icon: '🤖',
      badge: 'GEMINI 2.5',
      badgeType: 'ai',
      desc: 'Analisis risiko & Copilot taktis',
    },
    {
      id: 'ocean',
      label: 'Laut & Tsunami IOC',
      icon: '🌊',
      badge: '34 GAUGE',
      badgeType: 'neutral',
      desc: 'IOC UNESCO tide gauges & buoys',
    },
    {
      id: 'volcano',
      label: 'Erupsi Gunung Api',
      icon: '🌋',
      badge: 'MAGMA PVMBG',
      badgeType: 'live',
      desc: 'Letusan, seismogram & status ESDM',
    },
    {
      id: 'governance',
      label: 'Confluent Governance',
      icon: '🛡️',
      badge: 'DISABLED',
      badgeType: 'neutral',
      desc: 'Schema Registry, klasifikasi data',
    },
  ];

  return (
    <aside className="dash-sidebar">
      <div className="dash-sidebar__nav-section">
        <div className="dash-sidebar__section-title">NAVIGASI DASHBOARD</div>
        <nav className="dash-sidebar__nav">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`dash-sidebar__item ${isActive ? 'dash-sidebar__item--active' : ''}`}
                onClick={() => onSelectTab(item.id)}
              >
                <span className="dash-sidebar__item-icon">{item.icon}</span>
                <div className="dash-sidebar__item-text">
                  <div className="dash-sidebar__item-label-row">
                    <span className="dash-sidebar__item-label">{item.label}</span>
                    {item.badge && (
                      <span className={`dash-sidebar__item-badge dash-sidebar__item-badge--${item.badgeType}`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="dash-sidebar__item-desc">{item.desc}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Real-Time Platform Infrastructure Status Footprint */}
      <div className="dash-sidebar__footer">
        <div className="dash-sidebar__status-box">
          <div className="dash-sidebar__status-row">
            <span className="dash-sidebar__status-dot" style={{ background: '#475569', boxShadow: '0 0 6px rgba(71, 85, 105, 0.5)' }}></span>
            <span className="dash-sidebar__status-title" style={{ color: '#64748b' }}>Confluent Cloud — Disabled</span>
          </div>
          <div className="dash-sidebar__status-meta">
            <span style={{ color: '#475569' }}>Cluster: pkc-921jm (aws/us-east-2) — OFFLINE</span>
            <span style={{ color: '#475569' }}>Schema Registry: Tidak Aktif</span>
            <span style={{ color: '#475569' }}>Flink Compute Pool: Disabled</span>
          </div>
        </div>

        <div className="dash-sidebar__mmi-meter">
          <div className="dash-sidebar__mmi-header">
            <span>FLINK INTENSITY INDEX</span>
            <span className="dash-sidebar__mmi-val">{activityPercentage.toFixed(1)}%</span>
          </div>
          <div className="dash-sidebar__mmi-bar">
            <div
              className="dash-sidebar__mmi-fill"
              style={{
                width: `${Math.min(100, activityPercentage)}%`,
                background:
                  activityPercentage >= 70
                    ? 'linear-gradient(90deg, #ff9800, #f43f5e)'
                    : activityPercentage >= 40
                    ? 'linear-gradient(90deg, #00f2ff, #ff9800)'
                    : 'linear-gradient(90deg, #10b981, #00f2ff)',
              }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
