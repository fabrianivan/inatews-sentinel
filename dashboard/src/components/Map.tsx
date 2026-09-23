'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LifecyclePhase, LiveEvent, RealtimeEarthquakesData, VolcanoEruption, TsunamiScenario, IncidentEvent } from '@/lib/types';
import { INDONESIAN_VOLCANOES, findVolcanoLocation, getVolcanicAshTrajectory } from '@/lib/volcanoData';

interface MapProps {
  activityLevel?: number;
  tsunamiActive?: boolean;
  tsunamiScenario?: TsunamiScenario | null;
  isSimulasi?: boolean;
  activeIncident?: IncidentEvent | null;
  phase?: LifecyclePhase | null;
  events?: LiveEvent[];
  realQuakes?: RealtimeEarthquakesData | null;
  focusCoords?: { lat: number; lon: number } | null;
  volcanoes?: VolcanoEruption[];
  selectedVolcano?: string | null;
  onSelectVolcano?: (name: string) => void;
  onInspectVolcanoSeismogram?: (volcano: VolcanoEruption) => void;
}

// Major Indonesian Tectonic & Fault Systems
const FAULT_SYSTEMS = [
  {
    id: 'sundaMegathrust',
    name: 'Sunda Megathrust (M8.2+)',
    fullName: 'Sunda Megathrust (Sumatra Segment)',
    color: '#ff2a5f',
    coords: [
      [5.5, 93.5],
      [3.0, 95.5],
      [1.0, 97.2],
      [-1.0, 99.0],
      [-2.5, 99.8],
      [-4.5, 102.0],
      [-6.0, 104.0],
    ] as [number, number][],
  },
  {
    id: 'javaTrench',
    name: 'Java Trench (M8.8)',
    fullName: 'Java Trench (South Java Megathrust)',
    color: '#ff5722',
    coords: [
      [-6.8, 105.2],
      [-8.0, 107.2],
      [-9.1, 109.5],
      [-9.8, 112.5],
      [-10.5, 115.5],
      [-11.0, 118.0],
    ] as [number, number][],
  },
  {
    id: 'paluKoro',
    name: 'Palu-Koro Fault',
    fullName: 'Palu-Koro Strike-Slip Fault',
    color: '#ffd600',
    coords: [
      [0.8, 119.6],
      [-0.18, 119.85],
      [-0.9, 119.87],
      [-1.8, 120.3],
      [-2.8, 120.8],
    ] as [number, number][],
  },
  {
    id: 'bandaSubduction',
    name: 'Banda Subduction Arc & Flores Thrust',
    fullName: 'Banda Subduction Arc & Flores Thrust',
    color: '#a855f7',
    coords: [
      [-8.2, 118.5],
      [-8.0, 121.5],
      [-7.5, 125.0],
      [-5.5, 128.5],
      [-4.0, 131.5],
    ] as [number, number][],
  },
  {
    id: 'sorongFault',
    name: 'Sorong Transform Fault (Papua)',
    fullName: 'Sorong Transform Fault (Papua)',
    color: '#00f2ff',
    coords: [
      [-1.2, 130.5],
      [-1.1, 133.0],
      [-1.6, 136.5],
      [-2.5, 140.7],
    ] as [number, number][],
  },
];

// BMKG Real-Time Broadband Seismic Network
const SEISMIC_STATIONS = [
  { id: 'LEM', name: 'Lembang (West Java)', pos: [-6.83, 107.62] as [number, number] },
  { id: 'JATS', name: 'Jatiluhur (West Java)', pos: [-6.52, 107.41] as [number, number] },
  { id: 'CBJI', name: 'Cibinong (West Java)', pos: [-6.49, 106.85] as [number, number] },
  { id: 'KLI', name: 'Kotabumi (Lampung)', pos: [-4.83, 104.88] as [number, number] },
  { id: 'PDSI', name: 'Padang (West Sumatra)', pos: [-0.95, 100.35] as [number, number] },
  { id: 'BKB', name: 'Bukittinggi (West Sumatra)', pos: [-0.30, 100.37] as [number, number] },
  { id: 'YOGI', name: 'Yogyakarta (DIY)', pos: [-7.78, 110.37] as [number, number] },
  { id: 'PLAI', name: 'Palu (Central Sulawesi)', pos: [-0.90, 119.87] as [number, number] },
  { id: 'MNI', name: 'Manado (North Sulawesi)', pos: [1.48, 124.84] as [number, number] },
  { id: 'AAI', name: 'Ambon (Maluku)', pos: [-3.70, 128.18] as [number, number] },
  { id: 'BND', name: 'Banda Aceh (Aceh)', pos: [5.55, 95.32] as [number, number] },
  { id: 'JAY', name: 'Jayapura (Papua)', pos: [-2.53, 140.72] as [number, number] },
];

// InaTEWS DART Tsunami Buoy Array
const TSUNAMI_BUOYS = [
  { id: 'BUOY-INA-01', name: 'Selat Sunda / Sebesi', pos: [-5.95, 105.48] as [number, number] },
  { id: 'BUOY-INA-02', name: 'Mentawai Offshore', pos: [-1.15, 100.12] as [number, number] },
  { id: 'BUOY-INA-03', name: 'Cilacap Indian Ocean', pos: [-7.95, 109.10] as [number, number] },
  { id: 'BUOY-INA-04', name: 'Palu Bay / Pantoloan', pos: [-0.72, 119.86] as [number, number] },
  { id: 'BUOY-INA-05', name: 'Aceh Indian Ocean', pos: [5.62, 95.15] as [number, number] },
  { id: 'BUOY-INA-06', name: 'Pangandaran South', pos: [-7.78, 108.65] as [number, number] },
];

