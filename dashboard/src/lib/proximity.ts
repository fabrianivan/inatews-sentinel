/**
 * Distance and direction between two points on the ground, for telling a reader how far
 * an event is from where they are. Great-circle maths on a spherical Earth: good to well
 * under one percent, which is finer than the epicentre it is applied to.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export function isGeoPoint(value: unknown): value is GeoPoint {
  if (value === null || typeof value !== 'object') return false;
  const { lat, lon } = value as Record<string, unknown>;
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

/** "-7.90,108.90" (BMKG's `Coordinates`: latitude, longitude) → a point, or null when it is not one. */
export function parseLatLon(text: string | null | undefined): GeoPoint | null {
  const parts = (text || '').split(',');
  if (parts.length !== 2) return null;
  const point = { lat: parseFloat(parts[0]), lon: parseFloat(parts[1]) };
  return isGeoPoint(point) ? point : null;
}

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing from `from` towards `to`, in degrees clockwise from north (0–360). */
export function bearingDegrees(from: GeoPoint, to: GeoPoint): number {
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const dLon = toRadians(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS_ID = ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'];

/** Eight-point compass direction in Indonesian for a bearing: 225 → "barat daya". */
export function compassDirection(bearing: number): string {
  const normalized = ((bearing % 360) + 360) % 360;
  return COMPASS_ID[Math.round(normalized / 45) % 8];
}

/**
 * A distance rounded the way it is spoken: epicentres are uncertain by kilometres, so
 * "±120 km" says as much as is known. Under ten kilometres it is not narrowed further.
 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return 'jarak tidak diketahui';
  if (km < 10) return 'kurang dari 10 km';
  const step = km < 100 ? 5 : 10;
  return `±${Math.round(km / step) * step} km`;
}

/**
 * "±120 km di barat daya lokasi Anda" — where `to` lies as seen from `from`. `fromName` names
 * `from` in the text: a chosen city ("Padang") rather than the reader's own position.
 */
export function describeOffset(from: GeoPoint, to: GeoPoint, fromName = 'lokasi Anda'): string {
  const km = distanceKm(from, to);
  if (km < 10) return `${formatDistance(km)} dari ${fromName}`;
  return `${formatDistance(km)} di ${compassDirection(bearingDegrees(from, to))} ${fromName}`;
}
