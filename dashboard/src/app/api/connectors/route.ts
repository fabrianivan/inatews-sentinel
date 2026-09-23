import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date();
  const connectors = [
    { id: 'lcc-12565d5', name: 'DatagenSource_SeismicTelemetry', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.stations', tasks_active: 1, tasks_max: 1, throughput: '~500 rec/s', total_records: 0, last_heartbeat: now.toISOString(), config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.stations', 'output.data.format': 'JSON', 'max.interval': '2000' } },
    { id: 'lcc-zmjwryd', name: 'DatagenSource_SeismicFeed', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.seismic', tasks_active: 1, tasks_max: 1, throughput: '~200 rec/s', total_records: 0, last_heartbeat: now.toISOString(), config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.seismic', 'output.data.format': 'JSON', 'max.interval': '5000' } },
    { id: 'lcc-3856g02', name: 'DatagenSource_OceanTsunami', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.tsunami', tasks_active: 1, tasks_max: 1, throughput: '~250 rec/s', total_records: 0, last_heartbeat: now.toISOString(), config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.tsunami', 'output.data.format': 'JSON', 'max.interval': '4000' } },
    { id: 'lcc-zmjwrpd', name: 'DatagenSource_WeatherFeed', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.weather', tasks_active: 1, tasks_max: 1, throughput: '~125 rec/s', total_records: 0, last_heartbeat: now.toISOString(), config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.weather', 'output.data.format': 'JSON', 'max.interval': '8000' } },
    { id: 'lcc-1256o0j', name: 'DatagenSource_SatelliteInSAR', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.satellite', tasks_active: 1, tasks_max: 1, throughput: '~100 rec/s', total_records: 0, last_heartbeat: now.toISOString(), config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.satellite', 'output.data.format': 'JSON', 'max.interval': '10000' } },
    { id: 'lcc-2256q0q', name: 'DatagenSource_Infrastructure', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.infrastructure', tasks_active: 1, tasks_max: 1, throughput: '~80 rec/s', total_records: 0, last_heartbeat: now.toISOString(), config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.infrastructure', 'output.data.format': 'JSON', 'max.interval': '12000' } },
    { id: 'lcc-zmjwrn0', name: 'DatagenSource_Population', status: 'RUNNING', type: 'source', class: 'DatagenSource', topic: 'gempa.population', tasks_active: 1, tasks_max: 1, throughput: '~65 rec/s', total_records: 0, last_heartbeat: now.toISOString(), config: { 'connector.class': 'DatagenSource', 'kafka.topic': 'gempa.population', 'output.data.format': 'JSON', 'max.interval': '15000' } },
    { id: 'lcc-zmjwj5z', name: 'HttpSink_DisasterAlerts', status: 'RUNNING', type: 'sink', class: 'HttpSink', topic: 'gempa.correlated_alerts, gempa.tsunami_scenarios', tasks_active: 1, tasks_max: 1, throughput: 'event-driven', total_records: 0, last_heartbeat: now.toISOString(), config: { 'connector.class': 'HttpSink', 'topics': 'gempa.correlated_alerts,gempa.tsunami_scenarios', 'http.api.url': 'https://inatews-sentinel.vercel.app/api/webhook/alerts', 'request.method': 'POST', 'input.data.format': 'JSON' } },
  ];

  return NextResponse.json(connectors);
}
