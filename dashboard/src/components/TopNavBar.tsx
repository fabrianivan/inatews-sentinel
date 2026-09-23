'use client';

import { useState, useEffect } from 'react';

interface TopNavBarProps {
  connected?: boolean;
  alertCount?: number;
  riskLevel?: string;
}

export default function TopNavBar({}: TopNavBarProps) {
  const [timeStr, setTimeStr] = useState({ utc: '', wib: '', wita: '', wit: '' });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr({
        utc: now.toISOString().substring(11, 19) + ' UTC',
        wib:
          new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(now) + ' WIB',
        wita:
          new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Makassar',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(now) + ' WITA',
        wit:
          new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jayapura',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(now) + ' WIT',
      });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="dash-topbar">
      {/* Brand & Platform Identity */}
      <div className="dash-topbar__brand">
        <div className="dash-topbar__logo">
          <span className="dash-topbar__logo-icon">🌋</span>
          <span className="dash-topbar__logo-pulse"></span>
        </div>
        <div className="dash-topbar__title-group">
          <div className="dash-topbar__title">
            <span>INATEWS SENTINEL</span>
            <span className="dash-topbar__badge">MISSION CONTROL v3.2</span>
          </div>
          <div className="dash-topbar__subtitle">
            Sistem Peringatan Dini Bencana Multi-Domain • BMKG + PVMBG + IOC UNESCO
          </div>
        </div>
      </div>

      {/* Clocks & Quick Actions */}
      <div className="dash-topbar__right">
        {/* Multi-timezone Clocks */}
        <div className="dash-topbar__clock">
          <span className="dash-clock__icon">⏱</span>
          <span className="dash-clock__main">{timeStr.wib || '16:00:00 WIB'}</span>
          <span className="dash-clock__sep">|</span>
          <span className="dash-clock__sub">{timeStr.wita}</span>
          <span className="dash-clock__sep">|</span>
          <span className="dash-clock__sub">{timeStr.wit}</span>
          <span className="dash-clock__sep">|</span>
          <span className="dash-clock__utc">{timeStr.utc || '09:00:00 UTC'}</span>
        </div>
      </div>
    </header>
  );
}
