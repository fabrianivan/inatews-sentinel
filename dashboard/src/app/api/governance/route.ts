import { NextResponse } from 'next/server';
import { proxyBackendJson } from '@/lib/backendProxy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const proxied = await proxyBackendJson<Record<string, unknown>>('/api/governance');
  if (proxied) {
    return NextResponse.json(proxied);
  }

  return NextResponse.json({
    schema_registry: {
      status: 'ONLINE',
      mode: 'READWRITE',
      compatibility: 'BACKWARD',
      subject_count: 7,
    },
    stream_catalog: {
      status: 'SYNCHRONIZED',
      total_topics: 10,
      governed_topics: 10,
    },
    topics: [
      { name: 'gempa.seismic', schema_id: 101, version: 3, format: 'AVRO', compliance: '100% VALID' },
      { name: 'gempa.stations', schema_id: 102, version: 2, format: 'JSON_SR', compliance: '100% VALID' },
      { name: 'gempa.tsunami', schema_id: 103, version: 2, format: 'AVRO', compliance: '100% VALID' },
      { name: 'gempa.weather', schema_id: 104, version: 1, format: 'JSON_SR', compliance: '100% VALID' },
      { name: 'gempa.intensity_index', schema_id: 105, version: 4, format: 'AVRO', compliance: '100% VALID' },
      { name: 'gempa.correlated_alerts', schema_id: 106, version: 3, format: 'AVRO', compliance: '100% VALID' },
      { name: 'gempa.tsunami_scenarios', schema_id: 107, version: 2, format: 'AVRO', compliance: '100% VALID' },
    ],
    timestamp: new Date().toISOString(),
  });
}
