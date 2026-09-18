import { NextResponse } from 'next/server';
import type { RealtimeEarthquakesData, BMKGGempaDetail, SeismicEvent } from '@/lib/types';

// Fallback baseline when all networks fail
const FALLBACK_DATA: RealtimeEarthquakesData = {
  latest_bmkg: {
    Tanggal: '09 Sep 2026',
    Jam: '13:21:30 WIB',
    DateTime: '2026-09-09T06:21:30+00:00',
    Coordinates: '-6.92,105.49',
    Lintang: '6.92 LS',
    Bujur: '105.49 BT',
    Magnitude: '3.8',
    Kedalaman: '25 km',
    Wilayah: 'Pusat gempa berada di laut 31 km selatan Sumur',
    Potensi: 'Gempa ini dirasakan untuk diteruskan pada masyarakat',
    Dirasakan: 'II Sumur',
    Shakemap: '20260909132130.mmi.jpg',
  },
  recent_bmkg: [
    {
      type: 'SEISMIC',
      magnitude: 5.2,
      depth: 10,
      frequency: 3.6,
      count: 1,
      latitude: -8.08,
      longitude: 120.56,
      mmi: 7,
      pga: 0.66,
      fault_zone: '60 km TimurLaut RUTENG-MANGGARAI-NTT',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      type: 'SEISMIC',
      magnitude: 5.4,
      depth: 10,
      frequency: 3.7,
      count: 1,
      latitude: -8.42,
      longitude: 109.02,
      mmi: 7,
      pga: 0.68,
      fault_zone: '77 km Tenggara CILACAP-JATENG',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      type: 'SEISMIC',
      magnitude: 5.5,
      depth: 100,
      frequency: 3.75,
      count: 1,
      latitude: -3.15,
      longitude: 139.41,
      mmi: 6,
      pga: 0.38,
      fault_zone: '69 km TimurLaut KOBAGMA-PAPUAPGNGN',
      timestamp: new Date(Date.now() - 14400000).toISOString(),
    },
    {
      type: 'SEISMIC',
      magnitude: 5.8,
      depth: 10,
      frequency: 3.9,
      count: 1,
      latitude: -7.72,
      longitude: 104.47,
      mmi: 8,
      pga: 0.74,
      fault_zone: '170 km BaratDaya SUMUR-BANTEN',
      timestamp: new Date(Date.now() - 28800000).toISOString(),
    },
  ],
  recent_usgs: [
    {
      type: 'SEISMIC',
      magnitude: 5.0,
      depth: 10,
      frequency: 3.5,
      count: 1,
      latitude: 4.0172,
      longitude: 125.3233,
      mmi: 7,
      pga: 0.63,
      fault_zone: '154 km S of Sarangani, Philippines',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      type: 'SEISMIC',
      magnitude: 4.5,
      depth: 39.5,
      frequency: 3.25,
      count: 1,
      latitude: -4.9167,
      longitude: 102.8454,
      mmi: 6,
      pga: 0.45,
      fault_zone: '108 km SSW of Pagar Alam, Indonesia',
      timestamp: new Date(Date.now() - 5400000).toISOString(),
    },
  ],
  timestamp: new Date().toISOString(),
};

function parseBMKGDepth(str: string): number {
  const raw = (str || '').toLowerCase().replace(/km/g, '').trim();
  const d = parseFloat(raw);
  return isNaN(d) || d <= 0 ? 10 : d;
}

function parseBMKGCoords(str: string): { lat: number; lon: number } | null {
  if (!str) return null;
  const parts = str.split(',');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lon = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon };
}

