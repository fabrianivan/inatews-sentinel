import { NextRequest, NextResponse } from 'next/server';
import { proxyBackendJson } from '@/lib/backendProxy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { mode?: unknown } = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed;
  } catch {
    // malformed JSON: treated as an empty body
  }

  const mode = body.mode === 'drill' ? 'drill' : 'real';
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
