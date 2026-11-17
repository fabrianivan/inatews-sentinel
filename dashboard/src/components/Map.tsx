'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronDown, ChevronUp, Layers, RotateCcw } from 'lucide-react';
import type { LifecyclePhase, LiveEvent, RealtimeEarthquakesData, VolcanoEruption } from '@/lib/types';
import {
  INDONESIAN_VOLCANOES,
  buildVolcanoInspectionReport,
  findVolcanoLocation,
  getVolcanoReports,
  getVolcanicAshTrajectory,
} from '@/lib/volcanoData';

/**
 * Hide map labels that collide with a higher-priority label so the map stays legible
 * at national zoom levels. Elements opt in with `data-declutter="<priority>"`.
 */
function declutterMapLabels(container: HTMLElement) {
  // Marker bodies (e.g. volcano circles) are fixed obstacles: never hidden, but labels avoid them.
  const obstacles = Array.from(container.querySelectorAll<HTMLElement>('[data-declutter-fixed]')).map((el) => ({
    el,
    rect: el.getBoundingClientRect(),
  }));
  const items = Array.from(container.querySelectorAll<HTMLElement>('[data-declutter]'));
  items.sort((a, b) => Number(b.dataset.declutter) - Number(a.dataset.declutter));
  const placed: DOMRect[] = [];
  const PAD = 2;
  const hits = (r: DOMRect, p: DOMRect) =>
    r.left < p.right + PAD && r.right > p.left - PAD && r.top < p.bottom + PAD && r.bottom > p.top - PAD;
  for (const el of items) {
    el.style.visibility = '';
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const collides =
      placed.some((p) => hits(r, p)) ||
      obstacles.some((o) => o.rect.width > 0 && !o.el.contains(el) && !el.contains(o.el) && hits(r, o.rect));
    if (collides) el.style.visibility = 'hidden';
    else placed.push(r);
  }
}

export interface DrillScenarioMapData {
  id: string;
  name: string;
  faultZone: string;
  magnitude: number;
  depth: number;
  lat: number;
  lon: number;
  tsunamiHeight: number;
}

interface MapProps {
  activityLevel?: number;
  tsunamiActive?: boolean;
  isSimulasi?: boolean;
  phase?: LifecyclePhase | null;
  events?: LiveEvent[];
  realQuakes?: RealtimeEarthquakesData | null;
  focusCoords?: { lat: number; lon: number } | null;
  volcanoes?: VolcanoEruption[];
  selectedVolcano?: string | null;
  drillScenarioData?: DrillScenarioMapData | null;
  theme?: 'dark' | 'light';
  floatingHud?: boolean;
  className?: string;
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
  isSimulasi = false,
  phase,
  events,
  realQuakes,
  focusCoords,
  volcanoes = [],
  selectedVolcano = null,
  drillScenarioData = null,
  theme = 'dark',
  floatingHud = false,
  className = '',
  onSelectVolcano,
  onInspectVolcanoSeismogram,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const darkBaseLayerRef = useRef<L.Layer | null>(null);
  const lightBaseLayerRef = useRef<L.Layer | null>(null);
  const basemapModeRef = useRef<'tactical' | 'custom'>('tactical');
  const quakeLayerRef = useRef<L.LayerGroup | null>(null);
  const volcanoLayerRef = useRef<L.LayerGroup | null>(null);
  const ashLayerRef = useRef<L.LayerGroup | null>(null);
  const drillLayerRef = useRef<L.LayerGroup | null>(null);
  const waveAnimLayerRef = useRef<L.LayerGroup | null>(null);
  const lastDrillIdRef = useRef<string | null>(null);
  const sundaLayerRef = useRef<L.LayerGroup | null>(null);
  const javaTrenchLayerRef = useRef<L.LayerGroup | null>(null);
  const paluKoroLayerRef = useRef<L.LayerGroup | null>(null);
  const otherFaultsLayerRef = useRef<L.LayerGroup | null>(null);
  const stationLayerRef = useRef<L.LayerGroup | null>(null);
  const buoyLayerRef = useRef<L.LayerGroup | null>(null);
  const latestMarkerRef = useRef<L.Marker | null>(null);
  const [mouseCoords, setMouseCoords] = useState<string>('0.00°S, 118.00°E');
  const [isLegendCollapsed, setIsLegendCollapsed] = useState<boolean>(true);
  const [activeLayer, setActiveLayer] = useState<{
    sundaMegathrust: boolean;
    javaTrench: boolean;
    paluKoro: boolean;
    volcanoes: boolean;
    ash: boolean;
    stations: boolean;
    buoys: boolean;
  }>({
    sundaMegathrust: true,
    javaTrench: true,
    paluKoro: true,
    volcanoes: true,
    ash: true,
    stations: true,
    buoys: true,
  });

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

