import { NextRequest, NextResponse } from 'next/server';
import type { AgentState } from '@/lib/types';
import { proxyBackendJson } from '@/lib/backendProxy';
import {
  AI_PROVIDER_COOKIE,
  getProviderModelLabel,
  normalizeAIProvider,
} from '@/lib/aiContext';
import { buildLiveAgentState, fetchLiveTelemetrySnapshot } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const proxied = await proxyBackendJson<AgentState>('/api/agent/state');
  if (proxied && proxied.status) {
    return NextResponse.json(proxied);
  }

  const provider = normalizeAIProvider(
    req.cookies.get(AI_PROVIDER_COOKIE)?.value || process.env.AI_PROVIDER
  );
  const snapshot = await fetchLiveTelemetrySnapshot();
  const state = buildLiveAgentState({
    snapshot,
    activeProvider: provider,
    activeModel: getProviderModelLabel(provider),
  });

  return NextResponse.json(state);
}