export default function Map({
  activityLevel = 15,
  tsunamiActive = false,
  tsunamiScenario = null,
  isSimulasi = false,
  activeIncident = null,
  phase,
  events,
  realQuakes,
  focusCoords,
  volcanoes = [],
  selectedVolcano = null,
  onSelectVolcano,
  onInspectVolcanoSeismogram,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const quakeLayerRef = useRef<L.LayerGroup | null>(null);
  const volcanoLayerRef = useRef<L.LayerGroup | null>(null);
  const ashLayerRef = useRef<L.LayerGroup | null>(null);
  const tsunamiImpactLayerRef = useRef<L.LayerGroup | null>(null);
  const sundaLayerRef = useRef<L.LayerGroup | null>(null);
  const javaTrenchLayerRef = useRef<L.LayerGroup | null>(null);
  const paluKoroLayerRef = useRef<L.LayerGroup | null>(null);
  const otherFaultsLayerRef = useRef<L.LayerGroup | null>(null);
  const stationLayerRef = useRef<L.LayerGroup | null>(null);
  const buoyLayerRef = useRef<L.LayerGroup | null>(null);
  const latestMarkerRef = useRef<L.Marker | null>(null);
  const [mouseCoords, setMouseCoords] = useState<string>('0.00°S, 118.00°E');
  const [isLegendCollapsed, setIsLegendCollapsed] = useState<boolean>(false);
  const [activeLayer, setActiveLayer] = useState<{
    sundaMegathrust: boolean;
    javaTrench: boolean;
    paluKoro: boolean;
    volcanoes: boolean;
    ash: boolean;
    stations: boolean;
    buoys: boolean;
    tsunamiImpact: boolean;
  }>({
    sundaMegathrust: true,
    javaTrench: true,
    paluKoro: true,
    volcanoes: true,
    ash: true,
    stations: true,
    buoys: true,
    tsunamiImpact: true,
  });

  const [impactHudData, setImpactHudData] = useState<{
    active: boolean;
    region: string;
    epicenter: [number, number];
    magnitude: number;
    depth: number;
    mmi: string;
    tsunamiWave: string;
    population: number;
    infrastructure: number;
    stage: string;
    status: string;
  } | null>(null);

  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Centered on the Indonesian Archipelago
    const map = L.map(mapContainerRef.current, {
      center: [-2.5, 118.0],
      zoom: 5,
      minZoom: 4,
      maxZoom: 13,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // High quality ESRI World Imagery
    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri, Maxar, BMKG, USGS',
        maxZoom: 18,
      }
    );

    // ESRI Ocean Bathymetry
    const oceanLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri, NOAA, GEBCO',
        maxZoom: 16,
      }
    );

    satelliteLayer.addTo(map);

    const baseMaps = {
      '🛰️ Satelit (ESRI)': satelliteLayer,
      '🌊 Batimetri Oseanografi': oceanLayer,
    };
    L.control.layers(baseMaps, undefined, { position: 'topright' }).addTo(map);

    // Mouse coordinates tracker
    map.on('mousemove', (e) => {
      const latStr = `${Math.abs(e.latlng.lat).toFixed(2)}°${e.latlng.lat >= 0 ? 'N' : 'S'}`;
      const lonStr = `${Math.abs(e.latlng.lng).toFixed(2)}°${e.latlng.lng >= 0 ? 'E' : 'W'}`;
      setMouseCoords(`${latStr}, ${lonStr}`);
    });

    // 1. Layer group for Sunda Megathrust (Sumatra Segment)
    sundaLayerRef.current = L.layerGroup().addTo(map);
    const sundaFault = FAULT_SYSTEMS.find((f) => f.id === 'sundaMegathrust');
    if (sundaFault) {
      L.polyline(sundaFault.coords, {
        color: sundaFault.color,
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 6',
      }).addTo(sundaLayerRef.current).bindPopup(`
        <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a;">
          <strong style="color: ${sundaFault.color}; font-size: 13px;">⚡ ${sundaFault.name}</strong><br/>
          <span style="font-size: 11px; color: #64748b;">${sundaFault.fullName} — Potensi Megathrust M8.2+</span>
        </div>
      `);
    }

    // 2. Layer group for Java Trench (South Java Megathrust)
    javaTrenchLayerRef.current = L.layerGroup().addTo(map);
    const javaFault = FAULT_SYSTEMS.find((f) => f.id === 'javaTrench');
    if (javaFault) {
      L.polyline(javaFault.coords, {
        color: javaFault.color,
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 6',
      }).addTo(javaTrenchLayerRef.current).bindPopup(`
        <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a;">
          <strong style="color: ${javaFault.color}; font-size: 13px;">⚡ ${javaFault.name}</strong><br/>
          <span style="font-size: 11px; color: #64748b;">${javaFault.fullName} — Potensi Megathrust M8.8</span>
        </div>
      `);
    }

    // 3. Layer group for Palu-Koro Strike-Slip Fault
    paluKoroLayerRef.current = L.layerGroup().addTo(map);
    const paluFault = FAULT_SYSTEMS.find((f) => f.id === 'paluKoro');
    if (paluFault) {
      L.polyline(paluFault.coords, {
        color: paluFault.color,
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 6',
      }).addTo(paluKoroLayerRef.current).bindPopup(`
        <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a;">
          <strong style="color: ${paluFault.color}; font-size: 13px;">⚡ ${paluFault.name}</strong><br/>
          <span style="font-size: 11px; color: #64748b;">${paluFault.fullName} — Sesar Geser Mendatar Aktif</span>
        </div>
      `);
    }

    // 4. Layer group for Other Regional Faults
    otherFaultsLayerRef.current = L.layerGroup().addTo(map);
    FAULT_SYSTEMS.filter((f) => !['sundaMegathrust', 'javaTrench', 'paluKoro'].includes(f.id)).forEach((fault) => {
      L.polyline(fault.coords, {
        color: fault.color,
        weight: 3,
        opacity: 0.75,
        dashArray: '8, 6',
      }).addTo(otherFaultsLayerRef.current!).bindPopup(`
        <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a;">
          <strong style="color: ${fault.color}; font-size: 13px;">⚡ ${fault.name}</strong><br/>
          <span style="font-size: 11px; color: #64748b;">Zona Sesar Tektonik Regional Indonesia</span>
        </div>
      `);
    });

    // 5. Layer group for BMKG Seismic Stations
    stationLayerRef.current = L.layerGroup().addTo(map);
    SEISMIC_STATIONS.forEach((st) => {
      const stIcon = L.divIcon({
        className: 'station-marker',
        html: `
          <div style="display: flex; align-items: center; gap: 4px; background: rgba(6,10,20,0.88); border: 1px solid #00f2ff; border-radius: 4px; padding: 2px 6px; color: #00f2ff; font-family: monospace; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 0 8px rgba(0,242,255,0.35);">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #00e676;"></span>
            ${st.id}
          </div>
        `,
        iconSize: [56, 20],
        iconAnchor: [28, 10],
      });

      L.marker(st.pos, { icon: stIcon })
        .addTo(stationLayerRef.current!)
        .bindPopup(`
          <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a;">
            <strong style="font-size: 13px; color: #0284c7;">📡 Stasiun BMKG: ${st.id}</strong><br/>
            <span style="font-size: 11px; color: #475569;">Lokasi: ${st.name}</span><br/>
            <span style="font-size: 11px; color: #16a34a; font-weight: 600;">Status: ONLINE • 100Hz Real-Time Waveform</span>
          </div>
        `);
    });

    // 6. Layer group for InaTEWS DART Buoys
    buoyLayerRef.current = L.layerGroup().addTo(map);
    TSUNAMI_BUOYS.forEach((buoy) => {
      const buoyIcon = L.divIcon({
        className: 'buoy-marker',
        html: `
          <div style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: rgba(6,182,212,0.25); border: 2px solid #06b6d4; box-shadow: 0 0 10px #06b6d4; font-size: 11px;">
            🌊
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      L.marker(buoy.pos, { icon: buoyIcon })
        .addTo(buoyLayerRef.current!)
        .bindPopup(`
          <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a;">
            <strong style="font-size: 13px; color: #0891b2;">🌊 ${buoy.id}</strong><br/>
            <span style="font-size: 11px; color: #475569;">Pelampung Tsunami: ${buoy.name}</span><br/>
            <span style="font-size: 11px; color: #059669;">Sensor Tekanan Dasar Laut: Normal</span>
          </div>
        `);
    });

    // Layer group for earthquakes
    quakeLayerRef.current = L.layerGroup().addTo(map);
    // Layer group for volcanoes
    volcanoLayerRef.current = L.layerGroup().addTo(map);
    // Layer group for volcanic ash dispersion simulation
    ashLayerRef.current = L.layerGroup().addTo(map);
    // Layer group for simulated tsunami inundation & critical infrastructure impacts
    tsunamiImpactLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    const timer = setTimeout(() => map.invalidateSize(), 250);
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 1b. Reactive Layer Toggles for Faults, Stations & Buoys
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const toggle = (layerRef: React.RefObject<L.LayerGroup | null>, isActive: boolean) => {
      const layer = layerRef.current;
      if (!layer) return;
      if (isActive) {
        if (!map.hasLayer(layer)) layer.addTo(map);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      }
    };

    toggle(sundaLayerRef, activeLayer.sundaMegathrust);
    toggle(javaTrenchLayerRef, activeLayer.javaTrench);
    toggle(paluKoroLayerRef, activeLayer.paluKoro);
    toggle(stationLayerRef, activeLayer.stations);
    toggle(buoyLayerRef, activeLayer.buoys);
  }, [
    activeLayer.sundaMegathrust,
    activeLayer.javaTrench,
    activeLayer.paluKoro,
    activeLayer.stations,
    activeLayer.buoys,
  ]);

  // 2. Plot real earthquakes from BMKG & USGS
  useEffect(() => {
    const map = mapRef.current;
    const layer = quakeLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // Plot BMKG recent earthquakes
    if (realQuakes?.recent_bmkg) {
      realQuakes.recent_bmkg.forEach((item) => {
        const q = item as unknown as Record<string, unknown>;
        let lat = typeof q.latitude === 'number' ? q.latitude : undefined;
        let lon = typeof q.longitude === 'number' ? q.longitude : undefined;
        if (lat === undefined && typeof q.Coordinates === 'string') {
          const parts = q.Coordinates.split(',');
          if (parts.length === 2) {
            lat = parseFloat(parts[0].trim());
            lon = parseFloat(parts[1].trim());
          }
        }
        if (lat === undefined && typeof q.Lintang === 'string') {
          lat = parseFloat(q.Lintang);
          if (q.Lintang.includes('LS')) lat = -Math.abs(lat);
        }
        if (lon === undefined && typeof q.Bujur === 'string') {
          lon = parseFloat(q.Bujur);
          if (q.Bujur.includes('BB')) lon = -Math.abs(lon);
        }
        if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) return;

        const rawMag = typeof q.magnitude === 'number' ? q.magnitude : parseFloat(String(q.Magnitude || ''));
        const magnitude = isNaN(rawMag) ? 5.0 : rawMag;
        const rawDepth = typeof q.depth === 'number' ? q.depth : parseFloat(String(q.Kedalaman || '').replace(/km/i, '').trim());
        const depth = isNaN(rawDepth) ? 10 : rawDepth;
        const faultZone = String(q.fault_zone || q.Wilayah || 'Wilayah Indonesia');
        const timestamp = q.timestamp ? String(q.timestamp) : (q.DateTime ? String(q.DateTime) : new Date().toISOString());

        const color = magnitude >= 6.0 ? '#ef4444' : magnitude >= 5.0 ? '#f59e0b' : '#34d399';
        const radius = Math.max(7, magnitude * 2.8);

        const circle = L.circleMarker([lat, lon], {
          radius,
          color,
          fillColor: color,
          fillOpacity: 0.65,
          weight: 2,
        });

        circle.bindPopup(`
          <div style="font-family: Inter, sans-serif; padding: 8px; color: #0f172a; min-width: 200px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="background: ${color}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 12px;">
                M${magnitude.toFixed(1)}
              </span>
              <span style="font-size: 10px; color: #64748b; font-weight: 700;">BMKG TEWS</span>
            </div>
            <strong style="font-size: 12px; color: #0f172a;">${faultZone}</strong><br/>
            <span style="font-size: 11px; color: #475569;">Kedalaman: ${depth} km</span><br/>
            <span style="font-size: 10px; color: #64748b;">Koordinat: ${lat.toFixed(2)}°, ${lon.toFixed(2)}°</span><br/>
            <span style="font-size: 9.5px; color: #94a3b8;">Waktu: ${new Date(timestamp).toLocaleString('id-ID')} WIB</span>
          </div>
        `);

        circle.addTo(layer);
      });
    }

    // Plot USGS recent earthquakes
    if (realQuakes?.recent_usgs) {
      realQuakes.recent_usgs.forEach((item) => {
        const q = item as unknown as Record<string, unknown>;
        const lat = typeof q.latitude === 'number' ? q.latitude : undefined;
        const lon = typeof q.longitude === 'number' ? q.longitude : undefined;
        if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) return;

        const rawMag = typeof q.magnitude === 'number' ? q.magnitude : parseFloat(String(q.Magnitude || ''));
        const magnitude = isNaN(rawMag) ? 4.5 : rawMag;
        const rawDepth = typeof q.depth === 'number' ? q.depth : 10;
        const depth = isNaN(rawDepth) ? 10 : rawDepth;
        const faultZone = String(q.fault_zone || q.place || 'Indonesia Region');

        const circle = L.circleMarker([lat, lon], {
          radius: Math.max(5, magnitude * 2.2),
          color: '#38bdf8',
          fillColor: '#0284c7',
          fillOpacity: 0.5,
          weight: 1.5,
        });

        circle.bindPopup(`
          <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="background: #0284c7; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11px;">
                M${magnitude.toFixed(1)}
              </span>
              <span style="font-size: 10px; color: #64748b; font-weight: 600;">USGS GEOJSON</span>
            </div>
            <strong style="font-size: 12px; color: #0f172a;">${faultZone}</strong><br/>
            <span style="font-size: 11px; color: #475569;">Depth: ${depth.toFixed(0)} km</span>
          </div>
        `);

        circle.addTo(layer);
      });
    }

    // Plot Latest BMKG Autogempa with pulsating hero marker
    if (realQuakes?.latest_bmkg) {
      const b = realQuakes.latest_bmkg;
      let lat: number | null = null;
      let lon: number | null = null;
      if (b.Coordinates) {
        const parts = b.Coordinates.split(',');
        if (parts.length === 2) {
          lat = parseFloat(parts[0].trim());
          lon = parseFloat(parts[1].trim());
        }
      }
      if (lat === null && b.Lintang && b.Bujur) {
        lat = parseFloat(b.Lintang);
        if (b.Lintang.includes('LS')) lat = -Math.abs(lat);
        lon = parseFloat(b.Bujur);
        if (b.Bujur.includes('BB')) lon = -Math.abs(lon);
      }

      if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
        const mag = parseFloat(b.Magnitude) || 4.5;

        if (latestMarkerRef.current) {
          latestMarkerRef.current.remove();
        }

        const heroIcon = L.divIcon({
          className: 'latest-gempa-hero-icon',
          html: `
            <div style="position: relative; width: 36px; height: 36px;">
              <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(255, 69, 0, 0.45); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position: absolute; top: 9px; left: 9px; width: 18px; height: 18px; border-radius: 50%; background: #ff4500; border: 2.5px solid white; box-shadow: 0 0 16px #ff4500; display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; font-weight: 800;">
                ⚡
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const heroMarker = L.marker([lat, lon], { icon: heroIcon, zIndexOffset: 1000 }).addTo(layer);
        heroMarker.bindPopup(`
          <div style="font-family: Inter, sans-serif; padding: 8px; color: #0f172a; min-width: 220px;">
            <div style="background: #ff4500; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 12px; margin-bottom: 6px; display: inline-block;">
              GEMPA TERKINI BMKG • M${mag.toFixed(1)}
            </div><br/>
            <strong style="font-size: 13px; color: #0f172a;">${b.Wilayah}</strong><br/>
            <span style="font-size: 11px; color: #475569;">Kedalaman: ${b.Kedalaman}</span><br/>
            <span style="font-size: 11px; color: #16a34a; font-weight: 600;">${b.Potensi}</span><br/>
            <span style="font-size: 10px; color: #64748b;">${b.Tanggal} • ${b.Jam}</span>
          </div>
        `);
        latestMarkerRef.current = heroMarker;
      }
    }
  }, [realQuakes]);

  // 3. Plot Indonesian active volcanoes & MAGMA live eruption feeds
  useEffect(() => {
    const map = mapRef.current;
    const layer = volcanoLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (!activeLayer.volcanoes) return;

    INDONESIAN_VOLCANOES.forEach((v) => {
      // Find matching live eruption report from PVMBG if available
      const report = volcanoes.find((e) => {
        const cleanErup = e.volcano_name.toLowerCase().trim().replace(/^g\.\s*/, '');
        return v.name.toLowerCase().includes(cleanErup) || cleanErup.includes(v.name.toLowerCase());
      });

      const level = report?.alert_level || v.defaultLevel;
      const isAwas = level.includes('AWAS');
      const isSiaga = level.includes('SIAGA');
      const isWaspada = level.includes('WASPADA');
      const isSelected = selectedVolcano && (
        selectedVolcano.toLowerCase().includes(v.name.toLowerCase()) ||
        v.name.toLowerCase().includes(selectedVolcano.toLowerCase())
      );

      const markerColor = isAwas ? '#ff2a5f' : isSiaga ? '#ff5722' : isWaspada ? '#ff9800' : '#00f2ff';
      const badgeBg = isAwas ? 'rgba(255, 42, 95, 0.95)' : isSiaga ? 'rgba(255, 87, 34, 0.95)' : isWaspada ? 'rgba(255, 152, 0, 0.95)' : 'rgba(0, 242, 255, 0.85)';

      const volcanoIcon = L.divIcon({
        className: 'volcano-map-marker',
        html: `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${isSelected ? '36px' : '28px'};
            height: ${isSelected ? '36px' : '28px'};
            border-radius: 50%;
            background: rgba(10, 14, 26, 0.9);
            border: 2px solid ${markerColor};
            box-shadow: 0 0 ${isSelected ? '22px' : '10px'} ${markerColor};
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            <span style="font-size: ${isSelected ? '18px' : '14px'}; line-height: 1;">🌋</span>
            ${(isAwas || isSiaga || isSelected) ? `
              <span style="
                position: absolute;
                inset: -6px;
                border-radius: 50%;
                border: 2px solid ${markerColor};
                animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
                pointer-events: none;
              "></span>
            ` : ''}
            <span style="
              position: absolute;
              bottom: -18px;
              white-space: nowrap;
              background: ${badgeBg};
              color: white;
              font-family: Inter, sans-serif;
              font-size: 9px;
              font-weight: 800;
              padding: 1px 6px;
              border-radius: 4px;
              letter-spacing: 0.02em;
              box-shadow: 0 2px 6px rgba(0,0,0,0.8);
            ">
              ${v.name}
            </span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker(v.pos, { icon: volcanoIcon, zIndexOffset: isSelected ? 900 : isAwas ? 800 : 500 });

      const popupContent = document.createElement('div');
      popupContent.style.fontFamily = 'Inter, sans-serif';
      popupContent.style.padding = '8px';
      popupContent.style.color = '#0f172a';
      popupContent.style.minWidth = '240px';

      popupContent.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <strong style="font-size: 13px; color: #0f172a;">🌋 G. ${v.name}</strong>
          <span style="background: ${markerColor}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px;">
            ${level}
          </span>
        </div>
        <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
          Wilayah: <strong>${v.province}</strong> • Elevasi: <strong>${v.elevation} mdpl</strong>
        </div>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
          Pos PGA: ${v.pgaStation}<br/>
          Sensor: ${v.sensorType}
        </div>
        ${report ? `
          <div style="background: rgba(255, 87, 34, 0.08); border-left: 3px solid #ff5722; padding: 6px; border-radius: 3px; font-size: 11px; margin-bottom: 10px;">
            <strong>Laporan PVMBG Terakhir:</strong><br/>
            Amplitudo: <strong style="color: #ff2a5f;">${report.amplitude}</strong> • Durasi: <strong>${report.duration}</strong><br/>
            <span style="color: #64748b; font-size: 10px;">⏱ ${report.time} (${report.date})</span>
          </div>
        ` : ''}
        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
          <button id="btn-volcano-seismo-${v.name.replace(/\s+/g, '-')}" style="
            background: #0284c7;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 6px 10px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            text-align: center;
          ">
            📊 Tampilkan di Seismograf
          </button>
          ${report ? `
            <button id="btn-volcano-inspect-${v.name.replace(/\s+/g, '-')}" style="
              background: rgba(168, 85, 247, 0.15);
              color: #7c3aed;
              border: 1px solid #7c3aed;
              border-radius: 4px;
              padding: 5px 10px;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
              text-align: center;
            ">
              🔬 Analisis Citra Seismograf
            </button>
          ` : ''}
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btnSeismo = document.getElementById(`btn-volcano-seismo-${v.name.replace(/\s+/g, '-')}`);
        if (btnSeismo) {
          btnSeismo.onclick = () => {
            onSelectVolcano?.(v.name);
            const el = document.getElementById('seismograph-container') || document.getElementById('section-operasional');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          };
        }

        const btnInspect = document.getElementById(`btn-volcano-inspect-${v.name.replace(/\s+/g, '-')}`);
        if (btnInspect && report) {
          btnInspect.onclick = () => {
            onInspectVolcanoSeismogram?.(report);
          };
        }
      });

      marker.on('click', () => {
        onSelectVolcano?.(v.name);
      });

      marker.addTo(layer);
    });
  }, [volcanoes, selectedVolcano, activeLayer.volcanoes, onSelectVolcano, onInspectVolcanoSeismogram]);

  // 3.1 Plot Volcanic Ash Trajectory Dispersion Fan during Simulation
  useEffect(() => {
    const map = mapRef.current;
    const layer = ashLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (!activeLayer.ash) return;

    // Show ash plume if simulation is active OR if an active volcano is selected
    const shouldShowAsh = isSimulasi || Boolean(tsunamiActive && tsunamiScenario?.active) || Boolean(selectedVolcano && selectedVolcano !== 'BMKG_REGIONAL');
    if (!shouldShowAsh) return;

    const targetName = (selectedVolcano && selectedVolcano !== 'BMKG_REGIONAL') ? selectedVolcano : 'Anak Krakatau';
    const geo = findVolcanoLocation(targetName);
    if (!geo) return;

    const ash = getVolcanicAshTrajectory(targetName);
    const [lat0, lon0] = geo.pos;

    // Calculate fan polygon vertices
    // Wind azimuth in degrees (0 = N, 90 = E, 180 = S, 270 = W)
    const centerAngle = ash.windDirectionDeg;
    const spread = ash.coneSpreadDeg || 45;
    const halfSpread = spread / 2;
    const radiusKm = ash.hazardRadiusKm || 35;
    const radiusDegLat = radiusKm / 111; // 1 deg lat ~ 111 km
    const cosLat = Math.max(0.2, Math.cos((lat0 * Math.PI) / 180));

    const outerVertices: [number, number][] = [];
    outerVertices.push([lat0, lon0]);

    // Outer boundary arc points
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const angleDeg = (centerAngle - halfSpread) + (spread * (i / steps));
      const rad = (angleDeg * Math.PI) / 180;
      const dLat = radiusDegLat * Math.cos(rad);
      const dLon = (radiusDegLat * Math.sin(rad)) / cosLat;
      outerVertices.push([lat0 + dLat, lon0 + dLon]);
    }
    outerVertices.push([lat0, lon0]);

    // Inner danger core zone (12 km)
    const innerRadiusKm = Math.min(12, radiusKm * 0.45);
    const innerRadiusDeg = innerRadiusKm / 111;
    const innerVertices: [number, number][] = [];
    innerVertices.push([lat0, lon0]);
    for (let i = 0; i <= steps; i++) {
      const angleDeg = (centerAngle - halfSpread * 0.8) + (spread * 0.8 * (i / steps));
      const rad = (angleDeg * Math.PI) / 180;
      const dLat = innerRadiusDeg * Math.cos(rad);
      const dLon = (innerRadiusDeg * Math.sin(rad)) / cosLat;
      innerVertices.push([lat0 + dLat, lon0 + dLon]);
    }
    innerVertices.push([lat0, lon0]);

    // Outer dispersion polygon (Amber / Orange ash cloud)
    const ashPolygon = L.polygon(outerVertices, {
      color: '#ea580c',
      weight: 2,
      opacity: 0.85,
      dashArray: '6, 4',
      fillColor: '#f97316',
      fillOpacity: 0.32,
    }).addTo(layer);

    // Inner core danger polygon (Dark Crimson ash surge)
    const innerPolygon = L.polygon(innerVertices, {
      color: '#dc2626',
      weight: 2,
      opacity: 0.9,
      fillColor: '#b91c1c',
      fillOpacity: 0.55,
    }).addTo(layer);

    // Lingkaran Zona Merah Bahaya Letusan Kawah (Radius 5 km KRB III)
    const volcanoRedCircle = L.circle([lat0, lon0], {
      radius: 5000,
      color: '#ef4444',
      weight: 2.5,
      dashArray: '5, 5',
      fillColor: '#ef4444',
      fillOpacity: 0.38,
    }).addTo(layer);

    volcanoRedCircle.bindPopup(`
      <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a; min-width: 230px;">
        <div style="background: #ef4444; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 11px; margin-bottom: 6px; display: inline-block;">
          ⚠️ ZONA MERAH LINGKARAN BAHAYA KAWAH (RADIUS 5 KM)
        </div><br/>
        <strong style="font-size: 13px; color: #0f172a;">Gunung ${geo.name}</strong><br/>
        <div style="margin: 6px 0; font-size: 11px; line-height: 1.5; color: #334155;">
          🚫 <strong>Status:</strong> Kawasan Rawan Bencana (KRB III). Radius 5 km steril dari pemukiman.<br/>
          💨 <strong>Arah Sebaran Abu:</strong> Menyebar ke sektor ${ash.windDirectionCardinal} (${ash.windDirectionDeg}°) mengikuti arah angin.
        </div>
      </div>
    `);

    // Popup for the ash dispersion cloud
    const ashPopup = `
      <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a; min-width: 260px;">
        <div style="background: #ea580c; color: white; padding: 4px 8px; border-radius: 4px; font-weight: 800; font-size: 11px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span>💨 SEBARAN ABU VULKANIK</span>
          <span style="background: ${ash.vonaColorCode === 'RED' ? '#b91c1c' : '#c2410c'}; padding: 1px 5px; border-radius: 3px; font-size: 9px;">VONA ${ash.vonaColorCode}</span>
        </div>
        <strong style="font-size: 13px; color: #0f172a;">Gunung ${geo.name}</strong><br/>
        <div style="margin: 6px 0; font-size: 11px; line-height: 1.6; color: #334155;">
          🧭 <strong>Arah Abu:</strong> ${ash.windDirectionCardinal} (${ash.windDirectionDeg}°)<br/>
          ⏱️ <strong>Perkiraan Durasi Erupsi:</strong> ${ash.eruptionDurationEst}<br/>
          ⏳ <strong>Perkiraan Durasi Sebaran:</strong> ${ash.ashDispersionDurationEst}<br/>
          💨 <strong>Kecepatan Angin:</strong> ${ash.windSpeedKts} knot (~${Math.round(ash.windSpeedKts * 1.852)} km/j)<br/>
          ⬆️ <strong>Tinggi Kolom:</strong> ±${ash.plumeHeightMeters.toLocaleString('id-ID')} m dpl<br/>
          ⚠️ <strong>Radius Bahaya:</strong> ${ash.hazardRadiusKm} km (Sektor ${ash.windDirectionCardinal})<br/>
          🕒 <strong>Jendela Siaga:</strong> ${ash.totalHazardWindow}<br/>
          ✈️ <strong>Koridor ATS:</strong> ${ash.affectedAviationRoute}<br/>
          📍 <strong>Sektor Terdampak:</strong> ${ash.sectorNotice}
        </div>
      </div>
    `;
    ashPolygon.bindPopup(ashPopup);
    innerPolygon.bindPopup(ashPopup);

    // Centerline wind vector arrows along trajectory
    const centerRad = (centerAngle * Math.PI) / 180;
    const arrowDistances = [radiusKm * 0.45, radiusKm * 0.85];
    arrowDistances.forEach((dKm, idx) => {
      const dDeg = dKm / 111;
      const arrowLat = lat0 + dDeg * Math.cos(centerRad);
      const arrowLon = lon0 + (dDeg * Math.sin(centerRad)) / cosLat;

      const arrowIcon = L.divIcon({
        className: 'ash-wind-arrow',
        html: `
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            background: rgba(15, 23, 42, 0.90);
            border: 1px solid #f97316;
            padding: 3px 8px;
            border-radius: 4px;
            color: #fed7aa;
            font-size: 10px;
            font-weight: 800;
            white-space: nowrap;
            box-shadow: 0 0 10px rgba(249, 115, 22, 0.4);
            pointer-events: none;
          ">
            <span>💨 ${idx === 0 ? `${ash.windSpeedKts} kts (${ash.windDirectionCardinal})` : `Durasi: ${ash.ashDispersionDurationEst}`} ➔</span>
          </div>
        `,
        iconSize: [110, 24],
        iconAnchor: [55, 12],
      });

      L.marker([arrowLat, arrowLon], { icon: arrowIcon, zIndexOffset: 700 }).addTo(layer);
    });
  }, [isSimulasi, tsunamiActive, selectedVolcano, activeLayer.ash]);

  // 3.2 Plot Animated Impacted Area (Seismic Waves, Isoseismal MMI Zones & Coastal Tsunami Inundation)
  useEffect(() => {
    const map = mapRef.current;
    const layer = tsunamiImpactLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (!activeLayer.tsunamiImpact) {
      setImpactHudData(null);
      return;
    }

    const isImpactActive =
      isSimulasi ||
      (Boolean(tsunamiActive) && Boolean(tsunamiScenario?.active));

    if (!isImpactActive) {
      setImpactHudData(null);
      return;
    }

    let epicLat = -9.15;
    let epicLon = 109.52;
    let mag = 7.8;
    let depthKm = 15;
    let regionText = 'Java Trench (Cilacap - Pangandaran)';
    let mmiCode = 'VII';
    let tsunamiWave = '4.5m';
    let popExposed = 1842000;
    let infraCount = 37;
    let stageName = activeIncident?.cascading_stage || 'SEISMIC_PROPAGATION';
    let statusText = activeIncident?.status || (isSimulasi ? 'SIMULASI AKTIF' : 'TERDETEKSI');

    if (activeIncident?.latitude && activeIncident?.longitude) {
      epicLat = activeIncident.latitude;
      epicLon = activeIncident.longitude;
      mag = activeIncident.magnitude || 7.8;
      depthKm = activeIncident.depth || 15;
      regionText = activeIncident.region || regionText;
      mmiCode = activeIncident.seismic_intensity || 'VII';
      popExposed = activeIncident.population_exposed || popExposed;
      infraCount = activeIncident.critical_infrastructure || infraCount;
      tsunamiWave = activeIncident.tsunami_risk === 'HIGH' ? '4.5 - 6.0m' : activeIncident.tsunami_risk === 'CRITICAL' ? '8.0m+' : '2.0m';
    }

    setImpactHudData({
      active: true,
      region: regionText,
      epicenter: [epicLat, epicLon],
      magnitude: mag,
      depth: depthKm,
      mmi: mmiCode,
      tsunamiWave,
      population: popExposed,
      infrastructure: infraCount,
      stage: stageName,
      status: statusText,
    });

    // 1. Plot Epicenter Seismic Shockwaves (P-Wave, S-Wave & Rayleigh Wavefronts)
    const shockwaveIcon = L.divIcon({
      className: 'seismic-epicenter-shockwave-icon',
      html: `
        <div class="seismic-epicenter-shockwave">
          <div class="seismic-wave-p" title="Gelombang P (Primer) - Kecepatan rambat ~7.2 km/s"></div>
          <div class="seismic-wave-s" title="Gelombang S (Sekunder/Guncangan Destruktif) - Kecepatan rambat ~4.1 km/s"></div>
          <div class="seismic-wave-surface" title="Gelombang Permukaan (Rayleigh/Love) - Amplitudo Maksimum"></div>
          <div class="seismic-epicenter-core" title="Pusat Episenter Gempa: M${mag.toFixed(1)}">
            M${mag.toFixed(1)}
          </div>
        </div>
      `,
      iconSize: [400, 400],
      iconAnchor: [200, 200],
    });

    L.marker([epicLat, epicLon], { icon: shockwaveIcon, zIndexOffset: 950 })
      .addTo(layer)
      .bindPopup(`
        <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a; min-width: 230px;">
          <div style="background: #dc2626; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 11px; margin-bottom: 6px; display: inline-block;">
            ⚡ EPISENTER GUNCANGAN SEISMIK • M${mag.toFixed(1)}
          </div><br/>
          <strong style="font-size: 13px; color: #0f172a;">${regionText}</strong><br/>
          <span style="font-size: 11px; color: #475569;">Kedalaman: ${depthKm} km • Intensitas: ${mmiCode} MMI</span><br/>
          <div style="margin-top: 6px; font-size: 10.5px; color: #0284c7; line-height: 1.4;">
            🌊 <em>Gelombang seismik P dan S sedang merambat keluar dari pusat patahan secara real-time.</em>
          </div>
        </div>
      `);

    // 2. Plot Isoseismal Ground Shaking Zones (Zonasi Guncangan MMI)
    // Critical Zone (MMI VIII - IX)
    L.circle([epicLat, epicLon], {
      radius: 48000,
      color: '#dc2626',
      weight: 2.5,
      dashArray: '4, 6',
      fillColor: '#991b1b',
      fillOpacity: 0.32,
      className: 'leaflet-isoseismal-zone-critical',
    })
      .addTo(layer)
      .bindPopup(`
        <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a; min-width: 230px;">
          <div style="background: #dc2626; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 11px; margin-bottom: 4px; display: inline-block;">
            🔴 ZONA GUNCANGAN DESTRUKTIF (MMI VIII - IX)
          </div><br/>
          <strong>Radius: ±48 km dari Episenter</strong><br/>
          <div style="font-size: 11px; color: #334155; margin-top: 4px; line-height: 1.4;">
            ⚠️ <strong>Dampak:</strong> Kerusakan berat pada bangunan struktural, fondasi retak parah, dan potensi likuifaksi tanah.<br/>
            📊 <strong>Perkiraan PGA:</strong> 0.55g - 0.85g
          </div>
        </div>
      `);

    // Strong Zone (MMI VII)
    L.circle([epicLat, epicLon], {
      radius: 125000,
      color: '#ea580c',
      weight: 2,
      dashArray: '6, 8',
      fillColor: '#ea580c',
      fillOpacity: 0.18,
      className: 'leaflet-isoseismal-zone-strong',
    })
      .addTo(layer)
      .bindPopup(`
        <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a; min-width: 230px;">
          <div style="background: #ea580c; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 11px; margin-bottom: 4px; display: inline-block;">
            🟠 ZONA GUNCANGAN KUAT (MMI VII)
          </div><br/>
          <strong>Radius: ±125 km dari Episenter</strong><br/>
          <div style="font-size: 11px; color: #334155; margin-top: 4px; line-height: 1.4;">
            ⚠️ <strong>Dampak:</strong> Dinding retak, perabot rumah berjatuhan, cerobong patah.<br/>
            📊 <strong>Perkiraan PGA:</strong> 0.25g - 0.45g
          </div>
        </div>
      `);

    // Felt Zone (MMI V - VI)
    L.circle([epicLat, epicLon], {
      radius: 260000,
      color: '#eab308',
      weight: 1.5,
      dashArray: '8, 10',
      fillColor: '#ca8a04',
      fillOpacity: 0.08,
    })
      .addTo(layer)
      .bindPopup(`
        <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a; min-width: 230px;">
          <div style="background: #ca8a04; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 11px; margin-bottom: 4px; display: inline-block;">
            🟡 ZONA GUNCANGAN TERASA (MMI V - VI)
          </div><br/>
          <strong>Radius: ±260 km dari Episenter</strong><br/>
          <div style="font-size: 11px; color: #334155; margin-top: 4px; line-height: 1.4;">
            ℹ️ <strong>Dampak:</strong> Dirasakan oleh hampir semua orang, jendela bergetar, guncangan nyata.<br/>
            📊 <strong>Perkiraan PGA:</strong> 0.08g - 0.20g
          </div>
        </div>
      `);

    // 3. Tsunami Wavefront Arcs (Rambatan Gelombang Tsunami ke Arah Pesisir)
    const waveArcIcon = L.divIcon({
      className: 'tsunami-wavefront-arc-wrapper',
      html: `
        <div class="tsunami-wavefront-arc">
          <div class="tsunami-crest-ripple-1"></div>
          <div class="tsunami-crest-ripple-2"></div>
          <div class="tsunami-crest-ripple-3"></div>
        </div>
      `,
      iconSize: [160, 160],
      iconAnchor: [80, 80],
    });

    // Offshore wave propagation position midway towards land
    const midOffshoreLat = epicLat * 0.7 + (-7.6) * 0.3;
    const midOffshoreLon = epicLon * 0.7 + (108.6) * 0.3;
    L.marker([midOffshoreLat, midOffshoreLon], { icon: waveArcIcon, zIndexOffset: 920 }).addTo(layer);

    // A. Tsunami Coastal Impact Sectors (Lingkaran Zona Merah & Bahaya Pesisir)
    const hasDynamicZones = Boolean(
      tsunamiScenario?.affected_zone_details && tsunamiScenario.affected_zone_details.length > 0
    );

    if (hasDynamicZones && tsunamiScenario?.affected_zone_details) {
      tsunamiScenario.affected_zone_details.forEach((sec) => {
        const isAwas = sec.status === 'AWAS';
        const isSiaga = sec.status === 'SIAGA';
        const color = isAwas ? '#ef4444' : isSiaga ? '#f97316' : '#eab308';
        const radius = isAwas ? 25000 : isSiaga ? 18000 : 14000;

        // Calculate center coordinate (coords or polygon centroid)
        const center: [number, number] = sec.coords
          ? sec.coords
          : (sec.polygon && sec.polygon.length > 0)
          ? [
              sec.polygon.reduce((sum, pt) => sum + pt[0], 0) / sec.polygon.length,
              sec.polygon.reduce((sum, pt) => sum + pt[1], 0) / sec.polygon.length,
            ]
          : [-6.5, 105.5];

        const popupHtml = `
          <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a; min-width: 240px;">
            <div style="background: ${color}; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 11px; margin-bottom: 6px; display: inline-block;">
              ${isAwas ? '🔴 ZONA MERAH LINGKARAN BAHAYA TSUNAMI (AWAS)' : `ZONA LINGKARAN BAHAYA TSUNAMI (${sec.status})`}
            </div><br/>
            <strong style="font-size: 13px; color: #0f172a;">${sec.zone}</strong><br/>
            <span style="font-size: 10.5px; color: #64748b;">Provinsi: ${sec.province} • Radius: ±${Math.round(radius / 1000)} km</span>
            <div style="margin: 6px 0; font-size: 11px; line-height: 1.5; color: #334155;">
              ⏱ <strong>Estimasi Tiba (ETA):</strong> ${sec.estimated_eta}<br/>
              🌊 <strong>Tinggi Gelombang:</strong> ${sec.estimated_wave_height}<br/>
              🌊 <strong>Limpasan Darat:</strong> ${sec.inundation_depth}<br/>
              👥 <strong>Populasi Berisiko:</strong> ${sec.population_at_risk}<br/>
              🏔️ <strong>Elevasi Aman:</strong> <span style="color: #059669; font-weight: 700;">${sec.safe_elevation}</span>
            </div>
          </div>
        `;

        // Every red and warning hazard zone is strictly a CIRCLE
        L.circle(center, {
          radius,
          color,
          weight: isAwas ? 2.5 : 2,
          dashArray: '6, 6',
          fillColor: color,
          fillOpacity: isAwas ? 0.35 : 0.25,
        })
          .addTo(layer)
          .bindPopup(popupHtml);

        // For AWAS (Zona Merah), draw an inner critical danger ring
        if (isAwas) {
          L.circle(center, {
            radius: Math.round(radius * 0.45),
            color: '#dc2626',
            weight: 1.5,
            fillColor: '#991b1b',
            fillOpacity: 0.48,
          })
            .addTo(layer)
            .bindPopup(popupHtml);
        }

        const beaconIcon = L.divIcon({
          className: 'coastal-beacon-wrapper',
          html: `
            <div class="coastal-hazard-beacon">
              <div class="coastal-beacon-ring ${isAwas ? '' : 'coastal-beacon-ring--siaga'}"></div>
              <div class="coastal-beacon-pin ${isAwas ? '' : 'coastal-beacon-pin--siaga'}">
                🚨
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        L.marker(center, { icon: beaconIcon, zIndexOffset: 980 })
          .addTo(layer)
          .bindPopup(popupHtml);
      });
    } else {
      // Static fallback simulation sectors (Lingkaran Zona Merah Selat Sunda & Jawa)
      const IMPACT_COASTAL_SECTORS = [
        {
          name: 'Pesisir Pandeglang & Ujung Kulon',
          status: 'AWAS',
          eta: '18 Menit',
          waveHeight: '4.2 - 5.5m',
          color: '#ef4444',
          center: [-6.85, 105.45] as [number, number],
          radius: 25000,
        },
        {
          name: 'Kalianda & Pesisir Lampung Selatan',
          status: 'AWAS',
          eta: '22 Menit',
          waveHeight: '3.5 - 4.8m',
          color: '#ef4444',
          center: [-5.75, 105.58] as [number, number],
          radius: 22000,
        },
        {
          name: 'Pesisir Anyer & Carita',
          status: 'SIAGA',
          eta: '27 Menit',
          waveHeight: '2.8 - 3.6m',
          color: '#f97316',
          center: [-6.20, 105.82] as [number, number],
          radius: 18000,
        },
        {
          name: 'Teluk Semangka & Tanggamus',
          status: 'SIAGA',
          eta: '31 Menit',
          waveHeight: '2.2 - 3.1m',
          color: '#f97316',
          center: [-5.55, 104.70] as [number, number],
          radius: 18000,
        },
        {
          name: 'Pesisir Cilacap & Teluk Penyu',
          status: 'WASPADA',
          eta: '46 Menit',
          waveHeight: '1.2 - 2.0m',
          color: '#eab308',
          center: [-7.74, 109.02] as [number, number],
          radius: 14000,
        },
      ];

      IMPACT_COASTAL_SECTORS.forEach((sec) => {
        const isAwas = sec.status === 'AWAS';
        const popupHtml = `
          <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a; min-width: 230px;">
            <div style="background: ${sec.color}; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 11px; margin-bottom: 6px; display: inline-block;">
              ${isAwas ? '🔴 ZONA MERAH LINGKARAN BAHAYA TSUNAMI (AWAS)' : `ZONA LINGKARAN BAHAYA TSUNAMI (${sec.status})`}
            </div><br/>
            <strong style="font-size: 13px; color: #0f172a;">${sec.name}</strong><br/>
            <div style="margin: 6px 0; font-size: 11px; line-height: 1.5; color: #334155;">
              ⏱ <strong>Estimasi Tiba (ETA):</strong> ${sec.eta}<br/>
              🌊 <strong>Perkiraan Tinggi Gelombang:</strong> ${sec.waveHeight}<br/>
              ⚠️ <strong>Radius Bahaya:</strong> ±${Math.round(sec.radius / 1000)} km Lingkaran Pesisir<br/>
              🚨 <strong>SOP Evakuasi:</strong> Segera evakuasi ke ketinggian >20 meter dpl
            </div>
          </div>
        `;

        L.circle(sec.center, {
          radius: sec.radius,
          color: sec.color,
          weight: isAwas ? 2.5 : 2,
          dashArray: '6, 6',
          fillColor: sec.color,
          fillOpacity: isAwas ? 0.35 : 0.25,
        })
          .addTo(layer)
          .bindPopup(popupHtml);

        if (isAwas) {
          L.circle(sec.center, {
            radius: Math.round(sec.radius * 0.45),
            color: '#dc2626',
            weight: 1.5,
            fillColor: '#991b1b',
            fillOpacity: 0.48,
          })
            .addTo(layer)
            .bindPopup(popupHtml);
        }

        const beaconIcon = L.divIcon({
          className: 'coastal-beacon-wrapper',
          html: `
            <div class="coastal-hazard-beacon">
              <div class="coastal-beacon-ring ${isAwas ? '' : 'coastal-beacon-ring--siaga'}"></div>
              <div class="coastal-beacon-pin ${isAwas ? '' : 'coastal-beacon-pin--siaga'}">
                🚨
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        L.marker(sec.center, { icon: beaconIcon, zIndexOffset: 980 })
          .addTo(layer)
          .bindPopup(popupHtml);
      });
    }

    // B. Critical Infrastructure Damage Markers
    const hasDynamicInfra = Boolean(
      tsunamiScenario?.infrastructure_impacts && tsunamiScenario.infrastructure_impacts.length > 0
    );

    if (hasDynamicInfra && tsunamiScenario?.infrastructure_impacts) {
      tsunamiScenario.infrastructure_impacts.forEach((inf) => {
        if (!inf.coords) return;
        const color = inf.damage_level === 'HEAVY' ? '#ef4444' : inf.damage_level === 'MODERATE' ? '#f97316' : '#eab308';
        const icon = inf.icon || '🏗️';
        const damageText = inf.damage_level === 'HEAVY' ? 'RUSAK BERAT' : inf.damage_level === 'MODERATE' ? 'RUSAK SEDANG' : 'RUSAK RINGAN';

        const infraIcon = L.divIcon({
          className: 'infra-damage-marker',
          html: `
            <div style="
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 30px;
              height: 30px;
              border-radius: 6px;
              background: rgba(15, 23, 42, 0.95);
              border: 2px solid ${color};
              box-shadow: 0 0 12px ${color};
              font-size: 14px;
              cursor: pointer;
            ">
              <span>${icon}</span>
              <span style="
                position: absolute;
                top: -6px;
                right: -6px;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: ${color};
                border: 1px solid #fff;
                font-size: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-weight: 800;
              ">!</span>
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        L.marker(inf.coords, { icon: infraIcon, zIndexOffset: 850 })
          .addTo(layer)
          .bindPopup(`
            <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a; min-width: 240px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <strong style="font-size: 13px; color: #0f172a;">${icon} ${inf.facility}</strong>
                <span style="background: ${color}; color: white; padding: 2px 6px; border-radius: 3px; font-weight: 800; font-size: 9px;">
                  ${damageText}
                </span>
              </div>
              <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
                Kategori: <strong>${inf.type}</strong> • 📍 ${inf.location}
              </div>
              <div style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid ${color}; padding: 6px; border-radius: 3px; font-size: 10.5px; margin-bottom: 6px;">
                <strong>Estimasi Dampak:</strong><br/>
                ${inf.loss_estimate}
              </div>
              <div style="font-size: 10.5px; color: #dc2626; margin-bottom: 3px;">
                🛑 <strong>Operasional:</strong> ${inf.operational_status}
              </div>
              <div style="font-size: 10.5px; color: #0369a1;">
                🛠️ <strong>Tindakan Darurat:</strong> ${inf.critical_action}
              </div>
            </div>
          `);
      });
    } else {
      const INFRASTRUCTURE_TARGETS = [
        {
          name: 'Pelabuhan Merak - Bakauheni',
          type: 'Pelabuhan Utama',
          pos: [-5.93, 105.99] as [number, number],
          damage: 'RUSAK BERAT',
          detail: 'Dermaga feri tergenang 2.5m, operasional ditutup total.',
          action: 'Evakuasi kapal feri ke laut dalam (>200m).',
          color: '#ef4444',
          icon: '🚢',
        },
        {
          name: 'PLTU Suralaya & Labuan',
          type: 'Pembangkit Listrik',
          pos: [-5.89, 106.03] as [number, number],
          damage: 'RUSAK SEDANG',
          detail: 'Intake air laut pendingin tersumbat puing banjir laut.',
          action: 'Safe shutdown darurat & isolasi sistem transmisi.',
          color: '#f97316',
          icon: '⚡',
        },
        {
          name: 'Jalan Raya Lintas Anyer - Carita',
          type: 'Akses Jalur Evakuasi',
          pos: [-6.15, 105.86] as [number, number],
          damage: 'RUSAK BERAT',
          detail: 'Terputus akibat genangan tsunami 1.8m & puing kayu.',
          action: 'Gunakan jalur alternatif pedalaman Menes-Mandalawangi.',
          color: '#ef4444',
          icon: '🛣️',
        },
        {
          name: 'BTS Pesisir Kalianda & Labuan',
          type: 'Menara Telekomunikasi',
          pos: [-5.73, 105.59] as [number, number],
          damage: 'RUSAK SEDANG',
          detail: '34 BTS pesisir padam listrik cadangan baterai.',
          action: 'Aktivasi transmisi radio satelit BNPB & VHF darurat.',
          color: '#f97316',
          icon: '📡',
        },
      ];

      INFRASTRUCTURE_TARGETS.forEach((inf) => {
        const infraIcon = L.divIcon({
          className: 'infra-damage-marker',
          html: `
            <div style="
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 30px;
              height: 30px;
              border-radius: 6px;
              background: rgba(15, 23, 42, 0.95);
              border: 2px solid ${inf.color};
              box-shadow: 0 0 12px ${inf.color};
              font-size: 14px;
              cursor: pointer;
            ">
              <span>${inf.icon}</span>
              <span style="
                position: absolute;
                top: -6px;
                right: -6px;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: ${inf.color};
                border: 1px solid #fff;
                font-size: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-weight: 800;
              ">!</span>
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        L.marker(inf.pos, { icon: infraIcon, zIndexOffset: 850 })
          .addTo(layer)
          .bindPopup(`
            <div style="font-family: Inter, sans-serif; padding: 6px; color: #0f172a; min-width: 240px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <strong style="font-size: 13px; color: #0f172a;">${inf.icon} ${inf.name}</strong>
                <span style="background: ${inf.color}; color: white; padding: 2px 6px; border-radius: 3px; font-weight: 800; font-size: 9px;">
                  ${inf.damage}
                </span>
              </div>
              <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
                Kategori: <strong>${inf.type}</strong>
              </div>
              <div style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid ${inf.color}; padding: 6px; border-radius: 3px; font-size: 10.5px; margin-bottom: 6px;">
                <strong>Estimasi Kerusakan:</strong><br/>
                ${inf.detail}
              </div>
              <div style="font-size: 10.5px; color: #0369a1;">
                🛠️ <strong>Tindakan Darurat:</strong> ${inf.action}
              </div>
            </div>
          `);
      });
    }
  }, [isSimulasi, tsunamiActive, tsunamiScenario, activeIncident, activeLayer.tsunamiImpact]);

  // 3.3 Auto flyTo camera to incident epicenter on escalation (simulation only)
  useEffect(() => {
    if (!mapRef.current) return;
    if (
      isSimulasi &&
      activeIncident?.latitude &&
      activeIncident?.longitude &&
      (activeIncident.status === 'ESCALATING' ||
        activeIncident.status === 'CRITICAL' ||
        activeIncident.status === 'CONFIRMING')
    ) {
      mapRef.current.flyTo([activeIncident.latitude, activeIncident.longitude], 7, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [isSimulasi, activeIncident?.incident_id, activeIncident?.status, activeIncident?.latitude, activeIncident?.longitude]);

  // 3.4 Explicit Reset Handler when exiting simulation mode
  const prevSimulasiRef = useRef(isSimulasi);
  useEffect(() => {
    if (prevSimulasiRef.current && !isSimulasi) {
      // User just exited simulation mode -> forcefully wipe out simulation layers
      tsunamiImpactLayerRef.current?.clearLayers();
      ashLayerRef.current?.clearLayers();
      setImpactHudData(null);

      if (mapRef.current) {
        if (focusCoords) {
          mapRef.current.flyTo([focusCoords.lat, focusCoords.lon], 7, { animate: true, duration: 1.2 });
        } else {
          mapRef.current.flyTo([-2.5, 118.0], 5, { animate: true, duration: 1.2 });
        }
      }
    }
    prevSimulasiRef.current = isSimulasi;
  }, [isSimulasi, focusCoords]);

  // 4. Handle volcano selection camera flyTo
  useEffect(() => {
    if (!mapRef.current || !selectedVolcano) return;
    const geo = findVolcanoLocation(selectedVolcano);
    if (geo) {
      mapRef.current.flyTo(geo.pos, 8, {
        animate: true,
        duration: 1.2,
      });
    }
  }, [selectedVolcano]);

  // 5. Handle external focus request (from LatestQuakeCard)
  useEffect(() => {
    if (!mapRef.current || !focusCoords) return;
    mapRef.current.flyTo([focusCoords.lat, focusCoords.lon], 9, {
      animate: true,
      duration: 1.5,
    });
  }, [focusCoords]);

  // Reset camera to Indonesia overview
  const handleResetOverview = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([-2.5, 118.0], 5, { animate: true, duration: 1.2 });
  };

  return (
    <div className="map-container" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Floating Tactical Map Controls */}
      <div className="map-floating-controls" style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ background: 'rgba(6, 10, 20, 0.75)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 10px', fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
          {mouseCoords}
        </div>
        <button
          className="map-floating-btn"
          onClick={handleResetOverview}
          title="Kembalikan fokus kamera ke seluruh wilayah kepulauan Indonesia"
        >
          <span className="map-floating-btn__icon">⟲</span>
          <span>Reset Posisi Peta</span>
        </button>
      </div>

      {/* Leaflet DOM container */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '440px',
          position: 'relative',
          zIndex: 1,
        }}
      />

      {/* Tactical Impact Radar HUD Overlay */}
      {impactHudData && impactHudData.active && (
        <div className={`impact-radar-hud ${isHudCollapsed ? 'impact-radar-hud--collapsed' : ''}`}>
          <div className="impact-radar-hud__header">
            <span className="impact-radar-hud__title">
              🌋 RADAR WILAYAH TERDAMPAK
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="impact-radar-hud__badge">
                {impactHudData.status}
              </span>
              <button
                type="button"
                className="hud-collapse-toggle-btn"
                onClick={() => setIsHudCollapsed(!isHudCollapsed)}
                title={isHudCollapsed ? 'Perbesar panel HUD' : 'Kecilkan panel HUD'}
              >
                {isHudCollapsed ? '▢ Perbesar' : '— Kecilkan'}
              </button>
            </div>
          </div>

          {!isHudCollapsed ? (
            <>
              <div className="impact-radar-hud__region">{impactHudData.region}</div>
              <div className="impact-radar-hud__coords">
                EPISENTER: {impactHudData.epicenter[0].toFixed(2)}°S, {impactHudData.epicenter[1].toFixed(2)}°E • M{impactHudData.magnitude.toFixed(1)} • {impactHudData.depth.toFixed(0)} km • {impactHudData.mmi} MMI
              </div>
              <div className="impact-radar-hud__stage">
                ⚡ FASE DAMPAK: {impactHudData.stage.replace(/_/g, ' ')}
              </div>
              <div className="impact-radar-hud__grid">
                <div className="impact-radar-hud__metric">
                  <div className="impact-radar-hud__metric-label">Radius Guncangan</div>
                  <div className="impact-radar-hud__metric-val impact-radar-hud__metric-val--warning">
                    ±260 km
                  </div>
                </div>
                <div className="impact-radar-hud__metric">
                  <div className="impact-radar-hud__metric-label">Gelombang Tsunami</div>
                  <div className="impact-radar-hud__metric-val impact-radar-hud__metric-val--critical">
                    {impactHudData.tsunamiWave}
                  </div>
                </div>
                <div className="impact-radar-hud__metric">
                  <div className="impact-radar-hud__metric-label">Populasi Terpapar</div>
                  <div className="impact-radar-hud__metric-val">
                    {(impactHudData.population / 1000000).toFixed(2)}M Jiwa
                  </div>
                </div>
                <div className="impact-radar-hud__metric">
                  <div className="impact-radar-hud__metric-label">Infrastruktur Rusak</div>
                  <div className="impact-radar-hud__metric-val impact-radar-hud__metric-val--critical">
                    {impactHudData.infrastructure} Titik
                  </div>
                </div>
              </div>

              {/* Quick Camera Presets */}
              <div className="impact-radar-hud__presets">
                <span className="preset-label">KAMERA CEPAT:</span>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => {
                    if (mapRef.current && impactHudData) {
                      mapRef.current.flyTo(impactHudData.epicenter, 7, { animate: true, duration: 1.2 });
                    }
                  }}
                >
                  🎯 Episenter
                </button>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => {
                    if (mapRef.current) {
                      mapRef.current.flyTo([-7.75, 108.9], 8, { animate: true, duration: 1.2 });
                    }
                  }}
                >
                  🌊 Pesisir
                </button>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={handleResetOverview}
                >
                  🇮🇩 Seluruh RI
                </button>
              </div>

              <div className="impact-radar-hud__actions">
                <button
                  type="button"
                  className="impact-radar-hud__btn"
                  onClick={() => {
                    if (mapRef.current && impactHudData) {
                      mapRef.current.flyTo(impactHudData.epicenter, 7, {
                        animate: true,
                        duration: 1.5,
                      });
                    }
                  }}
                  title="Pusatkan peta ke episenter dan wilayah terdampak"
                >
                  🎯 Fokus Wilayah
                </button>
                <button
                  type="button"
                  className="impact-radar-hud__btn impact-radar-hud__btn--secondary"
                  onClick={() => setActiveLayer((p) => ({ ...p, tsunamiImpact: !p.tsunamiImpact }))}
                  title="Toggle tampilan gelombang & lingkaran bahaya"
                >
                  {activeLayer.tsunamiImpact ? '👁️ Sembunyikan' : '👁️ Tampilkan'}
                </button>
              </div>
            </>
          ) : (
            <div className="impact-radar-hud__collapsed-content">
              <span className="collapsed-stat">M{impactHudData.magnitude.toFixed(1)} • {impactHudData.mmi} MMI</span>
              <span className="collapsed-stat collapsed-stat--red">{impactHudData.tsunamiWave}</span>
              <button
                type="button"
                className="collapsed-focus-btn"
                onClick={() => {
                  if (mapRef.current && impactHudData) {
                    mapRef.current.flyTo(impactHudData.epicenter, 7, { animate: true, duration: 1.2 });
                  }
                }}
              >
                🎯 Fokus
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Tactical Legend Overlay with Toggles (INATEWS · SESAR · EPISENTER) */}
      <div className="map-hud-legend">
        <div className="map-hud-legend__header">
          <div className="map-hud-legend__title">
            <span>⚡</span>
            <span>INATEWS · SESAR · EPISENTER</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="map-hud-legend__badge">
              {Object.values(activeLayer).filter(Boolean).length}/8
            </span>
            <button
              type="button"
              onClick={() => {
                const allActive = Object.values(activeLayer).every(Boolean);
                setActiveLayer({
                  sundaMegathrust: !allActive,
                  javaTrench: !allActive,
                  paluKoro: !allActive,
                  volcanoes: !allActive,
                  ash: !allActive,
                  stations: !allActive,
                  buoys: !allActive,
                  tsunamiImpact: !allActive,
                });
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: '10px',
                cursor: 'pointer',
                padding: '0 2px',
                textDecoration: 'underline',
                fontWeight: 600,
              }}
              title="Aktifkan / Sembunyikan Semua Layer"
            >
              {Object.values(activeLayer).every(Boolean) ? 'Reset' : 'Semua'}
            </button>
            <button
              type="button"
              onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'var(--text-secondary)',
                fontSize: '9px',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: '2px 5px',
                lineHeight: 1,
              }}
              title={isLegendCollapsed ? 'Buka Legenda' : 'Ciutkan Legenda'}
            >
              {isLegendCollapsed ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {!isLegendCollapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* 1. Sunda Megathrust (M8.2+) */}
            <div
              className={`map-hud-legend__item ${activeLayer.sundaMegathrust ? 'map-hud-legend__item--active' : 'map-hud-legend__item--inactive'}`}
              onClick={() => setActiveLayer((p) => ({ ...p, sundaMegathrust: !p.sundaMegathrust }))}
              title="Klik untuk menyembunyikan/menampilkan Sunda Megathrust"
            >
              <div className="map-hud-legend__item-left">
                <span className="legend-line" style={{ color: '#ff2a5f' }}></span>
                <span style={{ color: activeLayer.sundaMegathrust ? '#fda4af' : 'var(--text-muted)', fontWeight: activeLayer.sundaMegathrust ? 700 : 500 }}>
                  Sunda Megathrust (M8.2+)
                </span>
              </div>
              <span className="legend-check" style={{ opacity: activeLayer.sundaMegathrust ? 1 : 0 }}>✓</span>
            </div>

            {/* 2. Java Trench (M8.8) */}
            <div
              className={`map-hud-legend__item ${activeLayer.javaTrench ? 'map-hud-legend__item--active' : 'map-hud-legend__item--inactive'}`}
              onClick={() => setActiveLayer((p) => ({ ...p, javaTrench: !p.javaTrench }))}
              title="Klik untuk menyembunyikan/menampilkan Java Trench"
            >
              <div className="map-hud-legend__item-left">
                <span className="legend-line" style={{ color: '#ff5722' }}></span>
                <span style={{ color: activeLayer.javaTrench ? '#fdba74' : 'var(--text-muted)', fontWeight: activeLayer.javaTrench ? 700 : 500 }}>
                  Java Trench (M8.8)
                </span>
              </div>
              <span className="legend-check" style={{ opacity: activeLayer.javaTrench ? 1 : 0 }}>✓</span>
            </div>

            {/* 3. Palu-Koro Fault */}
            <div
              className={`map-hud-legend__item ${activeLayer.paluKoro ? 'map-hud-legend__item--active' : 'map-hud-legend__item--inactive'}`}
              onClick={() => setActiveLayer((p) => ({ ...p, paluKoro: !p.paluKoro }))}
              title="Klik untuk menyembunyikan/menampilkan Palu-Koro Fault"
            >
              <div className="map-hud-legend__item-left">
                <span className="legend-line" style={{ color: '#ffd600' }}></span>
                <span style={{ color: activeLayer.paluKoro ? '#fef08a' : 'var(--text-muted)', fontWeight: activeLayer.paluKoro ? 700 : 500 }}>
                  Palu-Koro Fault
                </span>
              </div>
              <span className="legend-check" style={{ opacity: activeLayer.paluKoro ? 1 : 0 }}>✓</span>
            </div>

            {/* 4. Pos Seismik Gunung Api (PVMBG) */}
            <div
              className={`map-hud-legend__item ${activeLayer.volcanoes ? 'map-hud-legend__item--active' : 'map-hud-legend__item--inactive'}`}
              onClick={() => setActiveLayer((p) => ({ ...p, volcanoes: !p.volcanoes }))}
              title="Klik untuk menyembunyikan/menampilkan Pos Seismik Gunung Api PVMBG"
            >
              <div className="map-hud-legend__item-left">
                <span className="legend-dot" style={{ background: '#ff5722', color: '#ff5722' }}></span>
                <span style={{ color: activeLayer.volcanoes ? '#ffedd5' : 'var(--text-muted)', fontWeight: activeLayer.volcanoes ? 700 : 500 }}>
                  🌋 Pos Seismik Gunung Api (PVMBG)
                </span>
              </div>
              <span className="legend-check" style={{ opacity: activeLayer.volcanoes ? 1 : 0 }}>✓</span>
            </div>

            {/* 5. Sebaran Abu Vulkanik */}
            <div
              className={`map-hud-legend__item ${activeLayer.ash ? 'map-hud-legend__item--active' : 'map-hud-legend__item--inactive'}`}
              onClick={() => setActiveLayer((p) => ({ ...p, ash: !p.ash }))}
              title="Klik untuk menyembunyikan/menampilkan Trajektori Sebaran Abu Vulkanik"
            >
              <div className="map-hud-legend__item-left">
                <span className="legend-dot" style={{ background: '#f97316', color: '#f97316' }}></span>
                <span style={{ color: activeLayer.ash ? '#fed7aa' : 'var(--text-muted)', fontWeight: activeLayer.ash ? 700 : 500 }}>
                  💨 Sebaran Abu Vulkanik (Sesuai Arah Angin) {isSimulasi ? '(Simulasi)' : ''}
                </span>
              </div>
              <span className="legend-check" style={{ opacity: activeLayer.ash ? 1 : 0 }}>✓</span>
            </div>

            {/* 6. BMKG Broadband Station */}
            <div
              className={`map-hud-legend__item ${activeLayer.stations ? 'map-hud-legend__item--active' : 'map-hud-legend__item--inactive'}`}
              onClick={() => setActiveLayer((p) => ({ ...p, stations: !p.stations }))}
              title="Klik untuk menyembunyikan/menampilkan Stasiun Seismik Broadband BMKG"
            >
              <div className="map-hud-legend__item-left">
                <span className="legend-dot" style={{ background: '#00f2ff', color: '#00f2ff' }}></span>
                <span style={{ color: activeLayer.stations ? '#67e8f9' : 'var(--text-muted)', fontWeight: activeLayer.stations ? 700 : 500 }}>
                  📡 BMKG Broadband Station (LEM, JATS, etc.)
                </span>
              </div>
              <span className="legend-check" style={{ opacity: activeLayer.stations ? 1 : 0 }}>✓</span>
            </div>

            {/* 7. InaTEWS / IOC Tide Buoys */}
            <div
              className={`map-hud-legend__item ${activeLayer.buoys ? 'map-hud-legend__item--active' : 'map-hud-legend__item--inactive'}`}
              onClick={() => setActiveLayer((p) => ({ ...p, buoys: !p.buoys }))}
              title="Klik untuk menyembunyikan/menampilkan InaTEWS / IOC Tide Buoys"
            >
              <div className="map-hud-legend__item-left">
                <span className="legend-dot" style={{ background: '#06b6d4', color: '#06b6d4' }}></span>
                <span style={{ color: activeLayer.buoys ? '#7dd3fc' : 'var(--text-muted)', fontWeight: activeLayer.buoys ? 700 : 500 }}>
                  🌊 InaTEWS / IOC Tide Buoys
                </span>
              </div>
              <span className="legend-check" style={{ opacity: activeLayer.buoys ? 1 : 0 }}>✓</span>
            </div>

            {/* 8. Tsunami Impact & Infrastruktur (Simulasi / Riil) */}
            <div
              className={`map-hud-legend__item ${activeLayer.tsunamiImpact ? 'map-hud-legend__item--active' : 'map-hud-legend__item--inactive'}`}
              onClick={() => setActiveLayer((p) => ({ ...p, tsunamiImpact: !p.tsunamiImpact }))}
              title="Klik untuk menyembunyikan/menampilkan Lingkaran Zona Merah Bahaya Tsunami & Kerusakan Infrastruktur"
            >
              <div className="map-hud-legend__item-left">
                <span className="legend-dot" style={{ background: '#ef4444', color: '#ef4444' }}></span>
                <span style={{ color: activeLayer.tsunamiImpact ? '#fca5a5' : 'var(--text-muted)', fontWeight: activeLayer.tsunamiImpact ? 700 : 500 }}>
                  ⭕ Lingkaran Zona Merah & Kerusakan Infra {isSimulasi ? '(Simulasi)' : '(Riil BMKG)'}
                </span>
              </div>
              <span className="legend-check" style={{ opacity: activeLayer.tsunamiImpact ? 1 : 0 }}>✓</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
