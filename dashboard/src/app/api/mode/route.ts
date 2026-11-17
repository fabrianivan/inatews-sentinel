import { NextRequest, NextResponse } from 'next/server';
import { proxyBackendJson } from '@/lib/backendProxy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { mode?: string } = { mode: 'real' };
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  const mode = body.mode || 'real';
  const proxied = await proxyBackendJson<{ status: string; mode: string }>('/api/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });

  if (proxied) {
    return NextResponse.json(proxied);
  }

  return NextResponse.json({
    status: 'ok',
    mode,
  });
}
