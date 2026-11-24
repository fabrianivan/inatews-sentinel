import { NextRequest, NextResponse } from 'next/server';
import type { AIAnalysis } from '@/lib/types';
import { proxyBackendJson } from '@/lib/backendProxy';
import {
  AI_GUARDRAILS,
  AI_PROVIDER_COOKIE,
  buildDrillAIAnalysis,
  buildLiveAIAnalysis,
  callGeminiAPI,
  formatContextBrief,
  getLiveModelLabel,
  normalizeAIProvider,
  type TelemetryPromptContext,
} from '@/lib/aiContext';
import { fetchLiveTelemetrySnapshot } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

async function synthesizeAI(
  req: NextRequest,
  context?: TelemetryPromptContext
): Promise<AIAnalysis> {
  // A drill is described by its context alone; neither the backend nor the live feeds know it.
  const drillAnalysis = buildDrillAIAnalysis({ context });
  if (drillAnalysis) {
    return drillAnalysis;
  }

  const proxied = await proxyBackendJson<AIAnalysis>('/api/ai/latest');
  if (proxied && proxied.status) {
    return proxied;
  }

  const provider = normalizeAIProvider(
    context?.provider ||
      req.cookies.get(AI_PROVIDER_COOKIE)?.value ||
      process.env.AI_PROVIDER
  );

  const snapshot = await fetchLiveTelemetrySnapshot();
  const analysis = buildLiveAIAnalysis({ snapshot, provider });

  // Only the assessment is handed to a model; every other block stays a template.
  if (provider !== 'bedrock' && process.env.GEMINI_API_KEY?.trim()) {
    const prompt = [
      'Tulis penilaian 2-3 kalimat dalam Bahasa Indonesia untuk dasbor pendukung keputusan TIDAK RESMI pemantauan gempa dan tsunami Indonesia.',
      AI_GUARDRAILS,
      '',
      formatContextBrief(context, snapshot),
    ].join('\n');
    const summaryText = await callGeminiAPI(prompt, 4500);
    if (summaryText) {
      analysis.assessment = summaryText;
      analysis.model_used = getLiveModelLabel(provider);
    }
  }

  return analysis;
}

export async function GET(req: NextRequest) {
  const analysis = await synthesizeAI(req);
  return NextResponse.json(analysis);
}

export async function POST(req: NextRequest) {
  let context: TelemetryPromptContext | undefined;
  try {
    const body = (await req.json()) as { context?: TelemetryPromptContext };
    context = body?.context;
  } catch {
    // ignore malformed json
  }
  const analysis = await synthesizeAI(req, context);
  return NextResponse.json(analysis);
}
