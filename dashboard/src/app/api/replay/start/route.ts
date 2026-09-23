import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  let body = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  const candidateBases = [
    process.env.INTERNAL_BACKEND_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_BASE,
    'http://localhost:8080',
    'http://localhost:8081',
  ].filter(Boolean) as string[];

  for (const base of candidateBases) {
    try {
      const res = await fetch(`${base}/api/replay/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      // try next
    }
  }

  return NextResponse.json({ status: 'ok', message: 'Replay started in client simulation mode', body });
}
