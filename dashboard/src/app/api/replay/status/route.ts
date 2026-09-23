import { NextResponse } from 'next/server';

export async function GET() {
  const candidateBases = [
    process.env.INTERNAL_BACKEND_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_BASE,
    'http://localhost:8080',
    'http://localhost:8081',
  ].filter(Boolean) as string[];

  for (const base of candidateBases) {
    try {
      const res = await fetch(`${base}/api/replay/status`, {
        signal: AbortSignal.timeout(1200),
        cache: 'no-store',
      });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      // try next
    }
  }

  return NextResponse.json({
    active: false,
    scenario_id: 'south-java-m78',
    scenario_name: 'Megathrust Selatan Jawa (M7.8)',
    speed: 1,
    current_step: 0,
    total_steps: 8,
    elapsed_sec: 0,
    duration_sec: 30,
    stage_name: 'STANDBY',
    last_event_time: 'LIVE',
    timestamp: new Date().toISOString(),
  });
}
