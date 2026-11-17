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
    return NextResponse.json(proxied);
  }

  const live = await fetchRealtimeEarthquakesData();
  return NextResponse.json(live);
}
