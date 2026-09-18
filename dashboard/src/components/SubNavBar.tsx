'use client';

import { useState, useEffect } from 'react';

interface SubNavBarProps {
  activeMode: 'REAL' | 'SIMULASI';
  onModeChange: (mode: 'REAL' | 'SIMULASI') => void;
  onScrollTo: (sectionId: string) => void;
}

export default function SubNavBar({
  activeMode,
  onModeChange,
  onScrollTo,
}: SubNavBarProps) {
  const [activeSection, setActiveSection] = useState<string>('section-operasional');

  useEffect(() => {
    const handleScroll = () => {
      const sections = activeMode === 'REAL' 
        ? ['section-operasional', 'section-volcano-hub', 'section-ai', 'section-ocean', 'section-events']
        : ['section-simulation-drill', 'section-flink', 'section-governance'];

      const scrollPos = window.scrollY + 140;

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(sections[i]);
          return;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeMode]);

  const handleTabClick = (sectionId: string) => {
    setActiveSection(sectionId);
    onScrollTo(sectionId);
  };

  return (
    <nav className="dash-subbar" aria-label="Sub Navigation Workspace">
      <div className="dash-subbar__container">
        {/* Klaster & Master Mode Switcher */}
        <div className="dash-subbar__modes">
          <span className="dash-subbar__group-label">KLASTER TELEMETRI:</span>
          
          <button
            type="button"
            className={`dash-subbar__mode-btn ${
              activeMode === 'REAL' ? 'dash-subbar__mode-btn--active-real' : ''
            }`}
            onClick={() => onModeChange('REAL')}
            title="Tampilkan data operasional live resmi BMKG, MAGMA PVMBG, dan IOC UNESCO"
          >
            <span className="live-dot-pulse"></span>
            <span className="dash-subbar__mode-title">DATA RIIL LIVE</span>
            <span className="dash-subbar__mode-tag">BMKG & PVMBG</span>
          </button>

          <button
            type="button"
            className={`dash-subbar__mode-btn ${
              activeMode === 'SIMULASI' ? 'dash-subbar__mode-btn--active-sim' : ''
            }`}
            onClick={() => onModeChange('SIMULASI')}
            title="Beralih ke Skenario Simulasi Megathrust, Flink Engine, dan Schema Governance"
          >
            <span className="dash-subbar__mode-icon">🧪</span>
            <span className="dash-subbar__mode-title">SKENARIO SIMULASI</span>
            <span className="dash-subbar__mode-tag">SIMULASI</span>
          </button>
        </div>

        {/* Pemisah Vertikal */}
        <div className="dash-subbar__divider"></div>

        {/* Tab Navigasi Seksi Workspace */}
        <div className="dash-subbar__tabs">
          <span className="dash-subbar__group-label">SEKSI WORKSPACE:</span>

          {activeMode === 'REAL' ? (
            <>
              <button
                type="button"
                className={`dash-subbar__tab-btn ${
                  activeSection === 'section-operasional' ? 'dash-subbar__tab-btn--active' : ''
                }`}
                onClick={() => handleTabClick('section-operasional')}
              >
                <span className="dash-subbar__tab-icon">📊</span>
                <span>PETA & OPERASIONAL</span>
              </button>

              <button
                type="button"
                className={`dash-subbar__tab-btn ${
                  activeSection === 'section-volcano-hub' ? 'dash-subbar__tab-btn--active' : ''
                }`}
                onClick={() => handleTabClick('section-volcano-hub')}
              >
                <span className="dash-subbar__tab-icon">🌋</span>
                <span>SEISMOGRAF & RIWAYAT</span>
              </button>

              <button
                type="button"
                className={`dash-subbar__tab-btn ${
                  activeSection === 'section-ai' ? 'dash-subbar__tab-btn--active' : ''
                }`}
                onClick={() => handleTabClick('section-ai')}
              >
                <span className="dash-subbar__tab-icon">🤖</span>
                <span>GEMINI AI INTEL</span>
              </button>

              <button
                type="button"
                className={`dash-subbar__tab-btn ${
                  activeSection === 'section-ocean' ? 'dash-subbar__tab-btn--active' : ''
                }`}
                onClick={() => handleTabClick('section-ocean')}
              >
                <span className="dash-subbar__tab-icon">🌊</span>
                <span>LAUT & PASUT</span>
              </button>

              <button
                type="button"
                className={`dash-subbar__tab-btn ${
                  activeSection === 'section-events' ? 'dash-subbar__tab-btn--active' : ''
                }`}
                onClick={() => handleTabClick('section-events')}
              >
                <span className="dash-subbar__tab-icon">📡</span>
                <span>EVENT STREAM</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`dash-subbar__tab-btn dash-subbar__tab-btn--sim ${
                  activeSection === 'section-simulation-drill' ? 'dash-subbar__tab-btn--active-sim' : ''
                }`}
                onClick={() => handleTabClick('section-simulation-drill')}
              >
                <span className="dash-subbar__tab-icon">🚨</span>
                <span>SKENARIO MEGATHRUST</span>
              </button>

              <button
                type="button"
                className={`dash-subbar__tab-btn dash-subbar__tab-btn--sim ${
                  activeSection === 'section-flink' ? 'dash-subbar__tab-btn--active-sim' : ''
                }`}
                onClick={() => handleTabClick('section-flink')}
              >
                <span className="dash-subbar__tab-icon">⚡</span>
                <span>FLINK SQL & DAG</span>
              </button>

              <button
                type="button"
                className={`dash-subbar__tab-btn dash-subbar__tab-btn--sim ${
                  activeSection === 'section-governance' ? 'dash-subbar__tab-btn--active-sim' : ''
                }`}
                onClick={() => handleTabClick('section-governance')}
              >
                <span className="dash-subbar__tab-icon">🛡️</span>
                <span>SCHEMA REGISTRY</span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
