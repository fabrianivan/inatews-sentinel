import { NextRequest, NextResponse } from 'next/server';
import { proxyBackendStream } from '@/lib/backendProxy';
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
    const parsed: unknown = await req.json();
    // `null` and bare values are valid JSON but not a request body.
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed;
  } catch {
    // malformed JSON: treated as an empty body
  }

  const rawQuestion = String(
    body.question || body.prompt || body.query || body.message || ''
  ).trim();

  if (!rawQuestion) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  // The backend is sent the question only and answers from live data, so a
  // drill question is answered here, where the scenario context is known.
  if (body.context?.mode !== 'SIMULASI') {
    const proxied = await proxyBackendStream(
      '/api/agent/chat/stream',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: rawQuestion }),
      },
      2200,
      req.signal
    );

    if (proxied?.body) {
      return new Response(proxied.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }
  }

  const provider = normalizeAIProvider(
    body.context?.provider ||
      req.cookies.get(AI_PROVIDER_COOKIE)?.value ||
      process.env.AI_PROVIDER
  );
  const snapshot = await fetchLiveTelemetrySnapshot();
  const reply = await generateHybridCopilotReply({
    question: rawQuestion,
    kind: 'agent',
    provider,
    context: body.context,
    snapshot,
  });

  const tokens = reply.answer.match(/\S+\s*/g) || [reply.answer];
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const token of tokens) {
          if (req.signal.aborted) break;
          controller.enqueue(
            encoder.encode(`event: token\ndata: ${JSON.stringify({ token })}\n\n`)
          );
          await new Promise((resolve) => setTimeout(resolve, 14));
        }

        if (!req.signal.aborted) {
          const donePayload = JSON.stringify({
            answer: reply.answer,
            model: reply.model,
            latency_ms: reply.latencyMs,
            timestamp: new Date().toISOString(),
          });
          controller.enqueue(encoder.encode(`event: done\ndata: ${donePayload}\n\n`));
        }
      } catch {
        // ignore closed client
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
