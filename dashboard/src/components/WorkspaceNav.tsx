'use client';

export type WorkspaceTab = 'cockpit' | 'overview' | 'ai' | 'ocean' | 'stream' | 'volcano' | 'all' | 'connectors';

interface WorkspaceNavProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  aiModel?: string;
  isDrill?: boolean;
}

export default function WorkspaceNav({
  activeTab,
  onTabChange,
  aiModel = 'Bedrock Claude 3.5',
  isDrill = false,
}: WorkspaceNavProps) {
  const tabs: { id: WorkspaceTab; label: string; icon: string; badge?: string; badgeColor?: string }[] = [
    {
      id: 'cockpit',
      label: 'INCIDENT COCKPIT',
      icon: '🌋',
      badge: 'REAL-TIME CASCADE',
      badgeColor: '#ff2a5f',
    },
    {
      id: 'overview',
      label: 'PETA & SITUASI',
      icon: '🧭',
      badge: 'LIVE TELEMETRI',
      badgeColor: '#00f2ff',
    },
    {
      id: 'ai',
      label: 'AI SENTINEL & STREAMING AGENT',
      icon: '🤖',
      badge: aiModel.includes('Claude') ? 'BEDROCK CLAUDE' : 'GEMINI 2.5',
      badgeColor: aiModel.includes('Claude') ? '#ff9100' : '#00f2ff',
    },
    {
      id: 'ocean',
      label: 'TSUNAMI & LAUT IOC',
      icon: '🌊',
      badge: '34 STASIUN',
      badgeColor: '#38bdf8',
    },
    {
      id: 'stream',
      label: 'FLINK CEP & GOVERNANCE',
      icon: '⚡',
      badge: '3 JOBS RUNNING',
      badgeColor: '#a855f7',
    },
    {
      id: 'volcano',
      label: 'PVMBG SEISMOGRAM HUB',
      icon: '🌋',
      badge: 'LIVE',
      badgeColor: '#f59e0b',
    },
    {
      id: 'connectors',
      label: 'CONFLUENT CONNECTORS',
      icon: '🔌',
      badge: 'DISABLED',
      badgeColor: '#64748b',
    },
    {
      id: 'all',
      label: 'SEMUA PANEL',
      icon: '📑',
      badge: 'IKHTISAR',
      badgeColor: '#94a3b8',
    },
  ];

  return (
    <nav className="workspace-nav" aria-label="Navigasi Workspace">
      <div className="workspace-nav__container">
        <div className="workspace-nav__scroll">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`workspace-nav__item ${isActive ? 'workspace-nav__item--active' : ''}`}
              >
                <span className="workspace-nav__icon">{tab.icon}</span>
                <span className="workspace-nav__label">{tab.label}</span>
                {tab.badge && (
                  <span
                    className="workspace-nav__badge"
                    style={{
                      borderColor: isActive ? tab.badgeColor : 'rgba(255, 255, 255, 0.12)',
                      color: isActive ? tab.badgeColor : '#94a3b8',
                      background: isActive ? `${tab.badgeColor}18` : 'rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isDrill && (
          <div className="workspace-nav__drill-indicator">
            <span className="live-dot-pulse" />
            <span>⚠️ MODE SIMULASI</span>
          </div>
        )}
      </div>
    </nav>
  );
}