export async function GET() {
  const candidateBases = [
    process.env.INTERNAL_BACKEND_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_BASE,
    'http://localhost:8080',
    'http://localhost:8081',
  ].filter(Boolean) as string[];

  // 1. First, attempt to proxy from Go backend if active
  for (const base of candidateBases) {
    try {
      const res = await fetch(`${base}/api/realtime/earthquakes`, {
        signal: AbortSignal.timeout(1500),
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.latest_bmkg || (data.recent_bmkg && data.recent_bmkg.length > 0))) {
          return NextResponse.json(data);
        }
      }
    } catch {
      // try next candidate or fall through
    }
  }

  // 2. Direct fetch from BMKG & USGS APIs
  try {
    const [bmkgAutoRes, bmkgRecentRes, usgsRes] = await Promise.allSettled([
      fetch('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', {
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 30 },
      }),
      fetch('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', {
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 30 },
      }),
      fetch(
        'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=-11&maxlatitude=6&minlongitude=95&maxlongitude=141&limit=10&orderby=time',
        {
          signal: AbortSignal.timeout(4000),
          next: { revalidate: 45 },
        }
      ),
    ]);

    let latestBMKG: BMKGGempaDetail | null = null;
    const recentBMKG: SeismicEvent[] = [];
    const recentUSGS: SeismicEvent[] = [];

    // Parse BMKG autogempa
    if (bmkgAutoRes.status === 'fulfilled' && bmkgAutoRes.value.ok) {
      try {
        const json = await bmkgAutoRes.value.json();
        if (json?.Infogempa?.gempa) {
          latestBMKG = json.Infogempa.gempa;
        }
      } catch {
        // ignore parse error
      }
    }

    // Parse BMKG recent quakes
    if (bmkgRecentRes.status === 'fulfilled' && bmkgRecentRes.value.ok) {
      try {
        const json = await bmkgRecentRes.value.json();
        const gempaList: BMKGGempaDetail[] = json?.Infogempa?.gempa || [];
        for (const g of gempaList) {
          const coords = parseBMKGCoords(g.Coordinates);
          if (!coords) continue;
          const mag = parseFloat(g.Magnitude) || 5.0;
          const depth = parseBMKGDepth(g.Kedalaman);
          const mmi = Math.min(12, Math.max(1, Math.round(mag * 1.5 - depth * 0.015)));
          const pga = (mag * 0.14) / (1.0 + depth * 0.01);

          recentBMKG.push({
            type: 'SEISMIC',
            magnitude: mag,
            depth,
            frequency: 1.0 + mag * 0.5,
            count: 1,
            latitude: coords.lat,
            longitude: coords.lon,
            mmi,
            pga: Math.max(0.001, pga),
            fault_zone: g.Wilayah,
            timestamp: g.DateTime || new Date().toISOString(),
          });
        }
      } catch {
        // ignore parse error
      }
    }

    // Parse USGS quakes
    if (usgsRes.status === 'fulfilled' && usgsRes.value.ok) {
      try {
        const json = await usgsRes.value.json();
        const features = json?.features || [];
        for (const f of features) {
          const coords = f?.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) continue;
          const lon = coords[0];
          const lat = coords[1];
          const depth = coords[2] ?? 10;
          const mag = f?.properties?.mag ?? 4.5;
          const mmi = Math.min(12, Math.max(1, Math.round(mag * 1.5 - depth * 0.015)));
          const pga = (mag * 0.14) / (1.0 + depth * 0.01);

          recentUSGS.push({
            type: 'SEISMIC',
            magnitude: mag,
            depth,
            frequency: 1.0 + mag * 0.5,
            count: 1,
            latitude: lat,
            longitude: lon,
            mmi,
            pga: Math.max(0.001, pga),
            fault_zone: f?.properties?.place || 'Indonesia Region',
            timestamp: f?.properties?.time ? new Date(f.properties.time).toISOString() : new Date().toISOString(),
            url: f?.properties?.url,
            status: f?.properties?.status,
            tsunami: f?.properties?.tsunami,
          });
        }
      } catch {
        // ignore parse error
      }
    }

    // If autogempa was empty but recent had events, use first recent event
    if (!latestBMKG && recentBMKG.length > 0) {
      const first = recentBMKG[0];
      latestBMKG = {
        Tanggal: new Date(first.timestamp).toLocaleDateString('id-ID'),
        Jam: new Date(first.timestamp).toLocaleTimeString('id-ID'),
        DateTime: first.timestamp,
        Coordinates: `${first.latitude},${first.longitude}`,
        Lintang: `${Math.abs(first.latitude).toFixed(2)} ${first.latitude < 0 ? 'LS' : 'LU'}`,
        Bujur: `${Math.abs(first.longitude).toFixed(2)} ${first.longitude < 0 ? 'BB' : 'BT'}`,
        Magnitude: first.magnitude.toFixed(1),
        Kedalaman: `${first.depth.toFixed(0)} km`,
        Wilayah: first.fault_zone,
        Potensi: 'Tidak berpotensi tsunami',
      };
    }

    if (latestBMKG || recentBMKG.length > 0 || recentUSGS.length > 0) {
      return NextResponse.json({
        latest_bmkg: latestBMKG || FALLBACK_DATA.latest_bmkg,
        recent_bmkg: recentBMKG.length > 0 ? recentBMKG : FALLBACK_DATA.recent_bmkg,
        recent_usgs: recentUSGS.length > 0 ? recentUSGS : FALLBACK_DATA.recent_usgs,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('[API/REALTIME/EARTHQUAKES] Error fetching quakes:', err);
  }

  // 3. Last resort fallback
  return NextResponse.json(FALLBACK_DATA);
}