    // Tactical Theme-Synced Basemaps (ESRI Dark/Light Canvas + Reference Labels — zero API key required)
    const darkMatterLayer = L.layerGroup([
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri, HERE, Garmin · BMKG',
          maxZoom: 16,
        }
      ),
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
        }
      ),
    ]);

    const positronLightLayer = L.layerGroup([
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri, HERE, Garmin · BMKG',
          maxZoom: 16,
        }
      ),
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
        }
      ),
    ]);

    // Standard OpenStreetMap fallback layer
    const osmLayer = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors · BMKG',
        maxZoom: 18,
      }
    );

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

    darkBaseLayerRef.current = darkMatterLayer;
    lightBaseLayerRef.current = positronLightLayer;

    if (theme === 'light') {
      positronLightLayer.addTo(map);
    } else {
      darkMatterLayer.addTo(map);
    }

    const baseMaps = {
      'Peta Gelap Taktis': darkMatterLayer,
      'Peta Terang Operasional': positronLightLayer,
      'OpenStreetMap': osmLayer,
      'Satelit (ESRI)': satelliteLayer,
      'Batimetri Oseanografi': oceanLayer,
    };
    L.control.layers(baseMaps, undefined, { position: 'topleft' }).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);

    map.on('baselayerchange', (ev) => {
      if (ev.name === 'Peta Gelap Taktis' || ev.name === 'Peta Terang Operasional') {
        basemapModeRef.current = 'tactical';
      } else {
        basemapModeRef.current = 'custom';
      }
    });

    // Mouse coordinates tracker
    map.on('mousemove', (e) => {
      const latStr = `${Math.abs(e.latlng.lat).toFixed(2)}°${e.latlng.lat >= 0 ? 'LU' : 'LS'}`;
      const lonStr = `${Math.abs(e.latlng.lng).toFixed(2)}°${e.latlng.lng >= 0 ? 'BT' : 'BB'}`;
      setMouseCoords(`${latStr}, ${lonStr}`);
    });

    // 1. Layer group for Sunda Megathrust (Sumatra Segment)
    sundaLayerRef.current = L.layerGroup().addTo(map);
    const sundaFault = FAULT_SYSTEMS.find((f) => f.id === 'sundaMegathrust');
    if (sundaFault) {
      L.polyline(sundaFault.coords, {
        color: sundaFault.color,
        weight: 3.5,
        opacity: 0.9,
        dashArray: '8, 6',
        className: 'tectonic-fault-flow',
      }).addTo(sundaLayerRef.current).bindPopup(`
        <div style="font-family: Inter, sans-serif; padding: 4px;">
          <strong style="color: ${sundaFault.color}; font-size: 12px;">${sundaFault.name}</strong><br/>
          <span style="font-size: 11px; opacity: 0.8;">${sundaFault.fullName} — Potensi Megathrust M8.2+</span>
        </div>
      `);
    }

    // 2. Layer group for Java Trench (South Java Megathrust)
    javaTrenchLayerRef.current = L.layerGroup().addTo(map);
    const javaFault = FAULT_SYSTEMS.find((f) => f.id === 'javaTrench');
    if (javaFault) {
      L.polyline(javaFault.coords, {
        color: javaFault.color,
        weight: 3.5,
        opacity: 0.9,
        dashArray: '8, 6',
        className: 'tectonic-fault-flow',
      }).addTo(javaTrenchLayerRef.current).bindPopup(`
        <div style="font-family: Inter, sans-serif; padding: 4px;">
          <strong style="color: ${javaFault.color}; font-size: 12px;">${javaFault.name}</strong><br/>
          <span style="font-size: 11px; opacity: 0.8;">${javaFault.fullName} — Potensi Megathrust M8.8</span>
        </div>
      `);
    }

    // 3. Layer group for Palu-Koro Strike-Slip Fault
    paluKoroLayerRef.current = L.layerGroup().addTo(map);
    const paluFault = FAULT_SYSTEMS.find((f) => f.id === 'paluKoro');
    if (paluFault) {
      L.polyline(paluFault.coords, {
        color: paluFault.color,
        weight: 3.5,
        opacity: 0.9,
        dashArray: '8, 6',
        className: 'tectonic-fault-flow',
      }).addTo(paluKoroLayerRef.current).bindPopup(`
        <div style="font-family: Inter, sans-serif; padding: 4px;">
          <strong style="color: ${paluFault.color}; font-size: 12px;">${paluFault.name}</strong><br/>
          <span style="font-size: 11px; opacity: 0.8;">${paluFault.fullName} — Sesar Geser Mendatar Aktif</span>
        </div>
      `);
    }

    // 4. Layer group for Other Regional Faults
    otherFaultsLayerRef.current = L.layerGroup().addTo(map);
    FAULT_SYSTEMS.filter((f) => !['sundaMegathrust', 'javaTrench', 'paluKoro'].includes(f.id)).forEach((fault) => {
      L.polyline(fault.coords, {
        color: fault.color,
        weight: 2.5,
        opacity: 0.75,
        dashArray: '8, 6',
        className: 'tectonic-fault-flow',
      }).addTo(otherFaultsLayerRef.current!).bindPopup(`
        <div style="font-family: Inter, sans-serif; padding: 4px;">
          <strong style="color: ${fault.color}; font-size: 12px;">${fault.name}</strong><br/>
          <span style="font-size: 11px; opacity: 0.8;">Zona Sesar Tektonik Regional Indonesia</span>
        </div>
      `);
    });

    // 5. Layer group for BMKG Seismic Stations
    stationLayerRef.current = L.layerGroup().addTo(map);
    SEISMIC_STATIONS.forEach((st) => {
      const stIcon = L.divIcon({
        className: 'station-marker',
        html: `
          <div data-declutter="40" style="display: flex; align-items: center; gap: 4px; background: var(--surface-1); border: 1px solid var(--accent-border); border-radius: 4px; padding: 2px 6px; color: var(--text-primary); font-family: monospace; font-size: 10px; font-weight: 700; white-space: nowrap;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--sev-normal);"></span>
            ${st.id}
          </div>
        `,
        iconSize: [56, 20],
        iconAnchor: [28, 10],
      });

      L.marker(st.pos, { icon: stIcon })
        .addTo(stationLayerRef.current!)
        .bindPopup(`
          <div style="font-family: Inter, sans-serif; padding: 4px;">
            <strong style="font-size: 12px; color: var(--accent);">Stasiun BMKG: ${st.id}</strong><br/>
            <span style="font-size: 11px; opacity: 0.85;">Lokasi: ${st.name}</span><br/>
            <span style="font-size: 11px; color: var(--sev-normal); font-weight: 600;">Status: ONLINE • 100 Hz Real-Time</span>
          </div>
        `);
    });

    // 6. Layer group for InaTEWS DART Buoys
    buoyLayerRef.current = L.layerGroup().addTo(map);
    TSUNAMI_BUOYS.forEach((buoy) => {
      const buoyIcon = L.divIcon({
        className: 'buoy-marker',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: rgba(34,211,238,0.18); border: 1.8px solid #22d3ee;">
            <span class="buoy-sonar-ring" style="position: absolute; inset: -3px; border-radius: 50%; border: 1.5px solid #22d3ee;"></span>
            <span style="width: 5px; height: 5px; border-radius: 50%; background: #67e8f9; box-shadow: 0 0 8px #22d3ee;"></span>
          </div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      L.marker(buoy.pos, { icon: buoyIcon })
        .addTo(buoyLayerRef.current!)
        .bindPopup(`
          <div style="font-family: Inter, sans-serif; padding: 4px;">
            <strong style="font-size: 12px; color: #0ea5e9;">${buoy.id}</strong><br/>
            <span style="font-size: 11px; opacity: 0.85;">Pelampung Tsunami: ${buoy.name}</span><br/>
            <span style="font-size: 11px; color: var(--sev-normal); font-weight: 600;">Sensor Tekanan Dasar Laut: Nominal</span>
          </div>
        `);
    });

    // Layer group for earthquakes
    quakeLayerRef.current = L.layerGroup().addTo(map);
    // Layer group for volcanoes
    volcanoLayerRef.current = L.layerGroup().addTo(map);
    // Layer group for volcanic ash dispersion simulation
    ashLayerRef.current = L.layerGroup().addTo(map);
    // Layer group for Megathrust drill wavefronts & epicenter
    drillLayerRef.current = L.layerGroup().addTo(map);
    // Layer group for animated tsunami & live seismic wave propagation
    waveAnimLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    const timer = setTimeout(() => map.invalidateSize(), 250);
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    // Re-run label decluttering whenever the view or the set of markers changes
    let declutterFrame = 0;
    const scheduleDeclutter = () => {
      cancelAnimationFrame(declutterFrame);
      declutterFrame = requestAnimationFrame(() => declutterMapLabels(map.getContainer()));
    };
    map.on('zoomend moveend', scheduleDeclutter);
    const markerPaneObserver = new MutationObserver(scheduleDeclutter);
    markerPaneObserver.observe(map.getPane('markerPane')!, { childList: true });
    scheduleDeclutter();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
      markerPaneObserver.disconnect();
      cancelAnimationFrame(declutterFrame);
      map.off('zoomend moveend', scheduleDeclutter);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 1a. Automatically sync Tactical Basemap with Dark/Light theme toggle
  useEffect(() => {
    const map = mapRef.current;
    const darkLayer = darkBaseLayerRef.current;
    const lightLayer = lightBaseLayerRef.current;
    if (!map || !darkLayer || !lightLayer || basemapModeRef.current !== 'tactical') return;

    if (theme === 'light') {
      if (map.hasLayer(darkLayer)) map.removeLayer(darkLayer);
      if (!map.hasLayer(lightLayer)) lightLayer.addTo(map);
    } else {
      if (map.hasLayer(lightLayer)) map.removeLayer(lightLayer);
      if (!map.hasLayer(darkLayer)) darkLayer.addTo(map);
    }
  }, [theme]);

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
          <div style="font-family: Inter, sans-serif; padding: 8px; color: var(--text-primary); min-width: 200px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="background: ${color}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 12px;">
                M${magnitude.toFixed(1)}
              </span>
              <span style="font-size: 10px; color: var(--text-muted); font-weight: 700;">BMKG TEWS</span>
            </div>
            <strong style="font-size: 12px; color: var(--text-primary);">${faultZone}</strong><br/>
            <span style="font-size: 11px; color: var(--text-secondary);">Kedalaman: ${depth} km</span><br/>
            <span style="font-size: 10px; color: var(--text-muted);">Koordinat: ${lat.toFixed(2)}°, ${lon.toFixed(2)}°</span><br/>
            <span style="font-size: 9.5px; color: var(--text-muted);">Waktu: ${new Date(timestamp).toLocaleString('id-ID')} WIB</span>
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
          <div style="font-family: Inter, sans-serif; padding: 6px; color: var(--text-primary);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="background: #0284c7; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11px;">
                M${magnitude.toFixed(1)}
              </span>
              <span style="font-size: 10px; color: var(--text-muted); font-weight: 600;">USGS GEOJSON</span>
            </div>
            <strong style="font-size: 12px; color: var(--text-primary);">${faultZone}</strong><br/>
            <span style="font-size: 11px; color: var(--text-secondary);">Depth: ${depth.toFixed(0)} km</span>
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
            <div data-declutter-fixed style="position: relative; width: 36px; height: 36px;">
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
          <div style="font-family: Inter, sans-serif; padding: 8px; color: var(--text-primary); min-width: 220px;">
            <div style="background: #ff4500; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 12px; margin-bottom: 6px; display: inline-block;">
              GEMPA TERKINI BMKG • M${mag.toFixed(1)}
            </div><br/>
            <strong style="font-size: 13px; color: var(--text-primary);">${b.Wilayah}</strong><br/>
            <span style="font-size: 11px; color: var(--text-secondary);">Kedalaman: ${b.Kedalaman}</span><br/>
            <span style="font-size: 11px; color: var(--sev-normal); font-weight: 600;">${b.Potensi}</span><br/>
            <span style="font-size: 10px; color: var(--text-muted);">${b.Tanggal} • ${b.Jam}</span>
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
      const report = getVolcanoReports(v, volcanoes)[0];

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
          <div data-declutter-fixed style="
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
            <span data-declutter="${isSelected ? 100 : isAwas ? 90 : isSiaga ? 80 : isWaspada ? 70 : 60}" style="
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
            🔬 Analisis PVMBG
          </button>
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

        // Every volcano can be analysed: falls back to a routine-monitoring record without a live report
        const btnInspect = document.getElementById(`btn-volcano-inspect-${v.name.replace(/\s+/g, '-')}`);
        if (btnInspect) {
          btnInspect.onclick = () => {
            onInspectVolcanoSeismogram?.(buildVolcanoInspectionReport(v, volcanoes));
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
    const shouldShowAsh = isSimulasi || tsunamiActive || Boolean(selectedVolcano && selectedVolcano !== 'BMKG_REGIONAL');
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

  // 5. Handle external focus request (from LatestQuakeCard / OceanPanel)
  useEffect(() => {
    if (!mapRef.current || !focusCoords) return;
    mapRef.current.flyTo([focusCoords.lat, focusCoords.lon], 9, {
      animate: true,
      duration: 1.5,
    });
  }, [focusCoords]);

  // 6. Render Megathrust drill concentric wavefronts, coastal ETA vectors & animated wave propagation
  useEffect(() => {
    const layer = drillLayerRef.current;
    const animLayer = waveAnimLayerRef.current;
    const map = mapRef.current;
    if (!layer || !animLayer || !map) return;

    layer.clearLayers();
    animLayer.clearLayers();

    let rafId: number | null = null;
    let lastFrameTime = 0;

    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch));

    // Resolve live BMKG epicenter coords for baseline shockwave ripple
    let liveLat: number | null = null;
    let liveLon: number | null = null;
    let liveMag = 4.5;
    if (realQuakes?.latest_bmkg) {
      const b = realQuakes.latest_bmkg;
      liveMag = parseFloat(b.Magnitude) || 4.5;
      if (b.Coordinates) {
        const parts = b.Coordinates.split(',');
        if (parts.length === 2) {
          liveLat = parseFloat(parts[0].trim());
          liveLon = parseFloat(parts[1].trim());
        }
      }
      if ((liveLat === null || isNaN(liveLat)) && b.Lintang && b.Bujur) {
        liveLat = parseFloat(b.Lintang);
        if (b.Lintang.includes('LS')) liveLat = -Math.abs(liveLat);
        liveLon = parseFloat(b.Bujur);
        if (b.Bujur.includes('BB')) liveLon = -Math.abs(liveLon);
      }
    }

    // Mode A: Full Tsunami & Megathrust Propagation Simulation
    if (isSimulasi && drillScenarioData) {
      const { id, name, faultZone, magnitude, depth, lat, lon, tsunamiHeight } = drillScenarioData;
      const magScale = Math.max(0.85, (magnitude - 6.2) * 0.55);
      const waveFactor = tsunamiActive ? Math.max(1.15, tsunamiHeight / 10) : 0.75;

      // Coastal Tsunami Arrival Targets per Megathrust Scenario
      const targetVectors: Record<string, { pos: [number, number]; label: string; etaMin: number }[]> = {
        'sunda-strait': [
          { pos: [-6.07, 105.88], label: 'Anyer / Banten', etaMin: 16 },
          { pos: [-5.75, 105.59], label: 'Kalianda Lampung', etaMin: 14 },
          { pos: [-6.78, 105.23], label: 'Ujung Kulon', etaMin: 7 },
          { pos: [-6.99, 106.54], label: 'Palabuhanratu', etaMin: 26 },
        ],
        'south-java': [
          { pos: [-7.74, 109.01], label: 'Cilacap', etaMin: 21 },
          { pos: [-7.69, 108.65], label: 'Pangandaran', etaMin: 19 },
          { pos: [-8.02, 110.33], label: 'Parangtritis DIY', etaMin: 24 },
          { pos: [-8.3, 111.72], label: 'Prigi Trenggalek', etaMin: 29 },
        ],
        'mentawai': [
          { pos: [-1.55, 99.18], label: 'Pulau Siberut', etaMin: 9 },
          { pos: [-0.96, 100.35], label: 'Kota Padang', etaMin: 18 },
          { pos: [-3.8, 102.25], label: 'Pesisir Bengkulu', etaMin: 27 },
          { pos: [1.74, 98.78], label: 'Sibolga', etaMin: 34 },
        ],
        'palu-koro': [
          { pos: [-0.89, 119.86], label: 'Teluk Palu', etaMin: 5 },
          { pos: [-0.68, 119.74], label: 'Donggala', etaMin: 4 },
          { pos: [1.04, 120.82], label: 'Toli-Toli', etaMin: 22 },
          { pos: [-2.68, 118.89], label: 'Mamuju', etaMin: 28 },
        ],
      };

      const targets = targetVectors[id] || [];

      // 3 Zona Area Dampak Tektonik & Tsunami (P-Wave Luar Cyan, S-Wave Jingga, Rupture/Tsunami Merah)
      // Outer P-wave primary impact zone (cyan)
      L.circle([lat, lon], {
        radius: 260000 * magScale,
        color: '#06b6d4',
        weight: 1.6,
        opacity: 0.78,
        dashArray: '6 6',
        fillColor: '#06b6d4',
        fillOpacity: 0.06,
        interactive: false,
      }).addTo(layer);

      // Middle S-wave strong shaking impact zone (amber/orange)
      L.circle([lat, lon], {
        radius: 145000 * magScale,
        color: '#f97316',
        weight: 2,
        opacity: 0.86,
        dashArray: '4 4',
        fillColor: '#f59e0b',
        fillOpacity: 0.13,
        interactive: false,
      }).addTo(layer);

      // Inner Rupture & Tsunami generation zone (crimson)
      L.circle([lat, lon], {
        radius: 75000 * magScale * waveFactor,
        color: '#ef4444',
        weight: 2.5,
        opacity: 0.95,
        fillColor: '#ef4444',
        fillOpacity: tsunamiActive ? 0.25 : 0.15,
        interactive: false,
      }).addTo(layer);

      // Animated Tsunami Travel Vectors, Coastal Flood Impact Zones & ETA Badges when tsunamiActive
      if (tsunamiActive) {
        targets.forEach((tgt) => {
          // Coastal danger impact zone halo
          L.circle(tgt.pos, {
            radius: 24000,
            color: '#fb7185',
            weight: 1.5,
            opacity: 0.8,
            fillColor: '#f43f5e',
            fillOpacity: 0.24,
            interactive: false,
          }).addTo(layer);

          L.polyline([[lat, lon], tgt.pos], {
            color: '#22d3ee',
            weight: 2.2,
            opacity: 0.85,
            dashArray: '10, 6',
            className: 'tsunami-ray-flow',
            interactive: false,
          }).addTo(layer);

          const etaIcon = L.divIcon({
            className: 'tsunami-eta-badge',
            html: `
              <div style="display: inline-flex; align-items: center; gap: 5px; background: rgba(9,15,28,0.88); border: 1.5px solid #fb7185; color: #fff1f2; padding: 2px 7px; border-radius: 999px; font-family: monospace; font-size: 10px; font-weight: 800; white-space: nowrap; box-shadow: 0 0 12px rgba(244,63,94,0.45);">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: #fb7185; animation: ping 1.4s infinite;"></span>
                ${escapeHtml(tgt.label)} · ETA ${tgt.etaMin}m
              </div>
            `,
            iconSize: [145, 22],
            iconAnchor: [72, 11],
          });
          L.marker(tgt.pos, { icon: etaIcon, zIndexOffset: 820 }).addTo(layer);
        });
      }

      // Epicenter Drill Marker
      const marker = L.marker([lat, lon], {
        icon: L.divIcon({
          className: '',
          html: '<div class="drill-epicenter-ping"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        zIndexOffset: 900,
      });

      marker.bindPopup(
        `<div style="min-width:210px;font-family:Inter,sans-serif;color:var(--text-primary);padding:4px 2px;">
          <div style="font-size:11px;font-weight:700;color:#fb7185;text-transform:uppercase;letter-spacing:0.06em;">DRILL MEGATHRUST EPISENTER</div>
          <div style="font-size:14px;font-weight:700;margin:3px 0;color:var(--text-primary);">${escapeHtml(name)}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">Zona Sesar: ${escapeHtml(faultZone)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;">
            <div><strong>Magnitudo:</strong> M${magnitude.toFixed(1)}</div>
            <div><strong>Kedalaman:</strong> ${depth} km</div>
            <div><strong>Tsunami Maks:</strong> ${tsunamiHeight.toFixed(1)} m</div>
            <div><strong>Status:</strong> ${tsunamiActive ? 'GELOMBANG AKTIF' : 'PRECURSOR'}</div>
          </div>
        </div>`
      );
      marker.addTo(layer);

      if (lastDrillIdRef.current !== id) {
        lastDrillIdRef.current = id;
        map.flyTo([lat, lon], 6, { animate: true, duration: 1.3 });
      }

      // Dynamic Propagating P/S & Tsunami Wavefront Rings
      const pWaveCircle = L.circle([lat, lon], {
        radius: 30000,
        color: '#22d3ee',
        weight: 1.6,
        opacity: 0.75,
        dashArray: '6 6',
        fillColor: '#22d3ee',
        fillOpacity: 0.04,
        interactive: false,
      }).addTo(animLayer);

      const sWaveCircle = L.circle([lat, lon], {
        radius: 20000,
        color: '#fb923c',
        weight: 2,
        opacity: 0.8,
        dashArray: '4 4',
        fillColor: '#f59e0b',
        fillOpacity: 0.06,
        interactive: false,
      }).addTo(animLayer);

      const tsunamiWaveRings = tsunamiActive
        ? [0, 1, 2].map(() =>
            L.circle([lat, lon], {
              radius: 25000,
              color: '#fb7185',
              weight: 2.5,
              opacity: 0.85,
              fillColor: '#22d3ee',
              fillOpacity: 0.14,
              interactive: false,
            }).addTo(animLayer)
          )
        : [];

      const startTime = performance.now();
      const animateWavefronts = (now: number) => {
        if (!document.hidden && now - lastFrameTime >= 36) {
          lastFrameTime = now;
          const elapsed = now - startTime;

          // Fast body waves (P & S)
          const pPhase = (elapsed % 2400) / 2400;
          const sPhase = ((elapsed + 900) % 2800) / 2800;
          pWaveCircle.setRadius(25000 + pPhase * 420000 * magScale);
          pWaveCircle.setStyle({ opacity: Math.max(0.05, 0.78 * (1 - pPhase)) });

          sWaveCircle.setRadius(18000 + sPhase * 280000 * magScale);
          sWaveCircle.setStyle({ opacity: Math.max(0.08, 0.82 * (1 - sPhase)) });

          // Staggered Ocean Tsunami Crests
          tsunamiWaveRings.forEach((ring, idx) => {
            const crestPhase = ((elapsed / 3600) + idx / 3) % 1;
            const maxRadius = 350000 * magScale * Math.min(1.35, waveFactor);
            ring.setRadius(22000 + crestPhase * maxRadius);
            ring.setStyle({
              opacity: Math.max(0.05, 0.9 * (1 - crestPhase)),
              fillOpacity: Math.max(0.01, 0.16 * (1 - crestPhase)),
              weight: Math.max(1.0, 3.0 * (1 - crestPhase * 0.6)),
              color: crestPhase < 0.35 ? '#fb7185' : '#22d3ee',
            });
          });
        }
        rafId = requestAnimationFrame(animateWavefronts);
      };
      rafId = requestAnimationFrame(animateWavefronts);

      return () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    }

    lastDrillIdRef.current = null;

    // Mode B: Operasi Live Continuous Seismic Epicenter Shockwave Ripple (plus live tsunami crest if active)
    if (liveLat !== null && liveLon !== null && !isNaN(liveLat) && !isNaN(liveLon)) {
      const ringColor = tsunamiActive || liveMag >= 6.0 ? '#fb7185' : liveMag >= 5.0 ? '#fb923c' : '#22d3ee';
      const maxLiveRadius = tsunamiActive ? 260000 : Math.max(115000, liveMag * 24000);
      const liveRipples = [0, 1].map(() =>
        L.circle([liveLat!, liveLon!], {
          radius: 15000,
          color: ringColor,
          weight: tsunamiActive ? 2.4 : 1.6,
          opacity: 0.75,
          fillColor: ringColor,
          fillOpacity: tsunamiActive ? 0.14 : 0.08,
          interactive: false,
        }).addTo(animLayer)
      );

      const startTime = performance.now();
      const animateLiveRipple = (now: number) => {
        if (!document.hidden && now - lastFrameTime >= 42) {
          lastFrameTime = now;
          const elapsed = now - startTime;
          liveRipples.forEach((ring, idx) => {
            const phase = ((elapsed / (tsunamiActive ? 2600 : 3400)) + idx * 0.5) % 1;
            ring.setRadius(12000 + phase * maxLiveRadius);
            ring.setStyle({
              opacity: Math.max(0.02, 0.75 * (1 - phase)),
              fillOpacity: Math.max(0.01, (tsunamiActive ? 0.16 : 0.08) * (1 - phase)),
            });
          });
        }
        rafId = requestAnimationFrame(animateLiveRipple);
      };
      rafId = requestAnimationFrame(animateLiveRipple);

      return () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    }
  }, [isSimulasi, tsunamiActive, drillScenarioData, realQuakes]);

  // Reset camera to Indonesia overview
  const handleResetOverview = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([-2.5, 118.0], 5, { animate: true, duration: 1.2 });
  };

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-[var(--surface-canvas)] ${className}`}
    >
      {/* Floating Tactical Map Controls (Clear of Top KPI Strip & Right Inspector HUD) */}
      <div
        className={`pointer-events-none absolute z-[900] flex items-center gap-2 ${
          floatingHud ? 'bottom-8 right-3 lg:right-[396px]' : 'right-3 top-3'
        }`}
      >
        <div className="pointer-events-auto hidden rounded-full glass-hud px-3 py-1 font-mono text-[10px] tabular-nums text-[var(--text-secondary)] sm:block">
          {mouseCoords}
        </div>
        <button
          type="button"
          onClick={handleResetOverview}
          title="Kembalikan fokus kamera ke seluruh kepulauan Indonesia"
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full glass-hud px-3 py-1 text-[11px] font-semibold text-[var(--text-primary)] transition-opacity hover:opacity-90"
        >
          <RotateCcw className="h-3 w-3 text-[var(--accent)]" />
          <span className="hidden sm:inline">Reset Peta</span>
        </button>
      </div>

      {/* Leaflet DOM container */}
      <div
        ref={mapContainerRef}
        className="relative z-[1] h-full min-h-[380px] w-full"
      />

      {/* Floating Tactical Layer Legend (Collapsible Pill, Clear of Bottom Seismograph Dock) */}
      <div
        className={`glass-hud absolute z-[900] rounded-2xl p-2.5 transition-all ${
          floatingHud
            ? 'bottom-3 left-3 lg:bottom-[152px] lg:left-4'
            : 'bottom-3 left-3'
        } ${isLegendCollapsed ? 'w-auto' : 'w-[244px] max-w-[calc(100%-24px)]'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-[var(--text-primary)] uppercase">
            <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>LAYER INATEWS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--text-secondary)]">
              {Object.values(activeLayer).filter(Boolean).length}/7
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
                });
              }}
              className="text-[10px] font-semibold text-[var(--accent)] hover:underline"
              title="Aktifkan atau sembunyikan semua layer"
            >
              {Object.values(activeLayer).every(Boolean) ? 'Reset' : 'Semua'}
            </button>
            <button
              type="button"
              onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}
              aria-label={isLegendCollapsed ? 'Buka legenda' : 'Ciutkan legenda'}
              className="inline-flex h-5 w-5 items-center justify-center rounded border border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {isLegendCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {!isLegendCollapsed && (
          <div className="mt-2 flex flex-col gap-1 border-t border-[var(--border-hairline)] pt-2">
            {(
              [
                {
                  key: 'sundaMegathrust',
                  label: 'Megathrust Sunda (M8.2+)',
                  color: '#ef4444',
                  kind: 'line',
                },
                {
                  key: 'javaTrench',
                  label: 'Palung Jawa (M8.8)',
                  color: '#f97316',
                  kind: 'line',
                },
                {
                  key: 'paluKoro',
                  label: 'Sesar Palu-Koro',
                  color: '#eab308',
                  kind: 'line',
                },
                {
                  key: 'volcanoes',
                  label: 'Pos Gunung Api (PVMBG)',
                  color: '#f97316',
                  kind: 'dot',
                },
                {
                  key: 'ash',
                  label: `Sebaran Abu ${isSimulasi ? '(Simulasi)' : '(VONA)'}`,
                  color: '#fb923c',
                  kind: 'dot',
                },
                {
                  key: 'stations',
                  label: 'Stasiun Broadband BMKG',
                  color: '#38bdf8',
                  kind: 'dot',
                },
                {
                  key: 'buoys',
                  label: 'InaTEWS / IOC Tide Buoys',
                  color: '#06b6d4',
                  kind: 'dot',
                },
              ] as const
            ).map((item) => {
              const active = activeLayer[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveLayer((p) => ({ ...p, [item.key]: !p[item.key] }))}
                  className={`flex items-center justify-between rounded px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-[var(--surface-2)] ${
                    active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] opacity-60'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {item.kind === 'line' ? (
                      <span
                        className="inline-block h-0.5 w-3 shrink-0 rounded"
                        style={{ background: item.color }}
                      />
                    ) : (
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: item.color }}
                      />
                    )}
                    <span className="truncate font-medium">{item.label}</span>
                  </span>
                  <span className="font-mono text-[10px] font-bold text-[var(--accent)]">
                    {active ? 'ON' : 'OFF'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
