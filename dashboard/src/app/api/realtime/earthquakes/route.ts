import { NextResponse } from 'next/server';
import type { RealtimeEarthquakesData } from '@/lib/types';
import { proxyBackendJson } from '@/lib/backendProxy';
import { fetchRealtimeEarthquakesData } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const proxied = await proxyBackendJson<RealtimeEarthquakesData>('/api/realtime/earthquakes');
  if (
    proxied &&
    (proxied.latest_bmkg || (Array.isArray(proxied.recent_bmkg) && proxied.recent_bmkg.length > 0))
  ) {
    // The Go backend serialises a list it has not fetched yet as null; the client expects arrays.
    return NextResponse.json({
      ...proxied,
      recent_bmkg: Array.isArray(proxied.recent_bmkg) ? proxied.recent_bmkg : [],
      recent_usgs: Array.isArray(proxied.recent_usgs) ? proxied.recent_usgs : [],
    });
  }

  const live = await fetchRealtimeEarthquakesData();
  return NextResponse.json(live);
}
