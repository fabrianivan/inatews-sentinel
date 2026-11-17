import { NextRequest, NextResponse } from 'next/server';
import type { AIAnalysis } from '@/lib/types';
import { proxyBackendJson } from '@/lib/backendProxy';
import {
  AI_PROVIDER_COOKIE,
  buildLiveAIAnalysis,
  callGeminiAPI,
  formatContextBrief,
  normalizeAIProvider,
  type TelemetryPromptContext,
} from '@/lib/aiContext';
import { fetchLiveTelemetrySnapshot } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

async function synthesizeAI(
  req: NextRequest,
  context?: TelemetryPromptContext
): Promise<AIAnalysis> {
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

  // Optionally enrich summary/assessment via Gemini when API key is configured on Vercel
  if (provider !== 'bedrock' && process.env.GEMINI_API_KEY?.trim()) {
    const brief = formatContextBrief(context, snapshot);
    const prompt = [
      'Berikan ringkasan assessment bencana 2-3 kalimat dalam Bahasa Indonesia yang faktual untuk panel Threat Assessment BMKG InaTEWS.',
      'Gunakan data telemetri langsung berikut:',
      brief,
    ].join('\n');
    const summaryText = await callGeminiAPI(prompt, 4500);
    if (summaryText) {
      analysis.assessment = summaryText;
      analysis.model_used = `${analysis.model_used} (Live API)`;
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
