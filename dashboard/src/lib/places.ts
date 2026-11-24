/**
 * Places a reader can choose as "my location" when the browser will not give one: every
 * provincial capital, plus a few large cities. Coordinates are city centres, rounded — the
 * notifications only measure distance to an epicentre, which is itself uncertain by kilometres.
 */

import type { GeoPoint } from './proximity';

export interface Place extends GeoPoint {
  id: string;
  name: string;
  province: string;
  region: 'Sumatra' | 'Jawa' | 'Bali & Nusa Tenggara' | 'Kalimantan' | 'Sulawesi' | 'Maluku' | 'Papua';
}

export const PLACES: Place[] = [
  { id: 'banda-aceh', name: 'Banda Aceh', province: 'Aceh', region: 'Sumatra', lat: 5.55, lon: 95.32 },
  { id: 'medan', name: 'Medan', province: 'Sumatera Utara', region: 'Sumatra', lat: 3.6, lon: 98.67 },
  { id: 'padang', name: 'Padang', province: 'Sumatera Barat', region: 'Sumatra', lat: -0.95, lon: 100.42 },
  { id: 'pekanbaru', name: 'Pekanbaru', province: 'Riau', region: 'Sumatra', lat: 0.51, lon: 101.45 },
  { id: 'batam', name: 'Batam', province: 'Kepulauan Riau', region: 'Sumatra', lat: 1.05, lon: 104.03 },
  { id: 'tanjung-pinang', name: 'Tanjung Pinang', province: 'Kepulauan Riau', region: 'Sumatra', lat: 0.92, lon: 104.46 },
  { id: 'jambi', name: 'Jambi', province: 'Jambi', region: 'Sumatra', lat: -1.61, lon: 103.61 },
  { id: 'bengkulu', name: 'Bengkulu', province: 'Bengkulu', region: 'Sumatra', lat: -3.79, lon: 102.26 },
  { id: 'palembang', name: 'Palembang', province: 'Sumatera Selatan', region: 'Sumatra', lat: -2.98, lon: 104.78 },
  { id: 'pangkal-pinang', name: 'Pangkal Pinang', province: 'Kepulauan Bangka Belitung', region: 'Sumatra', lat: -2.13, lon: 106.12 },
  { id: 'bandar-lampung', name: 'Bandar Lampung', province: 'Lampung', region: 'Sumatra', lat: -5.4, lon: 105.27 },
  { id: 'serang', name: 'Serang', province: 'Banten', region: 'Jawa', lat: -6.12, lon: 106.15 },
  { id: 'jakarta', name: 'Jakarta', province: 'DKI Jakarta', region: 'Jawa', lat: -6.21, lon: 106.85 },
  { id: 'bandung', name: 'Bandung', province: 'Jawa Barat', region: 'Jawa', lat: -6.92, lon: 107.62 },
  { id: 'semarang', name: 'Semarang', province: 'Jawa Tengah', region: 'Jawa', lat: -6.97, lon: 110.42 },
  { id: 'yogyakarta', name: 'Yogyakarta', province: 'DI Yogyakarta', region: 'Jawa', lat: -7.8, lon: 110.37 },
  { id: 'surabaya', name: 'Surabaya', province: 'Jawa Timur', region: 'Jawa', lat: -7.26, lon: 112.75 },
  { id: 'malang', name: 'Malang', province: 'Jawa Timur', region: 'Jawa', lat: -7.98, lon: 112.63 },
  { id: 'denpasar', name: 'Denpasar', province: 'Bali', region: 'Bali & Nusa Tenggara', lat: -8.67, lon: 115.21 },
  { id: 'mataram', name: 'Mataram', province: 'Nusa Tenggara Barat', region: 'Bali & Nusa Tenggara', lat: -8.58, lon: 116.12 },
  { id: 'kupang', name: 'Kupang', province: 'Nusa Tenggara Timur', region: 'Bali & Nusa Tenggara', lat: -10.18, lon: 123.61 },
  { id: 'pontianak', name: 'Pontianak', province: 'Kalimantan Barat', region: 'Kalimantan', lat: -0.03, lon: 109.34 },
  { id: 'palangka-raya', name: 'Palangka Raya', province: 'Kalimantan Tengah', region: 'Kalimantan', lat: -2.21, lon: 113.92 },
  { id: 'banjarbaru', name: 'Banjarbaru', province: 'Kalimantan Selatan', region: 'Kalimantan', lat: -3.46, lon: 114.81 },
  { id: 'banjarmasin', name: 'Banjarmasin', province: 'Kalimantan Selatan', region: 'Kalimantan', lat: -3.32, lon: 114.59 },
  { id: 'samarinda', name: 'Samarinda', province: 'Kalimantan Timur', region: 'Kalimantan', lat: -0.5, lon: 117.15 },
  { id: 'balikpapan', name: 'Balikpapan', province: 'Kalimantan Timur', region: 'Kalimantan', lat: -1.24, lon: 116.85 },
  { id: 'tanjung-selor', name: 'Tanjung Selor', province: 'Kalimantan Utara', region: 'Kalimantan', lat: 2.84, lon: 117.37 },
  { id: 'manado', name: 'Manado', province: 'Sulawesi Utara', region: 'Sulawesi', lat: 1.47, lon: 124.84 },
  { id: 'gorontalo', name: 'Gorontalo', province: 'Gorontalo', region: 'Sulawesi', lat: 0.54, lon: 123.06 },
  { id: 'palu', name: 'Palu', province: 'Sulawesi Tengah', region: 'Sulawesi', lat: -0.9, lon: 119.87 },
  { id: 'mamuju', name: 'Mamuju', province: 'Sulawesi Barat', region: 'Sulawesi', lat: -2.68, lon: 118.89 },
  { id: 'makassar', name: 'Makassar', province: 'Sulawesi Selatan', region: 'Sulawesi', lat: -5.15, lon: 119.43 },
  { id: 'kendari', name: 'Kendari', province: 'Sulawesi Tenggara', region: 'Sulawesi', lat: -4.0, lon: 122.51 },
  { id: 'ambon', name: 'Ambon', province: 'Maluku', region: 'Maluku', lat: -3.7, lon: 128.18 },
  { id: 'ternate', name: 'Ternate', province: 'Maluku Utara', region: 'Maluku', lat: 0.79, lon: 127.38 },
  { id: 'sofifi', name: 'Sofifi', province: 'Maluku Utara', region: 'Maluku', lat: 0.74, lon: 127.56 },
  { id: 'sorong', name: 'Sorong', province: 'Papua Barat Daya', region: 'Papua', lat: -0.88, lon: 131.26 },
  { id: 'manokwari', name: 'Manokwari', province: 'Papua Barat', region: 'Papua', lat: -0.86, lon: 134.06 },
  { id: 'nabire', name: 'Nabire', province: 'Papua Tengah', region: 'Papua', lat: -3.37, lon: 135.48 },
  { id: 'jayapura', name: 'Jayapura', province: 'Papua', region: 'Papua', lat: -2.53, lon: 140.72 },
  { id: 'wamena', name: 'Wamena', province: 'Papua Pegunungan', region: 'Papua', lat: -4.1, lon: 138.95 },
  { id: 'merauke', name: 'Merauke', province: 'Papua Selatan', region: 'Papua', lat: -8.49, lon: 140.4 },
];

export const PLACE_REGIONS: Place['region'][] = ['Sumatra', 'Jawa', 'Bali & Nusa Tenggara', 'Kalimantan', 'Sulawesi', 'Maluku', 'Papua'];

export function findPlace(id: string | null | undefined): Place | null {
  return PLACES.find((place) => place.id === id) ?? null;
}
