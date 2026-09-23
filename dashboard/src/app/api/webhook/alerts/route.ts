import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    return NextResponse.json({
      success: true,
      message: 'Emergency webhook alert received successfully by InaTEWS Dashboard',
      recorded_at: new Date().toISOString(),
      payload_summary: typeof payload === 'object' ? Object.keys(payload) : 'raw',
    });
  } catch {
    return NextResponse.json({
      success: true,
      message: 'Webhook endpoint active (empty or raw body accepted)',
      recorded_at: new Date().toISOString(),
    });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ACTIVE',
    service: 'InaTEWS Disaster Alert Webhook Gateway',
    endpoint: '/api/webhook/alerts',
    supported_formats: ['JSON'],
    timestamp: new Date().toISOString(),
  });
}
