import { NextRequest } from 'next/server';
import { isCloudRuntime, proxyBackendStream } from '@/lib/backendProxy';
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

  // What this client was last told. A browser's EventSource returns the last SSE id as
  // Last-Event-ID when it reconnects on its own; a client that opens a fresh EventSource
  // can pass the same value as ?lastEventId=.
  const lastEventId = req.headers.get('last-event-id') ?? req.nextUrl.searchParams.get('lastEventId');
  const snapshot = await fetchLiveTelemetrySnapshot();

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
      const sendFrame = (eventName: string, payload: unknown, id?: string) => {
        if (req.signal.aborted) return;
        const envelope = JSON.stringify({ event: eventName, data: payload });
        controller.enqueue(encoder.encode(`${id ? `id: ${id}\n` : ''}event: all\ndata: ${envelope}\n\n`));
      };

      controller.enqueue(encoder.encode('retry: 15000\n\n'));
      // A first connection is given an id even when there is no quake to announce, so the
      // client has something to send back and is recognised as returning next time.
      sendFrame('metrics', snapshot.status, lastEventId === null ? 'connected' : undefined);
      sendFrame('activity_index', snapshot.activityIndex);
      // No `ai_analysis` frame: the panel polls /api/ai/latest, which may carry a model's
      // text; a template pushed on every reconnect would keep overwriting it.
      if (snapshot.tsunami?.active) {
        sendFrame('tsunami', snapshot.tsunami);
      }

      // A reconnect is not an earthquake: BMKG's latest report is announced once per
      // distinct origin time, and a placeholder record is never announced at all.
      const latest = snapshot.earthquakes.latest_bmkg;
      const magnitude = latest ? parseFloat(latest.Magnitude) : NaN;
      if (latest && !latest.seeded && Number.isFinite(magnitude)) {
        const quakeId = `quake:${latest.DateTime}`.replace(/[\r\n]/g, '');
        if (quakeId !== lastEventId) {
          const depth = parseFloat(latest.Kedalaman);
          sendFrame(
            'event',
            {
              type: 'SEISMIC',
              source: 'BMKG',
              magnitude,
              depth: Number.isFinite(depth) ? depth : undefined,
              fault_zone: latest.Wilayah,
              timestamp: latest.DateTime,
            },
            quakeId
          );
        }
      }

      // The lines below are composed by this route, not received from a sensor, and say so.
      // The station-list line is for a first connection only; a returning client has it.
      if (lastEventId === null) {
        sendFrame('event', {
          type: 'OCEAN',
          sensor_id: 'IOC',
          description:
            snapshot.ocean.source === 'IOC_LIVE'
              ? `Daftar stasiun pasut IOC dimuat: ${snapshot.ocean.live_count} stasiun, tanpa data muka laut langsung`
              : 'Daftar stasiun pasut IOC tidak tersedia; memakai daftar bawaan',
          severity: 'LOW',
          synthetic: true,
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
            description: `Detak aliran · ${st.name}: nilai acuan ${st.level}, bukan pengamatan langsung`,
            severity: 'LOW',
            synthetic: true,
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
