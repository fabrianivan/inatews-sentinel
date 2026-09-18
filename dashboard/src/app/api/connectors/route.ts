import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // All Confluent Cloud connectors are DISABLED — no active streaming pipeline
  const now = new Date();

  const disabledConnectors = [
    {
      id: 'lcc-12n3226',
      name: 'DatagenSource_SeismicTelemetry',
      status: 'DISABLED',
      type: 'source',
      class: 'DatagenSource',
      topic: 'gempa.stations',
      tasks_active: 0,
      tasks_max: 1,
      throughput: '0 rec/s',
      total_records: 0,
      last_heartbeat: new Date(now.getTime() - 86400000).toISOString(),
      config: {
        'connector.class': 'DatagenSource',
        'name': 'DatagenSource_SeismicTelemetry',
        'kafka.auth.mode': 'KAFKA_API_KEY',
        'kafka.endpoint': 'SASL_SSL://pkc-921jm.us-east-2.aws.confluent.cloud:9092',
        'kafka.region': 'us-east-2',
        'kafka.topic': 'gempa.stations',
        'output.data.format': 'JSON',
        'tasks.max': '1',
        'max.interval': '2000',
        'schema.namespace': 'inatews.sentinel',
        'schema.record': 'StationEvent',
      },
    },
    {
      id: 'lcc-alerts-sink',
      name: 'HttpSink_DisasterAlerts',
      status: 'DISABLED',
      type: 'sink',
      class: 'HttpSink',
      topic: 'gempa.correlated_alerts, gempa.tsunami_scenarios',
      tasks_active: 0,
      tasks_max: 1,
      throughput: '0 rec/s',
      total_records: 0,
      last_heartbeat: new Date(now.getTime() - 86400000).toISOString(),
      config: {
        'connector.class': 'HttpSink',
        'name': 'HttpSink_DisasterAlerts',
        'kafka.auth.mode': 'KAFKA_API_KEY',
        'topics': 'gempa.correlated_alerts,gempa.tsunami_scenarios',
        'http.api.url': 'https://inatews-sentinel.vercel.app/api/webhook/alerts',
        'request.method': 'POST',
        'headers': 'Content-Type:application/json|X-System:InaTEWS-Sentinel',
        'input.data.format': 'JSON',
        'tasks.max': '1',
        'reporter.error.topic.name': 'gempa.connector_errors',
        'reporter.result.topic.name': 'gempa.connector_success',
      },
    },
  ];

  return NextResponse.json(disabledConnectors);
}
