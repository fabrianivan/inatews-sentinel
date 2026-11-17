import { NextResponse } from 'next/server';
import type { SystemStatus } from '@/lib/types';
import { proxyBackendJson } from '@/lib/backendProxy';
import {
  computeDynamicIntensityAndStatus,
  fetchOpenMeteoWeatherSummary,
  fetchRealtimeEarthquakesData,
  fetchRealtimeOceanData,
} from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const proxied = await proxyBackendJson<SystemStatus>('/api/status');
  if (proxied && typeof proxied.seismic_intensity === 'number') {
    return NextResponse.json(proxied);
  }

  const [earthquakes, ocean, weather] = await Promise.all([
    fetchRealtimeEarthquakesData(),
    fetchRealtimeOceanData(),
    fetchOpenMeteoWeatherSummary(),
  ]);

  const { activityIndex, status } = computeDynamicIntensityAndStatus({
    earthquakes,
    ocean,
    weather,
  });

  return NextResponse.json({
    ...status,
    activity_index: activityIndex,
    ocean_stations_count: ocean.count,
    weather_summary: weather,
  });
}
