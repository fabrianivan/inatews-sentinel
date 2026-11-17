import { NextRequest, NextResponse } from 'next/server';
import { proxyBackendJson } from '@/lib/backendProxy';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const subPath = Array.isArray(slug) ? slug.join('/') : '';

  const proxied = await proxyBackendJson<Record<string, unknown>>(`/api/simulate/${subPath}`, {
    method: 'POST',
  });
  if (proxied) {
    return NextResponse.json(proxied);
  }

  return NextResponse.json({
    status: 'ok',
    scenario: subPath,
    mode: 'standalone',
    message: `Simulation '${subPath}' acknowledged`,
  });
}
