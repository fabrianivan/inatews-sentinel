'use client';

import { useId } from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

/**
 * Modern minimalist squircle emblem for INATEWS SENTINEL:
 * concentric tectonic sonar rings, coral epicenter core, and bold
 * sweeping seismic-tsunami pulse wave.
 */
export function BrandLogo({ size = 36, className = '' }: BrandLogoProps) {
  const uid = useId().replace(/:/g, '');
  const sqBgId = `sqBg-${uid}`;
  const sqRimId = `sqRim-${uid}`;
  const glowId = `ambientGlow-${uid}`;
  const ringGradId = `ringGrad-${uid}`;
  const wavePulseId = `wavePulse-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={sqBgId} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#070d1d" />
          <stop offset="55%" stopColor="#0d1b35" />
          <stop offset="100%" stopColor="#083047" />
        </linearGradient>
        <linearGradient id={sqRimId} x1="32" y1="3" x2="32" y2="61" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="55%" stopColor="#22d3ee" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.12" />
        </linearGradient>
        <radialGradient
          id={glowId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(32 27) rotate(90) scale(21)"
        >
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ringGradId} x1="20" y1="15" x2="44" y2="39" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={wavePulseId} x1="12" y1="42" x2="52" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="45%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      {/* Rounded App Squircle */}
      <rect x="3" y="3" width="58" height="58" rx="16" fill={`url(#${sqBgId})`} />
      <rect
        x="3.75"
        y="3.75"
        width="56.5"
        height="56.5"
        rx="15.25"
        stroke={`url(#${sqRimId})`}
        strokeWidth="1.5"
      />

      {/* Subtle Atmospheric Glow */}
      <circle cx="32" cy="27" r="21" fill={`url(#${glowId})`} />

      {/* Concentric Tectonic Sonar Rings */}
      <circle cx="32" cy="27" r="17.5" stroke="#38bdf8" strokeOpacity="0.28" strokeWidth="1.6" />
      <circle cx="32" cy="27" r="11.5" stroke={`url(#${ringGradId})`} strokeWidth="3.2" />

      {/* Coral Crimson Epicenter Core */}
      <circle cx="32" cy="27" r="6.8" fill="#fb7185" fillOpacity="0.26" />
      <circle cx="32" cy="27" r="3.8" fill="#fb7185" stroke="#fff1f2" strokeWidth="1" />

      {/* Knockout Gap + Sweeping Seismic-Tsunami Wave */}
      <path
        d="M11.5 43.5H20L24.5 34.5L29.5 48.5L34 39C38.5 37.5 43.5 45.5 52.5 42"
        stroke="#091529"
        strokeWidth="7.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 43.5H20L24.5 34.5L29.5 48.5L34 39C38.5 37.5 43.5 45.5 52.5 42"
        stroke={`url(#${wavePulseId})`}
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
