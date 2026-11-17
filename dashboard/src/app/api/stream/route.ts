import { NextRequest } from 'next/server';
import { isCloudRuntime, proxyBackendStream } from '@/lib/backendProxy';
import {
  AI_PROVIDER_COOKIE,
  buildLiveAIAnalysis,
  normalizeAIProvider,
} from '@/lib/aiContext';
import { fetchLiveTelemetrySnapshot } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const proxied = await proxyBackendStream(
    '/api/stream',
    { headers: { Accept: 'text/event-stream' } },
    1500,
    req.signal
  );

  if (proxied?.body) {
    return new Response(proxied.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  const provider = normalizeAIProvider(
    req.cookies.get(AI_PROVIDER_COOKIE)?.value || process.env.AI_PROVIDER
  );
  const snapshot = await fetchLiveTelemetrySnapshot();
  const aiAnalysis = buildLiveAIAnalysis({ snapshot, provider });

  const encoder = new TextEncoder();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let maxLifeTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (maxLifeTimer) {
      clearTimeout(maxLifeTimer);
      maxLifeTimer = null;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      const sendFrame = (eventName: string, payload: unknown) => {
        if (req.signal.aborted) return;
        const envelope = JSON.stringify({ event: eventName, data: payload });
        controller.enqueue(encoder.encode(`event: all\ndata: ${envelope}\n\n`));
      };

      controller.enqueue(encoder.encode('retry: 15000\n\n'));
      sendFrame('metrics', snapshot.status);
      sendFrame('activity_index', snapshot.activityIndex);
      sendFrame('ai_analysis', aiAnalysis);
      if (snapshot.tsunami?.active) {
        sendFrame('tsunami', snapshot.tsunami);
      }

      const latest = snapshot.earthquakes.latest_bmkg;
      if (latest) {
        sendFrame('event', {
          type: 'SEISMIC',
          magnitude: parseFloat(latest.Magnitude) || snapshot.activityIndex.max_magnitude,
          depth: parseFloat((latest.Kedalaman || '10').replace(/[^0-9.]/g, '')) || 10,
          fault_zone: latest.Wilayah,
          severity: snapshot.status.risk_level === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          timestamp: latest.DateTime || new Date().toISOString(),
        });
      }

      const sampleStation = snapshot.ocean.stations[0];
      if (sampleStation) {
        sendFrame('event', {
          type: 'OCEAN',
          sensor_id: `IOC-${sampleStation.code.toUpperCase()}`,
          wave_height: sampleStation.baseLevelMeters,
          description: `Pasut IOC ${sampleStation.name}: Muka laut ${sampleStation.level} (${sampleStation.source === 'IOC_LIVE' ? 'LIVE FEED' : 'STANDBY'})`,
          severity: sampleStation.isAnomaly ? 'CRITICAL' : 'LOW',
          timestamp: snapshot.ocean.timestamp,
        });
      }

      let tick = 0;
      heartbeatTimer = setInterval(() => {
        if (req.signal.aborted) {
          cleanup();
          try {
            controller.close();
          } catch {
            // ignore
          }
          return;
        }

        tick++;
        const st =
          snapshot.ocean.stations[tick % Math.max(1, snapshot.ocean.stations.length)];
        if (st) {
          sendFrame('event', {
            type: 'STATION',
            station_id: st.code.toUpperCase(),
            status: 'ONLINE',
            description: `Stasiun ${st.name}: Elevasi ${st.level} • Cuaca ${snapshot.weather.statusLabel}`,
            severity: 'LOW',
            timestamp: new Date().toISOString(),
          });
        }
      }, 10000);

      // Bound standalone serverless SSE connection lifetime cleanly on Vercel
      const maxDurationMs = isCloudRuntime() ? 22000 : 45000;
      maxLifeTimer = setTimeout(() => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      }, maxDurationMs);

      req.signal.addEventListener(
        'abort',
        () => {
          cleanup();
          try {
            controller.close();
          } catch {
            // ignore
          }
        },
        { once: true }
      );
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
