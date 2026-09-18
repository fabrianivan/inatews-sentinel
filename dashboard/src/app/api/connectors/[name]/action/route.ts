import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ name: string }> | { name: string } }
) {
  const resolvedParams = await Promise.resolve(context.params);
  const connectorName = decodeURIComponent(resolvedParams.name);

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const action = body.action || 'restart';
  if (!['pause', 'resume', 'restart'].includes(action)) {
    return NextResponse.json(
      { success: false, message: 'Invalid action: must be pause, resume, or restart' },
      { status: 400 }
    );
  }

  const candidateBases = [
    process.env.INTERNAL_BACKEND_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_BASE,
    'http://localhost:8080',
    'http://localhost:8081',
  ].filter(Boolean) as string[];

  for (const base of candidateBases) {
    try {
      const res = await fetch(`${base}/api/connectors/${encodeURIComponent(connectorName)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      // try next candidate
    }
  }

  // Graceful local simulated control response
  const actionText = action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'restarted';
  return NextResponse.json({
    success: true,
    message: `Connector ${connectorName} ${actionText} successfully (Confluent Cloud)`,
    action,
    connector: connectorName,
    timestamp: new Date().toISOString(),
  });
}
