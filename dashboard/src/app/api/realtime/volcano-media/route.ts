import { NextRequest, NextResponse } from 'next/server';
import { fetchVolcanoMedia } from '@/lib/telemetry';
import { findVolcanoLocation } from '@/lib/volcanoData';

export const dynamic = 'force-dynamic';

/**
 * PVMBG's live seismogram and camera frames for one catalogue volcano, read from MAGMA
 * Indonesia. Only catalogue volcanoes are answered, so the query never reaches upstream.
 */
export async function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get('volcano') ?? '').trim();
  const volcano = name.length >= 3 ? findVolcanoLocation(name) : null;
  if (!volcano) {
    return NextResponse.json({ error: 'unknown volcano' }, { status: 404 });
  }
  return NextResponse.json(await fetchVolcanoMedia(volcano.name));
}
