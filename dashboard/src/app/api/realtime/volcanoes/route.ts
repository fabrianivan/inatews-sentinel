import { NextResponse } from 'next/server';
import type { VolcanoEruption } from '@/lib/types';
import { proxyBackendJson } from '@/lib/backendProxy';
import { fetchRealtimeVolcanoesData } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const proxied = await proxyBackendJson<VolcanoEruption[]>('/api/realtime/volcanoes');
  if (Array.isArray(proxied) && proxied.length > 0) {
    return NextResponse.json(proxied);
  }

  const live = await fetchRealtimeVolcanoesData();
  return NextResponse.json(live);
}
