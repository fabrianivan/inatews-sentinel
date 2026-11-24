import { NextRequest, NextResponse } from 'next/server';
import type { AgentState } from '@/lib/types';
import { proxyBackendJson } from '@/lib/backendProxy';
import {
  AI_PROVIDER_COOKIE,
  AUTO_SUMMARY_MODEL_LABEL,
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
  // This state is assembled from templates: no model ran, so none is named.
  const state = buildLiveAgentState({
    snapshot,
    activeProvider: provider,
    activeModel: AUTO_SUMMARY_MODEL_LABEL,
  });

  return NextResponse.json(state);
}
