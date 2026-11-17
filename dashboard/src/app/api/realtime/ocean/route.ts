import { NextResponse } from 'next/server';
import { proxyBackendJson } from '@/lib/backendProxy';
import { fetchRealtimeOceanData, type OceanFeedResponse } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const proxied = await proxyBackendJson<OceanFeedResponse>('/api/realtime/ocean');
  if (proxied && Array.isArray(proxied.stations) && proxied.stations.length > 0) {
    return NextResponse.json(proxied);
  }

  const live = await fetchRealtimeOceanData();
  return NextResponse.json(live);
}
