import { NextRequest, NextResponse } from 'next/server';
import { proxyBackendJson } from '@/lib/backendProxy';
import {
  AI_PROVIDER_COOKIE,
  getProviderModelLabel,
  normalizeAIProvider,
} from '@/lib/aiContext';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const proxied = await proxyBackendJson<{
    active: string;
    model: string;
    available?: string[];
  }>('/api/ai/provider');
  if (proxied && proxied.active) {
    return NextResponse.json(proxied);
  }

  const cookieVal = req.cookies.get(AI_PROVIDER_COOKIE)?.value;
  const active = normalizeAIProvider(cookieVal || process.env.AI_PROVIDER);

  return NextResponse.json({
    active,
    model: getProviderModelLabel(active),
    available: ['gemini', 'bedrock'],
  });
}

export async function POST(req: NextRequest) {
  let body: { provider?: string } = { provider: 'gemini' };
  try {
    body = await req.json();
  } catch {
    // ignore malformed json
  }

  const targetProvider = normalizeAIProvider(body.provider);
  const proxied = await proxyBackendJson<{
    status?: string;
    active: string;
    model: string;
  }>('/api/ai/provider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: targetProvider }),
  });

  const payload = proxied?.active
    ? proxied
    : {
        status: 'ok',
        active: targetProvider,
        model: getProviderModelLabel(targetProvider),
      };

  const res = NextResponse.json(payload);
  res.cookies.set(AI_PROVIDER_COOKIE, targetProvider, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  });
  return res;
}
