import { NextRequest, NextResponse } from 'next/server';
import { proxyBackendJson } from '@/lib/backendProxy';
import {
  AI_PROVIDER_COOKIE,
  generateHybridCopilotReply,
  normalizeAIProvider,
  type TelemetryPromptContext,
} from '@/lib/aiContext';
import { fetchLiveTelemetrySnapshot } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: {
    question?: string;
    prompt?: string;
    query?: string;
    message?: string;
    context?: TelemetryPromptContext;
  } = {};

  try {
    body = await req.json();
  } catch {
    // ignore
  }

  const rawQuestion = String(
    body.question || body.prompt || body.query || body.message || ''
  ).trim();

  if (!rawQuestion) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  const proxied = await proxyBackendJson<{
    answer?: string;
    latency_ms?: number;
    timestamp?: string;
  }>(
    '/api/ai/ask',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: rawQuestion }),
    },
    3000
  );

  if (proxied?.answer) {
    return NextResponse.json(proxied);
  }

  const provider = normalizeAIProvider(
    body.context?.provider ||
      req.cookies.get(AI_PROVIDER_COOKIE)?.value ||
      process.env.AI_PROVIDER
  );
  const snapshot = await fetchLiveTelemetrySnapshot();
  const reply = await generateHybridCopilotReply({
    question: rawQuestion,
    kind: 'copilot',
    provider,
    context: body.context,
    snapshot,
  });

  return NextResponse.json({
    answer: reply.answer,
    model: reply.model,
    latency_ms: reply.latencyMs,
    timestamp: new Date().toISOString(),
  });
}
